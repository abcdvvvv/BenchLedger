#include "benchledger_probe/normalize.hpp"

#include <algorithm>
#include <compare>
#include <cctype>
#include <initializer_list>
#include <limits>
#include <map>
#include <optional>
#include <stdexcept>

namespace benchledger::probe {
namespace {

std::string trim(std::string value) {
    const auto not_space = [](unsigned char c) { return !std::isspace(c); };
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), not_space));
    value.erase(std::find_if(value.rbegin(), value.rend(), not_space).base(), value.end());
    return value;
}

std::string lowercase(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}

std::string collapse_spaces(std::string value) {
    std::string output;
    bool pending_space = false;
    for (const char raw : value) {
        const auto c = static_cast<unsigned char>(raw);
        if (std::isspace(c)) {
            pending_space = !output.empty();
        } else {
            if (pending_space) output.push_back(' ');
            output.push_back(static_cast<char>(c));
            pending_space = false;
        }
    }
    return output;
}

std::string replace_all(std::string value, std::string_view needle, std::string_view replacement) {
    std::size_t position = 0;
    while ((position = value.find(needle, position)) != std::string::npos) {
        value.replace(position, needle.size(), replacement);
        position += replacement.size();
    }
    return value;
}

std::string normalize_model(std::string value) {
    value = replace_all(std::move(value), "(R)", "");
    value = replace_all(std::move(value), "(TM)", "");
    value = replace_all(std::move(value), "®", "");
    value = replace_all(std::move(value), "™", "");
    return collapse_spaces(trim(std::move(value)));
}

std::string normalize_vendor(std::string value) {
    value = trim(std::move(value));
    const std::string lowered = lowercase(value);
    if (lowered == "authenticamd" || lowered == "amd" || lowered.find("advanced micro devices") != std::string::npos) return "AMD";
    if (lowered == "genuineintel" || lowered == "intel" || lowered.find("intel corporation") != std::string::npos) return "Intel";
    if (lowered.find("nvidia") != std::string::npos) return "NVIDIA";
    if (lowered == "apple" || lowered.find("apple inc") != std::string::npos) return "Apple";
    return value;
}

std::string strip_vendor_prefix(std::string model, const std::string& vendor) {
    model = normalize_model(std::move(model));
    const std::string lowered = lowercase(model);
    const auto strip = [&](std::initializer_list<std::string_view> prefixes) {
        for (const std::string_view prefix : prefixes) {
            if (lowered.starts_with(prefix)) return trim(model.substr(prefix.size()));
        }
        return model;
    };
    if (vendor == "NVIDIA") return strip({"nvidia corporation ", "nvidia "});
    if (vendor == "AMD") return strip({"advanced micro devices, inc. ", "advanced micro devices ", "amd "});
    if (vendor == "Intel") return strip({"intel corporation ", "intel "});
    if (vendor == "Apple") return strip({"apple "});
    return model;
}

std::string normalize_architecture(std::string value) {
    value = lowercase(trim(std::move(value)));
    if (value == "amd64" || value == "x64" || value == "x86-64") return "x86_64";
    if (value == "arm64") return "aarch64";
    if (value == "i386" || value == "i486" || value == "i586" || value == "i686") return "x86";
    if (value == "armv7l" || value == "armv7-a") return "armv7";
    if (value == "powerpc64le") return "ppc64le";
    return value;
}

std::string string_value(const Json* value) {
    return value != nullptr && value->is_string() ? trim(value->as_string()) : std::string{};
}

std::optional<std::uint64_t> uint_value(const Json* value) {
    if (value == nullptr || !value->is_number()) return std::nullopt;
    try { return value->as_uint64(); } catch (...) { return std::nullopt; }
}

void add_string(Json::object& output, std::string key, std::string value) {
    value = trim(std::move(value));
    if (!value.empty()) output.emplace(std::move(key), std::move(value));
}

void add_uint(Json::object& output, std::string key, std::optional<std::uint64_t> value) {
    if (value && *value > 0) output.emplace(std::move(key), *value);
}

struct ModuleResult {
    const Json* value{};
    std::string error;
    bool seen{};
};

struct Modules {
    ModuleResult cpu;
    ModuleResult physical_memory;
    ModuleResult memory;
    ModuleResult gpu;
    ModuleResult os;
    ModuleResult kernel;
    ModuleResult version;
};

