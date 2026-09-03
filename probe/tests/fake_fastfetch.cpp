#include <fstream>
#include <chrono>
#include <iostream>
#include <stdexcept>
#include <thread>

#ifndef BENCHLEDGER_FAKE_FASTFETCH_FIXTURE
#define BENCHLEDGER_FAKE_FASTFETCH_FIXTURE ""
#endif

int main() {
#ifdef BENCHLEDGER_FAKE_FASTFETCH_HANG
    std::this_thread::sleep_for(std::chrono::seconds(5));
    return 0;
#elif defined(BENCHLEDGER_FAKE_FASTFETCH_LARGE_OUTPUT)
    for (int i = 0; i < 4096; ++i) std::cout.put('x');
    return std::cout ? 0 : 25;
#elif defined(BENCHLEDGER_FAKE_FASTFETCH_FAIL)
    std::cerr << "simulated Fastfetch failure\n";
    return 23;
#else
    std::ifstream stream(BENCHLEDGER_FAKE_FASTFETCH_FIXTURE, std::ios::binary);
    if (!stream) return 24;
    std::cout << stream.rdbuf();
    return std::cout ? 0 : 25;
#endif
}
