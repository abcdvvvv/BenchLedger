#include "benchledger_probe/json.hpp"

#include <charconv>
#include <cmath>
#include <limits>
#include <locale>
#include <sstream>
#include <stdexcept>

namespace benchledger::probe {
namespace {

class Parser {
public:
    explicit Parser(std::string_view input) : input_(input) {}

    Json parse_document() {
        skip_space();
        Json result = parse_value(0);
        skip_space();
        if (position_ != input_.size()) fail("unexpected trailing data");
        return result;
    }

private:
    std::string_view input_;
    std::size_t position_{};
    static constexpr std::size_t Max_Nesting_Depth = 256;

    [[noreturn]] void fail(const std::string& message) const {
        throw std::runtime_error("JSON parse error at byte " + std::to_string(position_) + ": " + message);
    }

    void skip_space() {
        while (position_ < input_.size()) {
            const char c = input_[position_];
            if (c != ' ' && c != '\t' && c != '\r' && c != '\n') break;
            ++position_;
        }
    }

    bool consume(char expected) {
        if (position_ < input_.size() && input_[position_] == expected) {
            ++position_;
            return true;
        }
        return false;
    }

    void expect(char expected) {
        if (!consume(expected)) fail(std::string("expected '") + expected + "'");
    }

    Json parse_value(std::size_t depth) {
        if (position_ >= input_.size()) fail("expected a value");
        switch (input_[position_]) {
            case 'n': parse_literal("null"); return nullptr;
            case 't': parse_literal("true"); return true;
            case 'f': parse_literal("false"); return false;
            case '"': return parse_string();
            case '[':
                if (depth >= Max_Nesting_Depth) fail("maximum nesting depth exceeded");
                return parse_array(depth + 1);
            case '{':
                if (depth >= Max_Nesting_Depth) fail("maximum nesting depth exceeded");
                return parse_object(depth + 1);
            default:
                if (input_[position_] == '-' || (input_[position_] >= '0' && input_[position_] <= '9')) return parse_number();
                fail("invalid value");
        }
    }

    void parse_literal(std::string_view literal) {
        if (input_.substr(position_, literal.size()) != literal) fail("invalid literal");
        position_ += literal.size();
    }

    static void append_utf8(std::string& output, std::uint32_t codepoint) {
        if (codepoint <= 0x7F) output.push_back(static_cast<char>(codepoint));
        else if (codepoint <= 0x7FF) {
            output.push_back(static_cast<char>(0xC0U | (codepoint >> 6U)));
            output.push_back(static_cast<char>(0x80U | (codepoint & 0x3FU)));
        } else if (codepoint <= 0xFFFF) {
            output.push_back(static_cast<char>(0xE0U | (codepoint >> 12U)));
            output.push_back(static_cast<char>(0x80U | ((codepoint >> 6U) & 0x3FU)));
            output.push_back(static_cast<char>(0x80U | (codepoint & 0x3FU)));
        } else if (codepoint <= 0x10FFFF) {
            output.push_back(static_cast<char>(0xF0U | (codepoint >> 18U)));
            output.push_back(static_cast<char>(0x80U | ((codepoint >> 12U) & 0x3FU)));
            output.push_back(static_cast<char>(0x80U | ((codepoint >> 6U) & 0x3FU)));
            output.push_back(static_cast<char>(0x80U | (codepoint & 0x3FU)));
        } else throw std::runtime_error("invalid Unicode code point");
    }

    void append_raw_utf8(std::string& output, unsigned char first) {
        std::size_t continuationCount = 0;
        unsigned char secondMin = 0x80;
        unsigned char secondMax = 0xBF;
        if (first >= 0xC2 && first <= 0xDF) continuationCount = 1;
        else if (first >= 0xE0 && first <= 0xEF) {
            continuationCount = 2;
            if (first == 0xE0) secondMin = 0xA0;
            else if (first == 0xED) secondMax = 0x9F;
        } else if (first >= 0xF0 && first <= 0xF4) {
            continuationCount = 3;
            if (first == 0xF0) secondMin = 0x90;
            else if (first == 0xF4) secondMax = 0x8F;
        } else fail("invalid UTF-8 sequence");

        if (position_ + continuationCount > input_.size()) fail("incomplete UTF-8 sequence");
        const auto second = static_cast<unsigned char>(input_[position_]);
        if (second < secondMin || second > secondMax) fail("invalid UTF-8 sequence");
        for (std::size_t i = 1; i < continuationCount; ++i) {
            const auto continuation = static_cast<unsigned char>(input_[position_ + i]);
            if (continuation < 0x80 || continuation > 0xBF) fail("invalid UTF-8 sequence");
        }
        output.push_back(static_cast<char>(first));
        output.append(input_.substr(position_, continuationCount));
        position_ += continuationCount;
    }