ModuleResult* select_module(Modules& modules, std::string_view type) {
    if (type == "cpu") return &modules.cpu;
    if (type == "physicalmemory") return &modules.physical_memory;
    if (type == "memory") return &modules.memory;
    if (type == "gpu") return &modules.gpu;
    if (type == "os") return &modules.os;
    if (type == "kernel") return &modules.kernel;
    if (type == "version") return &modules.version;
    return nullptr;
}

Modules collect_modules(const Json& root) {
    const Json* input = root.is_object() ? root.find("modules") : &root;
    if (input == nullptr || !input->is_array()) throw std::runtime_error("Fastfetch JSON must be an array of module results");

    Modules modules;
    for (const Json& item : input->as_array()) {
        if (!item.is_object()) continue;
        const std::string type = lowercase(string_value(item.find("type")));
        ModuleResult* target = select_module(modules, type);
        if (target == nullptr) continue;
        if (target->seen) throw std::runtime_error("Fastfetch JSON contains duplicate " + type + " modules");
        target->seen = true;
        if (const Json* error = item.find("error"); error && error->is_string()) target->error = trim(error->as_string());
        if (const Json* result = item.find("result")) target->value = result;
    }
    return modules;
}

void append_module_warning(
    const ModuleResult& module,
    std::string_view name,
    std::vector<std::string>& warnings,
    bool ignore_no_devices = false) {
    if (module.error.empty()) return;
    const std::string lowered = lowercase(module.error);
    if (ignore_no_devices && (lowered.find("no gpu") != std::string::npos || lowered.find("no device") != std::string::npos)) return;
    warnings.push_back(std::string(name) + ": " + module.error);
}

Json::object normalize_cpu(const Json* input) {
    if (input == nullptr || !input->is_object()) throw std::runtime_error("Fastfetch CPU result is missing");
    Json::object output;
    add_string(output, "model", normalize_model(string_value(input->find("cpu"))));
    add_string(output, "vendor", normalize_vendor(string_value(input->find("vendor"))));
    if (const Json* cores = input->find("cores"); cores && cores->is_object()) {
        add_uint(output, "physical_cores", uint_value(cores->find("physical")));
        add_uint(output, "logical_threads", uint_value(cores->find("logical")));
    }
    add_uint(output, "packages", uint_value(input->find("packages")));
    add_string(output, "microarchitecture", string_value(input->find("march")));
    add_uint(output, "numa_nodes", uint_value(input->find("numaNodes")));
    if (!output.contains("model")) throw std::runtime_error("Fastfetch CPU model is missing");
    return output;
}

struct MemoryNormalization {
    std::optional<std::uint64_t> total_bytes;
    std::string source;
    std::optional<std::uint64_t> visible_bytes;
};

std::uint64_t round_up_to_gib(std::uint64_t value) {
    constexpr std::uint64_t gib = 1024ULL * 1024ULL * 1024ULL;
    const std::uint64_t quotient = value / gib;
    const std::uint64_t remainder = value % gib;
    if (remainder == 0) return value;
    if (quotient == std::numeric_limits<std::uint64_t>::max() / gib) throw std::runtime_error("visible memory size overflow");
    return (quotient + 1) * gib;
}

MemoryNormalization normalize_memory(const Modules& modules, std::vector<std::string>& warnings) {
    if (const Json* physical = modules.physical_memory.value; physical && physical->is_array()) {
        std::uint64_t total = 0;
        bool any_installed = false;
        bool incomplete = !modules.physical_memory.error.empty();
        for (const Json& device : physical->as_array()) {
            if (!device.is_object()) {
                incomplete = true;
                continue;
            }
            const Json* installed = device.find("installed");
            if (installed != nullptr) {
                if (!installed->is_bool()) {
                    incomplete = true;
                    continue;
                }
                if (!installed->as_bool()) continue;
            }

            any_installed = true;
            const auto size = uint_value(device.find("size"));
            if (!size || *size == 0) {
                incomplete = true;
                continue;
            }
            if (*size > std::numeric_limits<std::uint64_t>::max() - total) throw std::runtime_error("physical memory size overflow");
            total += *size;
        }
        append_module_warning(modules.physical_memory, "physicalmemory", warnings);
        if (any_installed && !incomplete && total > 0) return {total, "physical_memory", std::nullopt};
        warnings.push_back(incomplete
            ? "PhysicalMemory data was incomplete; using Memory.total"
            : "PhysicalMemory returned no installed modules with a valid size; using Memory.total");
    } else append_module_warning(modules.physical_memory, "physicalmemory", warnings);

    if (const Json* memory = modules.memory.value; memory && memory->is_object()) {
        const auto visible = uint_value(memory->find("total"));
        if (visible && *visible > 0) {
            const std::uint64_t normalized = round_up_to_gib(*visible);
            if (normalized != *visible) {
                warnings.push_back("Memory.total was rounded upward to a whole GiB for stable hardware identity");
            }
            return {normalized, "memory_total", *visible};
        }
    } else append_module_warning(modules.memory, "memory", warnings);
    warnings.push_back("Memory capacity could not be detected");
    return {std::nullopt, "unavailable", std::nullopt};
}

