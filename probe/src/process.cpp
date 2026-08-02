#include "benchledger_probe/process.hpp"

#include <cstdlib>
#include <fstream>
#include <limits>
#include <random>
#include <stdexcept>

#ifdef _WIN32
#define NOMINMAX
#include <windows.h>
#else
#include <cerrno>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace benchledger::probe {
namespace {

std::string read_file(const std::filesystem::path& path) {
    std::ifstream stream(path, std::ios::binary);
    if (!stream) throw std::runtime_error("failed to read process output: " + path.string());
    return {std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>()};
}

std::filesystem::path temporary_path(std::string_view suffix) {
    std::random_device random;
    for (int attempt = 0; attempt < 100; ++attempt) {
        const auto path = std::filesystem::temp_directory_path() /
            ("benchledger-probe-" + std::to_string(random()) + std::string(suffix));
        if (!std::filesystem::exists(path)) return path;
    }
    throw std::runtime_error("unable to allocate a temporary file name");
}

bool executable_candidate(const std::filesystem::path& path) {
    std::error_code error;
    if (path.empty() || !std::filesystem::is_regular_file(path, error)) return false;
#ifdef _WIN32
    return true;
#else
    return ::access(path.c_str(), X_OK) == 0;
#endif
}

std::filesystem::path find_on_path(const std::filesystem::path& name) {
    if (name.has_parent_path()) return executable_candidate(name) ? name : std::filesystem::path{};
    const char* raw_path = std::getenv("PATH");
    if (raw_path == nullptr) return {};
#ifdef _WIN32
    constexpr char delimiter = ';';
#else
    constexpr char delimiter = ':';
#endif
    const std::string path_list(raw_path);
    std::size_t begin = 0;
    while (begin <= path_list.size()) {
        const std::size_t end = path_list.find(delimiter, begin);
        const std::string_view entry(path_list.data() + begin,
            (end == std::string::npos ? path_list.size() : end) - begin);
        const auto candidate = (entry.empty() ? std::filesystem::current_path() : std::filesystem::path(entry)) / name;
        if (executable_candidate(candidate)) return candidate;
        if (end == std::string::npos) break;
        begin = end + 1;
    }
    return {};
}

std::filesystem::path resolve_configured_executable(
    const std::filesystem::path& configured,
    std::string_view source) {
    if (configured.empty()) return {};
    const std::filesystem::path resolved = find_on_path(configured);
    if (!resolved.empty()) return resolved;
    throw std::runtime_error(
        "Fastfetch executable from " + std::string(source) +
        " does not exist or is not executable: " + configured.string());
}

std::filesystem::path resolve_invoked_executable(const std::filesystem::path& argv0) {
    std::filesystem::path candidate = argv0.has_parent_path() ? argv0 : find_on_path(argv0);
    if (candidate.empty()) return {};
    std::error_code error;
    const auto absolute = std::filesystem::absolute(candidate, error);
    return error ? candidate : absolute;
}

#ifdef _WIN32
class UniqueHandle {
public:
    UniqueHandle() = default;
    explicit UniqueHandle(HANDLE value) : value_(value) {}
    ~UniqueHandle() { reset(); }
    UniqueHandle(const UniqueHandle&) = delete;
    UniqueHandle& operator=(const UniqueHandle&) = delete;
    UniqueHandle(UniqueHandle&& other) noexcept : value_(other.release()) {}
    UniqueHandle& operator=(UniqueHandle&& other) noexcept {
        if (this != &other) reset(other.release());
        return *this;
    }
    [[nodiscard]] HANDLE get() const { return value_; }
    [[nodiscard]] bool valid() const { return value_ != nullptr && value_ != INVALID_HANDLE_VALUE; }
    HANDLE release() { const HANDLE value = value_; value_ = nullptr; return value; }
    void reset(HANDLE value = nullptr) {
        if (valid()) CloseHandle(value_);
        value_ = value;
    }
private:
    HANDLE value_{};
};

std::wstring widen(std::string_view input) {
    if (input.empty()) return {};
    const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), nullptr, 0);
    if (size <= 0) throw std::runtime_error("invalid UTF-8 command argument");
    std::wstring result(static_cast<std::size_t>(size), L'\0');
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), result.data(), size) != size) {
        throw std::runtime_error("failed to convert command argument to UTF-16");
    }
    return result;
}

std::wstring quote_windows(std::wstring_view argument) {
    if (argument.empty()) return L"\"\"";
    if (argument.find_first_of(L" \t\"") == std::wstring_view::npos) return std::wstring(argument);
    std::wstring output = L"\"";
    std::size_t backslashes = 0;
    for (const wchar_t c : argument) {
        if (c == L'\\') { ++backslashes; continue; }
        if (c == L'\"') {
            output.append(backslashes * 2 + 1, L'\\');
            output.push_back(L'\"');
            backslashes = 0;
            continue;
        }
        output.append(backslashes, L'\\');
        backslashes = 0;
        output.push_back(c);
    }
    output.append(backslashes * 2, L'\\');
    output.push_back(L'\"');
    return output;
}
#endif

} // namespace

