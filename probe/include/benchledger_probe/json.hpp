#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace benchledger::probe {

class Json {
public:
    using array = std::vector<Json>;
    using object = std::map<std::string, Json, std::less<>>;
    using value = std::variant<std::nullptr_t, bool, std::int64_t, std::uint64_t, double, std::string, array, object>;

    Json() : value_(nullptr) {}
    Json(std::nullptr_t) : value_(nullptr) {}
    Json(bool input) : value_(input) {}
    Json(std::int64_t input) : value_(input) {}
    Json(std::uint64_t input) : value_(input) {}
    Json(int input) : value_(static_cast<std::int64_t>(input)) {}
    Json(double input) : value_(input) {}
    Json(std::string input) : value_(std::move(input)) {}
    Json(const char* input) : value_(std::string(input)) {}
    Json(array input) : value_(std::move(input)) {}
    Json(object input) : value_(std::move(input)) {}

    [[nodiscard]] static Json parse(std::string_view input);
    [[nodiscard]] std::string dump(bool pretty = false) const;

    [[nodiscard]] bool is_bool() const;
    [[nodiscard]] bool is_number() const;
    [[nodiscard]] bool is_string() const;
    [[nodiscard]] bool is_array() const;
    [[nodiscard]] bool is_object() const;

    [[nodiscard]] bool as_bool() const;
    [[nodiscard]] std::uint64_t as_uint64() const;
    [[nodiscard]] const std::string& as_string() const;
    [[nodiscard]] const array& as_array() const;
    [[nodiscard]] array& as_array();

    [[nodiscard]] const Json* find(std::string_view key) const;

    [[nodiscard]] const value& raw() const { return value_; }

private:
    value value_;
};

} // namespace benchledger::probe
