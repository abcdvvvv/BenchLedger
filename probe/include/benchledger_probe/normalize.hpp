#pragma once

#include "benchledger_probe/json.hpp"

namespace benchledger::probe {

[[nodiscard]] Json normalize_fastfetch(const Json& fastfetch);

} // namespace benchledger::probe
