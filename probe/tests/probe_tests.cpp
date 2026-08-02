#include "benchledger_probe/json.hpp"
#include "benchledger_probe/normalize.hpp"
#include "benchledger_probe/process.hpp"

#include <algorithm>
#include <filesystem>
#include <functional>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {

using benchledger::probe::Json;

std::string read_file(const std::filesystem::path& path) {
    std::ifstream stream(path, std::ios::binary);
    if (!stream) throw std::runtime_error("cannot open fixture: " + path.string());
    return {std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>()};
}

Json normalize(std::string_view name) {
    const auto path = std::filesystem::path(BENCHLEDGER_PROBE_FIXTURE_DIR) / name;
    return benchledger::probe::normalize_fastfetch(Json::parse(read_file(path)));
}

Json normalize_json(std::string_view input) {
    return benchledger::probe::normalize_fastfetch(Json::parse(input));
}

const Json& at(const Json& object, std::string_view key) {
    const Json* value = object.find(key);
    if (value == nullptr) throw std::runtime_error("missing key: " + std::string(key));
    return *value;
}

void require(bool condition, std::string_view message) {
    if (!condition) throw std::runtime_error(std::string(message));
}

void require_throws_contains(const std::function<void()>& action, std::string_view expected) {
    try {
        action();
    } catch (const std::runtime_error& error) {
        require(std::string(error.what()).find(expected) != std::string::npos, "unexpected error message");
        return;
    }
    throw std::runtime_error("expected operation to fail");
}

void test_json() {
    const Json value = Json::parse(R"({"emoji":"\ud83d\ude80","n":18446744073709551615,"a":[true,null,-2,1.5]})");
    require(at(value, "emoji").as_string() == "🚀", "Unicode surrogate pair failed");
    require(at(value, "n").as_uint64() == 18446744073709551615ULL, "uint64 parse failed");
    require(Json::parse(value.dump()).dump() == value.dump(), "JSON round trip failed");
}

void test_linux() {
    const Json value = normalize("linux.json");
    const Json& hardware = at(value, "hardware");
    require(at(hardware, "architecture").as_string() == "x86_64", "Linux architecture");
    require(at(at(hardware, "memory"), "total_bytes").as_uint64() == 68719476736ULL, "PhysicalMemory must win over Memory.total");
    require(at(at(value, "diagnostics"), "memory_source").as_string() == "physical_memory", "Linux memory source");
    const auto& gpu = at(hardware, "gpu").as_array();
    require(gpu.size() == 1 && at(gpu[0], "count").as_uint64() == 1, "Linux GPU normalization");
    require(gpu[0].find("temperature") == nullptr && gpu[0].find("driver") == nullptr, "Dynamic/software GPU fields leaked into hardware");
    require(value.dump().find("SECRET") == std::string::npos, "Memory serial leaked");
}

void test_macos_fallback() {
    const Json value = normalize("macos.json");
    require(at(at(at(value, "hardware"), "memory"), "total_bytes").as_uint64() == 68719476736ULL, "macOS memory fallback");
    require(at(at(value, "diagnostics"), "memory_source").as_string() == "memory_total", "macOS memory source");
    require(at(at(value, "diagnostics"), "memory_visible_bytes").as_uint64() == 68719476736ULL, "macOS visible memory diagnostics");
    require(at(at(value, "hardware"), "architecture").as_string() == "aarch64", "macOS architecture normalization");
    require(!at(at(value, "diagnostics"), "warnings").as_array().empty(), "macOS fallback warning");
}

void test_linux_memory_fallback_and_driver_normalization() {
    const Json value = normalize("linux-memory-fallback.json");
    require(at(value, "schema_version").as_uint64() == 2, "Probe schema version");
    const Json& hardware = at(value, "hardware");
    require(at(at(hardware, "memory"), "total_bytes").as_uint64() == 34359738368ULL, "Visible memory must round upward to 32 GiB");
    const Json& diagnostics = at(value, "diagnostics");
    require(at(diagnostics, "memory_source").as_string() == "memory_total", "Linux fallback memory source");
    require(at(diagnostics, "memory_visible_bytes").as_uint64() == 33600000000ULL, "Raw visible memory must remain diagnostic-only");
    const auto& drivers = at(at(value, "software"), "gpu_drivers").as_array();
    require(drivers.size() == 1, "Linux fallback driver count");
    require(at(drivers[0], "name").as_string() == "nvidia", "NVIDIA driver name");
    require(at(drivers[0], "variant").as_string() == "open_source", "NVIDIA driver variant");
    require(at(drivers[0], "version").as_string() == "999.1", "NVIDIA driver version");
    require(drivers[0].find("driver") == nullptr, "Raw driver description leaked into software facts");
}

void test_windows_grouping() {
    const Json value = normalize("windows.json");
    require(at(at(value, "hardware"), "architecture").as_string() == "x86_64", "Windows architecture normalization");
    const auto& gpus = at(at(value, "hardware"), "gpu").as_array();
    require(gpus.size() == 1, "identical GPUs were not grouped");
    require(at(gpus[0], "count").as_uint64() == 2, "GPU count");
    const auto& drivers = at(at(value, "software"), "gpu_drivers").as_array();
    require(drivers.size() == 1 && at(drivers[0], "device_count").as_uint64() == 2, "GPU driver grouping");
    require(at(drivers[0], "name").as_string() == "nvidia", "Windows numeric driver name fallback");
    require(at(drivers[0], "version").as_string() == "32.0.15.6094", "Windows driver version");
}