std::string normalize_gpu_type(std::string value) {
    value = lowercase(trim(std::move(value)));
    if (value.empty()) return {};
    if (value == "integrated" || value == "igpu") return "integrated";
    if (value == "discrete" || value == "dedicated" || value == "dgpu") return "discrete";
    if (value == "unknown") return value;
    return "unknown";
}

struct GpuKey {
    std::string vendor;
    std::string model;
    std::string type;
    std::uint64_t memory{};
    auto operator<=>(const GpuKey&) const = default;
};

std::string canonical_identifier(std::string value) {
    value = lowercase(trim(std::move(value)));
    std::string output;
    bool separator = false;
    for (const char raw : value) {
        const auto c = static_cast<unsigned char>(raw);
        if (std::isalnum(c)) {
            if (separator && !output.empty()) output.push_back('_');
            output.push_back(static_cast<char>(c));
            separator = false;
        } else {
            separator = !output.empty();
        }
    }
    return output;
}

bool looks_like_version(std::string_view value) {
    if (value.empty() || !std::isdigit(static_cast<unsigned char>(value.front()))) return false;
    return std::all_of(value.begin(), value.end(), [](unsigned char c) {
        return std::isalnum(c) || c == '.' || c == '-' || c == '_' || c == '+';
    });
}

struct DriverKey {
    std::string vendor;
    std::string name;
    std::string variant;
    std::string version;
    auto operator<=>(const DriverKey&) const = default;
};

DriverKey normalize_driver(std::string raw, const std::string& vendor) {
    DriverKey output;
    output.vendor = vendor;
    raw = collapse_spaces(trim(std::move(raw)));
    if (raw.empty()) return output;

    const std::size_t open = raw.find('(');
    const std::size_t close = open == std::string::npos ? std::string::npos : raw.find(')', open + 1);
    if (open != std::string::npos && close != std::string::npos) {
        output.variant = canonical_identifier(raw.substr(open + 1, close - open - 1));
        raw.erase(open, close - open + 1);
        raw = collapse_spaces(trim(std::move(raw)));
    }

    const std::size_t last_space = raw.find_last_of(' ');
    const std::string trailing = last_space == std::string::npos ? raw : raw.substr(last_space + 1);
    if (looks_like_version(trailing)) {
        output.version = trailing;
        raw = last_space == std::string::npos ? std::string{} : trim(raw.substr(0, last_space));
    }

    const std::string lowered = lowercase(raw);
    if (output.variant.empty() && (lowered.find("open source") != std::string::npos || lowered.find("open-source") != std::string::npos || lowered.find("open kernel") != std::string::npos)) {
        output.variant = "open_source";
    } else if (output.variant.empty() && lowered.find("proprietary") != std::string::npos) {
        output.variant = "proprietary";
    }

    output.name = canonical_identifier(raw);
    const std::string vendor_name = canonical_identifier(vendor);
    if (output.name.empty()) output.name = vendor_name;
    if (output.vendor == "NVIDIA" && output.name.starts_with("nvidia")) output.name = "nvidia";
    return output;
}

std::pair<Json::array, Json::array> normalize_gpus(const Json* input) {
    std::map<GpuKey, std::uint64_t, std::less<>> grouped;
    std::map<DriverKey, std::uint64_t, std::less<>> driver_counts;
    if (input != nullptr && input->is_array()) {
        for (const Json& gpu : input->as_array()) {
            if (!gpu.is_object()) continue;
            GpuKey key;
            key.vendor = normalize_vendor(string_value(gpu.find("vendor")));
            key.model = strip_vendor_prefix(string_value(gpu.find("name")), key.vendor);
            key.type = normalize_gpu_type(string_value(gpu.find("type")));
            if (const Json* memory = gpu.find("memory"); memory && memory->is_object()) {
                if (const Json* dedicated = memory->find("dedicated"); dedicated && dedicated->is_object()) key.memory = uint_value(dedicated->find("total")).value_or(0);
            }
            if (key.model.empty()) continue;
            ++grouped[key];
            const DriverKey driver = normalize_driver(string_value(gpu.find("driver")), key.vendor);
            if (!driver.name.empty()) ++driver_counts[driver];
        }
    }

    Json::array hardware;
    for (const auto& [key, count] : grouped) {
        Json::object gpu;
        add_string(gpu, "vendor", key.vendor);
        add_string(gpu, "model", key.model);
        add_string(gpu, "type", key.type);
        if (key.memory > 0) gpu.emplace("memory_bytes", key.memory);
        gpu.emplace("count", count);
        hardware.emplace_back(std::move(gpu));
    }

    Json::array software;
    for (const auto& [key, count] : driver_counts) {
        Json::object driver;
        add_string(driver, "vendor", key.vendor);
        add_string(driver, "name", key.name);
        add_string(driver, "variant", key.variant);
        add_string(driver, "version", key.version);
        driver.emplace("device_count", count);
        software.emplace_back(std::move(driver));
    }
    return {std::move(hardware), std::move(software)};
}

