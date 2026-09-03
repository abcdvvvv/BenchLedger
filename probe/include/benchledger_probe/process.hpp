#pragma once

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

namespace benchledger::probe {

struct ProcessResult {
    int exit_code{};
    std::string standard_output;
    std::string standard_error;
};

[[nodiscard]] ProcessResult run_process(
    const std::filesystem::path& executable,
    const std::vector<std::string>& arguments,
    std::chrono::milliseconds timeout,
    std::uintmax_t max_output_bytes = 16ULL * 1024ULL * 1024ULL);

[[nodiscard]] std::filesystem::path resolve_fastfetch(
    const std::filesystem::path& argv0,
    const std::filesystem::path& explicit_path);

} // namespace benchledger::probe