void test_module_order_stability() {
    const auto path = std::filesystem::path(BENCHLEDGER_PROBE_FIXTURE_DIR) / "linux.json";
    Json source = Json::parse(read_file(path));
    const std::string expected = benchledger::probe::normalize_fastfetch(source).dump();
    std::reverse(source.as_array().begin(), source.as_array().end());
    const std::string reversed = benchledger::probe::normalize_fastfetch(source).dump();
    require(expected == reversed, "module order changed normalized output");
}

void test_duplicate_module_failure() {
    const auto path = std::filesystem::path(BENCHLEDGER_PROBE_FIXTURE_DIR) / "linux.json";
    Json source = Json::parse(read_file(path));
    source.as_array().push_back(source.as_array().front());
    require_throws_contains(
        [&] { (void) benchledger::probe::normalize_fastfetch(source); },
        "duplicate cpu");
}

void test_incomplete_physical_memory_falls_back() {
    const Json value = normalize_json(R"([
        {"type":"CPU","result":{"cpu":"Example CPU"}},
        {"type":"PhysicalMemory","result":[
            {"installed":true,"size":8589934592},
            {"installed":true}
        ]},
        {"type":"Memory","result":{"total":16000000000}},
        {"type":"Kernel","result":{"architecture":"x86_64","name":"Linux","release":"1"}}
    ])");
    require(
        at(at(at(value, "hardware"), "memory"), "total_bytes").as_uint64() == 16106127360ULL,
        "Incomplete PhysicalMemory must fall back to rounded Memory.total");
    require(
        at(at(value, "diagnostics"), "memory_source").as_string() == "memory_total",
        "Incomplete PhysicalMemory source");
}

void test_physical_memory_error_forces_fallback() {
    const Json value = normalize_json(R"([
        {"type":"CPU","result":{"cpu":"Example CPU"}},
        {"type":"PhysicalMemory","error":"partial SMBIOS read","result":[
            {"installed":true,"size":8589934592}
        ]},
        {"type":"Memory","result":{"total":16000000000}},
        {"type":"Kernel","result":{"architecture":"x86_64","name":"Linux","release":"1"}}
    ])");
    require(
        at(at(value, "diagnostics"), "memory_source").as_string() == "memory_total",
        "PhysicalMemory module error must force Memory.total fallback");
}

void test_gpu_type_is_schema_safe() {
    const Json value = normalize_json(R"([
        {"type":"CPU","result":{"cpu":"Example CPU"}},
        {"type":"GPU","result":[{"name":"Example GPU","vendor":"Example","type":"Virtual"}]},
        {"type":"Kernel","result":{"architecture":"x86_64","name":"Linux","release":"1"}}
    ])");
    const auto& gpus = at(at(value, "hardware"), "gpu").as_array();
    require(at(gpus.front(), "type").as_string() == "unknown", "Unknown GPU type must normalize to schema enum");
}

void test_os_without_name_is_omitted() {
    const Json value = normalize_json(R"([
        {"type":"CPU","result":{"cpu":"Example CPU"}},
        {"type":"OS","result":{"versionID":"1.0"}},
        {"type":"Kernel","result":{"architecture":"x86_64","name":"Linux","release":"1"}}
    ])");
    require(at(at(value, "software"), "platform").find("os") == nullptr, "OS without a name must be omitted");
}

void test_incomplete_kernel_failure() {
    require_throws_contains(
        [] {
            (void) normalize_json(R"([
                {"type":"CPU","result":{"cpu":"Example CPU"}},
                {"type":"Kernel","result":{"architecture":"x86_64"}}
            ])");
        },
        "kernel name and version");
}

void test_invalid_explicit_fastfetch_failure() {
    const auto missing = std::filesystem::temp_directory_path() / "benchledger-probe-definitely-missing-fastfetch";
    require_throws_contains(
        [&] { (void) benchledger::probe::resolve_fastfetch({}, missing); },
        "--fastfetch");
}

void test_critical_failure() {
    require_throws_contains(
        [] { (void) normalize("missing-cpu.json"); },
        "CPU");
}

} // namespace

int main() {
    try {
        test_json();
        test_linux();
        test_macos_fallback();
        test_linux_memory_fallback_and_driver_normalization();
        test_windows_grouping();
        test_module_order_stability();
        test_duplicate_module_failure();
        test_incomplete_physical_memory_falls_back();
        test_physical_memory_error_forces_fallback();
        test_gpu_type_is_schema_safe();
        test_os_without_name_is_omitted();
        test_incomplete_kernel_failure();
        test_invalid_explicit_fastfetch_failure();
        test_critical_failure();
        std::cout << "All benchledger-probe tests passed\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Test failure: " << error.what() << '\n';
        return 1;
    }
}