    std::uint32_t parse_hex4() {
        if (position_ + 4 > input_.size()) fail("incomplete Unicode escape");
        std::uint32_t value = 0;
        for (int i = 0; i < 4; ++i) {
            const char c = input_[position_++];
            value <<= 4U;
            if (c >= '0' && c <= '9') value |= static_cast<std::uint32_t>(c - '0');
            else if (c >= 'a' && c <= 'f') value |= static_cast<std::uint32_t>(c - 'a' + 10);
            else if (c >= 'A' && c <= 'F') value |= static_cast<std::uint32_t>(c - 'A' + 10);
            else fail("invalid Unicode escape");
        }
        return value;
    }

    std::string parse_string() {
        expect('"');
        std::string output;
        while (position_ < input_.size()) {
            const unsigned char c = static_cast<unsigned char>(input_[position_++]);
            if (c == '"') return output;
            if (c < 0x20) fail("unescaped control character in string");
            if (c != '\\') {
                if (c < 0x80) output.push_back(static_cast<char>(c));
                else append_raw_utf8(output, c);
                continue;
            }
            if (position_ >= input_.size()) fail("incomplete escape sequence");
            const char escape = input_[position_++];
            switch (escape) {
                case '"': output.push_back('"'); break;
                case '\\': output.push_back('\\'); break;
                case '/': output.push_back('/'); break;
                case 'b': output.push_back('\b'); break;
                case 'f': output.push_back('\f'); break;
                case 'n': output.push_back('\n'); break;
                case 'r': output.push_back('\r'); break;
                case 't': output.push_back('\t'); break;
                case 'u': {
                    std::uint32_t codepoint = parse_hex4();
                    if (codepoint >= 0xD800 && codepoint <= 0xDBFF) {
                        if (position_ + 2 > input_.size() || input_[position_] != '\\' || input_[position_ + 1] != 'u') fail("missing low surrogate");
                        position_ += 2;
                        const std::uint32_t low = parse_hex4();
                        if (low < 0xDC00 || low > 0xDFFF) fail("invalid low surrogate");
                        codepoint = 0x10000U + ((codepoint - 0xD800U) << 10U) + (low - 0xDC00U);
                    } else if (codepoint >= 0xDC00 && codepoint <= 0xDFFF) fail("unexpected low surrogate");
                    append_utf8(output, codepoint);
                    break;
                }
                default: fail("invalid escape sequence");
            }
        }
        fail("unterminated string");
    }

    Json parse_array(std::size_t depth) {
        expect('[');
        skip_space();
        Json::array result;
        if (consume(']')) return result;
        while (true) {
            skip_space();
            result.push_back(parse_value(depth));
            skip_space();
            if (consume(']')) return result;
            expect(',');
        }
    }

    Json parse_object(std::size_t depth) {
        expect('{');
        skip_space();
        Json::object result;
        if (consume('}')) return result;
        while (true) {
            skip_space();
            if (position_ >= input_.size() || input_[position_] != '"') fail("object key must be a string");
            std::string key = parse_string();
            skip_space();
            expect(':');
            skip_space();
            auto [_, inserted] = result.emplace(std::move(key), parse_value(depth));
            if (!inserted) fail("duplicate object key");
            skip_space();
            if (consume('}')) return result;
            expect(',');
        }
    }

