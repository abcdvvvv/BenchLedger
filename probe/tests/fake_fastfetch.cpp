#include <fstream>
#include <iostream>
#include <stdexcept>

#ifndef BENCHLEDGER_FAKE_FASTFETCH_FIXTURE
#define BENCHLEDGER_FAKE_FASTFETCH_FIXTURE ""
#endif

int main() {
#ifdef BENCHLEDGER_FAKE_FASTFETCH_FAIL
    std::cerr << "simulated Fastfetch failure\n";
    return 23;
#else
    std::ifstream stream(BENCHLEDGER_FAKE_FASTFETCH_FIXTURE, std::ios::binary);
    if (!stream) return 24;
    std::cout << stream.rdbuf();
    return std::cout ? 0 : 25;
#endif
}