Json::object normalize_os(const Json* input) {
    Json::object output;
    if (input == nullptr || !input->is_object()) return output;
    std::string name = string_value(input->find("id"));
    if (name.empty()) name = string_value(input->find("name"));
    if (name.empty()) name = string_value(input->find("prettyName"));
    std::string version = string_value(input->find("versionID"));
    if (version.empty()) version = string_value(input->find("version"));
    if (name.empty()) return {};
    output.emplace("name", std::move(name));
    add_string(output, "version", version);
    return output;
}

std::pair<std::string, Json::object> normalize_kernel(const Json* input) {
    if (input == nullptr || !input->is_object()) throw std::runtime_error("Fastfetch Kernel result is missing");
    const std::string architecture = normalize_architecture(string_value(input->find("architecture")));
    if (architecture.empty()) throw std::runtime_error("Fastfetch kernel architecture is missing");
    Json::object output;
    add_string(output, "name", lowercase(string_value(input->find("name"))));
    add_string(output, "version", string_value(input->find("release")));
    if (output.empty()) throw std::runtime_error("Fastfetch kernel name and version are missing");
    return {architecture, std::move(output)};
}

std::string normalize_version(const Json* input) {
    if (input == nullptr) return {};
    if (input->is_string()) return string_value(input);
    if (!input->is_object()) return {};
    return string_value(input->find("version"));
}

} // namespace

Json normalize_fastfetch(const Json& fastfetch) {
    const Modules modules = collect_modules(fastfetch);
    std::vector<std::string> warning_messages;

    Json::object hardware;
    hardware.emplace("cpu", normalize_cpu(modules.cpu.value));
    append_module_warning(modules.cpu, "cpu", warning_messages);
    auto [architecture, kernel] = normalize_kernel(modules.kernel.value);
    append_module_warning(modules.kernel, "kernel", warning_messages);
    hardware.emplace("architecture", architecture);

    const MemoryNormalization memory = normalize_memory(modules, warning_messages);
    if (memory.total_bytes) hardware.emplace("memory", Json::object{{"total_bytes", *memory.total_bytes}});

    auto [gpus, gpu_drivers] = normalize_gpus(modules.gpu.value);
    if (!gpus.empty()) hardware.emplace("gpu", std::move(gpus));
    append_module_warning(modules.gpu, "gpu", warning_messages, true);
    append_module_warning(modules.os, "os", warning_messages);

    Json::object platform;
    Json::object os = normalize_os(modules.os.value);
    if (!os.empty()) platform.emplace("os", std::move(os));
    if (!kernel.empty()) platform.emplace("kernel", std::move(kernel));

    Json::object software;
    software.emplace("platform", std::move(platform));
    if (!gpu_drivers.empty()) software.emplace("gpu_drivers", std::move(gpu_drivers));

    Json::object collector{{"name", "fastfetch"}};
    const std::string version = normalize_version(modules.version.value);
    if (!version.empty()) collector.emplace("version", version);
    append_module_warning(modules.version, "version", warning_messages);

    Json::array warnings;
    warnings.reserve(warning_messages.size());
    for (std::string& warning : warning_messages) warnings.emplace_back(std::move(warning));
    Json::object diagnostics{{"memory_source", memory.source}, {"warnings", std::move(warnings)}};
    if (memory.visible_bytes) diagnostics.emplace("memory_visible_bytes", *memory.visible_bytes);

    return Json::object{
        {"schema_version", 2},
        {"hardware", std::move(hardware)},
        {"software", std::move(software)},
        {"diagnostics", std::move(diagnostics)},
        {"collector", std::move(collector)},
    };
}

} // namespace benchledger::probe
