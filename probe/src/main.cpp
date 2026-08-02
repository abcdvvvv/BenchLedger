#include "benchledger_probe/json.hpp"
#include "benchledger_probe/normalize.hpp"
#include "benchledger_probe/process.hpp"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

#ifndef BENCHLEDGER_PROBE_VERSION
#define BENCHLEDGER_PROBE_VERSION "dev"
#endif

namespace {

struct Options {
    bool pretty{};
    bool help{};
    bool version{};
    std::filesystem::path input;
    std::filesystem::path fastfetch;
};

Options parse_options(int argc, char** argv) {
    Options options;
    for (int i = 1; i < argc; ++i) {
        const std::string argument = argv[i];
        if (argument == "--pretty") options.pretty = true;
        else if (argument == "--help" || argument == "-h") options.help = true;
        else if (argument == "--version") options.version = true;
        else if (argument == "--input" || argument == "--fastfetch") {
            if (++i >= argc) throw std::runtime_error(argument + " requires a value");
            if (argument == "--input") options.input = argv[i]; else options.fastfetch = argv[i];
        } else throw std::runtime_error("unknown argument: " + argument);
    }
    if (!options.input.empty() && !options.fastfetch.empty()) throw std::runtime_error("--input and --fastfetch cannot be used together");
    return options;
}

std::string read_input(const std::filesystem::path& path) {
    if (path == "-") return {std::istreambuf_iterator<char>(std::cin), std::istreambuf_iterator<char>()};
    std::ifstream stream(path, std::ios::binary);
    if (!stream) throw std::runtime_error("cannot open input file: " + path.string());
    return {std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>()};
}

void print_help() {
    std::cout
        << "Usage: benchledger-probe [options]\n"
        << "\n"
        << "Options:\n"
        << "  --input FILE       Normalize saved Fastfetch JSON; use - for stdin\n"
        << "  --fastfetch FILE   Use this Fastfetch executable\n"
        << "  --pretty           Pretty-print output JSON\n"
        << "  --version          Print probe version\n"
        << "  -h, --help         Show this help\n";
}

} // namespace

int main(int argc, char** argv) {
    try {
        const Options options = parse_options(argc, argv);
        if (options.help) { print_help(); return 0; }
        if (options.version) { std::cout << "benchledger-probe " << BENCHLEDGER_PROBE_VERSION << '\n'; return 0; }

        std::string source;
        if (!options.input.empty()) source = read_input(options.input);
        else {
            const auto executable = benchledger::probe::resolve_fastfetch(argv[0], options.fastfetch);
            const auto process = benchledger::probe::run_process(executable, {
                "--config", "none",
                "-s", "CPU:PhysicalMemory:Memory:GPU:OS:Kernel:Version",
                "--format", "json"});
            if (process.exit_code != 0) {
                throw std::runtime_error("Fastfetch exited with code " + std::to_string(process.exit_code) +
                    (process.standard_error.empty() ? std::string{} : ": " + process.standard_error));
            }
            source = process.standard_output;
        }

        const auto normalized = benchledger::probe::normalize_fastfetch(benchledger::probe::Json::parse(source));
        std::cout << normalized.dump(options.pretty) << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "benchledger-probe: " << error.what() << '\n';
        return 1;
    }
}