ProcessResult run_process(const std::filesystem::path& executable, const std::vector<std::string>& arguments) {
    const auto output_path = temporary_path(".out");
    const auto error_path = temporary_path(".err");
    struct Cleanup {
        std::filesystem::path output;
        std::filesystem::path error;
        ~Cleanup() {
            std::error_code ignored;
            std::filesystem::remove(output, ignored);
            std::filesystem::remove(error, ignored);
        }
    } cleanup{output_path, error_path};

#ifdef _WIN32
    SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
    UniqueHandle output(CreateFileW(output_path.c_str(), GENERIC_WRITE, FILE_SHARE_READ, &security, CREATE_NEW, FILE_ATTRIBUTE_TEMPORARY, nullptr));
    UniqueHandle error(CreateFileW(error_path.c_str(), GENERIC_WRITE, FILE_SHARE_READ, &security, CREATE_NEW, FILE_ATTRIBUTE_TEMPORARY, nullptr));
    if (!output.valid() || !error.valid()) throw std::runtime_error("failed to create process output files");

    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESTDHANDLES;
    startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    startup.hStdOutput = output.get();
    startup.hStdError = error.get();
    PROCESS_INFORMATION raw_process{};

    std::wstring command = quote_windows(executable.wstring());
    for (const std::string& argument : arguments) command += L" " + quote_windows(widen(argument));
    if (!CreateProcessW(nullptr, command.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &raw_process)) {
        throw std::runtime_error("failed to start Fastfetch (Windows error " + std::to_string(GetLastError()) + ")");
    }
    UniqueHandle process(raw_process.hProcess);
    UniqueHandle thread(raw_process.hThread);
    output.reset();
    error.reset();

    if (WaitForSingleObject(process.get(), INFINITE) != WAIT_OBJECT_0) throw std::runtime_error("failed to wait for Fastfetch");
    DWORD raw_exit_code = 0;
    if (!GetExitCodeProcess(process.get(), &raw_exit_code)) throw std::runtime_error("failed to read Fastfetch exit code");
    const int exit_code = raw_exit_code <= static_cast<DWORD>(std::numeric_limits<int>::max()) ? static_cast<int>(raw_exit_code) : 125;
    return {exit_code, read_file(output_path), read_file(error_path)};
#else
    const pid_t pid = fork();
    if (pid < 0) throw std::runtime_error("failed to fork Fastfetch process");
    if (pid == 0) {
        const int output = ::open(output_path.c_str(), O_WRONLY | O_CREAT | O_EXCL, 0600);
        const int error = ::open(error_path.c_str(), O_WRONLY | O_CREAT | O_EXCL, 0600);
        if (output < 0 || error < 0) _exit(126);
        if (dup2(output, STDOUT_FILENO) < 0 || dup2(error, STDERR_FILENO) < 0) _exit(126);
        close(output);
        close(error);

        std::vector<std::string> storage;
        storage.reserve(arguments.size() + 1);
        storage.push_back(executable.string());
        storage.insert(storage.end(), arguments.begin(), arguments.end());
        std::vector<char*> argv;
        argv.reserve(storage.size() + 1);
        for (std::string& item : storage) argv.push_back(item.data());
        argv.push_back(nullptr);
        execvp(argv[0], argv.data());
        _exit(127);
    }

    int status = 0;
    while (waitpid(pid, &status, 0) < 0) {
        if (errno == EINTR) continue;
        throw std::runtime_error("failed to wait for Fastfetch");
    }
    int exit_code = 125;
    if (WIFEXITED(status)) exit_code = WEXITSTATUS(status);
    else if (WIFSIGNALED(status)) exit_code = 128 + WTERMSIG(status);
    return {exit_code, read_file(output_path), read_file(error_path)};
#endif
}

std::filesystem::path resolve_fastfetch(const std::filesystem::path& argv0, const std::filesystem::path& explicit_path) {
    if (!explicit_path.empty()) return resolve_configured_executable(explicit_path, "--fastfetch");
#ifdef _WIN32
    constexpr const char* name = "fastfetch.exe";
#else
    constexpr const char* name = "fastfetch";
#endif
    const auto invoked_executable = resolve_invoked_executable(argv0);
    if (!invoked_executable.empty()) {
        const auto adjacent = invoked_executable.parent_path() / name;
        if (executable_candidate(adjacent)) return adjacent;
    }
    if (const char* configured = std::getenv("FASTFETCH_PATH"); configured != nullptr && *configured != '\0') {
        return resolve_configured_executable(configured, "FASTFETCH_PATH");
    }
    const auto from_path = find_on_path(name);
    if (!from_path.empty()) return from_path;
    throw std::runtime_error(
        "Fastfetch was not found beside benchledger-probe, in FASTFETCH_PATH, or on PATH");
}

} // namespace benchledger::probe