    Json parse_number() {
        const std::size_t begin = position_;
        consume('-');
        if (consume('0')) {
            if (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') fail("leading zero in number");
        } else {
            if (position_ >= input_.size() || input_[position_] < '1' || input_[position_] > '9') fail("invalid number");
            while (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') ++position_;
        }
        bool floating = false;
        if (consume('.')) {
            floating = true;
            if (position_ >= input_.size() || input_[position_] < '0' || input_[position_] > '9') fail("invalid fraction");
            while (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') ++position_;
        }
        if (position_ < input_.size() && (input_[position_] == 'e' || input_[position_] == 'E')) {
            floating = true;
            ++position_;
            if (position_ < input_.size() && (input_[position_] == '+' || input_[position_] == '-')) ++position_;
            if (position_ >= input_.size() || input_[position_] < '0' || input_[position_] > '9') fail("invalid exponent");
            while (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') ++position_;
        }
        const std::string_view token = input_.substr(begin, position_ - begin);
        if (!floating) {
            if (!token.empty() && token.front() == '-') {
                std::int64_t value{};
                const auto [ptr, ec] = std::from_chars(token.data(), token.data() + token.size(), value);
                if (ec == std::errc{} && ptr == token.data() + token.size()) return value;
            } else {
                std::uint64_t value{};
                const auto [ptr, ec] = std::from_chars(token.data(), token.data() + token.size(), value);
                if (ec == std::errc{} && ptr == token.data() + token.size()) return value;
            }
        }
        double value{};
        std::istringstream stream{std::string(token)};
        stream.imbue(std::locale::classic());
        stream >> value;
        if (!stream || stream.peek() != std::char_traits<char>::eof() || !std::isfinite(value)) {
            fail("invalid or non-finite number");
        }
        return value;
    }
};

void append_indent(std::string& output, int depth) {
    output.append(static_cast<std::size_t>(depth) * 2U, ' ');
}

void dump_string(std::string& output, std::string_view value) {
    static constexpr char hex[] = "0123456789abcdef";
    output.push_back('"');
    for (const char raw : value) {
        const auto c = static_cast<unsigned char>(raw);
        switch (c) {
            case '"': output += "\\\""; break;
            case '\\': output += "\\\\"; break;
            case '\b': output += "\\b"; break;
            case '\f': output += "\\f"; break;
            case '\n': output += "\\n"; break;
            case '\r': output += "\\r"; break;
            case '\t': output += "\\t"; break;
            default:
                if (c < 0x20) {
                    output += "\\u00";
                    output.push_back(hex[c >> 4U]);
                    output.push_back(hex[c & 0x0FU]);
                } else output.push_back(static_cast<char>(c));
        }
    }
    output.push_back('"');
}

void dump_value(std::string& output, const Json& json, bool pretty, int depth) {
    const auto& value = json.raw();
    if (std::holds_alternative<std::nullptr_t>(value)) output += "null";
    else if (const auto* item = std::get_if<bool>(&value)) output += *item ? "true" : "false";
    else if (const auto* item = std::get_if<std::int64_t>(&value)) output += std::to_string(*item);
    else if (const auto* item = std::get_if<std::uint64_t>(&value)) output += std::to_string(*item);
    else if (const auto* item = std::get_if<double>(&value)) {
        char buffer[128];
        const auto [end, error] = std::to_chars(
            buffer, buffer + sizeof(buffer), *item,
            std::chars_format::general, std::numeric_limits<double>::max_digits10);
        if (error != std::errc{}) throw std::runtime_error("failed to serialize JSON number");
        output.append(buffer, end);
    } else if (const auto* item = std::get_if<std::string>(&value)) dump_string(output, *item);
    else if (const auto* items = std::get_if<Json::array>(&value)) {
        output.push_back('[');
        for (std::size_t i = 0; i < items->size(); ++i) {
            if (i != 0) output.push_back(',');
            if (pretty) { output.push_back('\n'); append_indent(output, depth + 1); }
            dump_value(output, (*items)[i], pretty, depth + 1);
        }
        if (pretty && !items->empty()) { output.push_back('\n'); append_indent(output, depth); }
        output.push_back(']');
    } else {
        const auto& members = std::get<Json::object>(value);
        output.push_back('{');
        std::size_t index = 0;
        for (const auto& [key, item] : members) {
            if (index++ != 0) output.push_back(',');
            if (pretty) { output.push_back('\n'); append_indent(output, depth + 1); }
            dump_string(output, key);
            output += pretty ? ": " : ":";
            dump_value(output, item, pretty, depth + 1);
        }
        if (pretty && !members.empty()) { output.push_back('\n'); append_indent(output, depth); }
        output.push_back('}');
    }
}

template <typename T>
const T& get_checked(const Json::value& value, const char* expected) {
    if (const auto* result = std::get_if<T>(&value)) return *result;
    throw std::runtime_error(std::string("JSON value is not ") + expected);
}

} // namespace

Json Json::parse(std::string_view input) { return Parser(input).parse_document(); }
std::string Json::dump(bool pretty) const { std::string output; output.reserve(256); dump_value(output, *this, pretty, 0); return output; }
bool Json::is_bool() const { return std::holds_alternative<bool>(value_); }
bool Json::is_number() const { return std::holds_alternative<std::int64_t>(value_) || std::holds_alternative<std::uint64_t>(value_) || std::holds_alternative<double>(value_); }
bool Json::is_string() const { return std::holds_alternative<std::string>(value_); }
bool Json::is_array() const { return std::holds_alternative<array>(value_); }
bool Json::is_object() const { return std::holds_alternative<object>(value_); }
bool Json::as_bool() const { return get_checked<bool>(value_, "a boolean"); }
std::uint64_t Json::as_uint64() const {
    if (const auto* value = std::get_if<std::uint64_t>(&value_)) return *value;
    if (const auto* value = std::get_if<std::int64_t>(&value_); value && *value >= 0) return static_cast<std::uint64_t>(*value);
    throw std::runtime_error("JSON number is not representable as uint64");
}
const std::string& Json::as_string() const { return get_checked<std::string>(value_, "a string"); }
const Json::array& Json::as_array() const { return get_checked<array>(value_, "an array"); }
Json::array& Json::as_array() { if (auto* result = std::get_if<array>(&value_)) return *result; throw std::runtime_error("JSON value is not an array"); }
const Json* Json::find(std::string_view key) const {
    const auto* object_value = std::get_if<object>(&value_);
    if (object_value == nullptr) return nullptr;
    const auto it = object_value->find(key);
    return it == object_value->end() ? nullptr : &it->second;
}

} // namespace benchledger::probe
