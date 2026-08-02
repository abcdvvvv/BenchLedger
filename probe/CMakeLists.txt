cmake_minimum_required(VERSION 3.25)
project(benchledger_probe VERSION 0.2.2 LANGUAGES CXX)

set(CMAKE_CXX_EXTENSIONS OFF)

option(BENCHLEDGER_PROBE_BUILD_TESTS "Build benchledger-probe tests" ON)

if(MSVC)
    add_compile_options(/W4 /permissive- /EHsc)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
endif()

add_library(benchledger_probe_core STATIC
    src/json.cpp
    src/normalize.cpp
    src/process.cpp)
target_include_directories(benchledger_probe_core PUBLIC include)
target_compile_features(benchledger_probe_core PUBLIC cxx_std_23)

add_executable(benchledger-probe src/main.cpp)
target_link_libraries(benchledger-probe PRIVATE benchledger_probe_core)
target_compile_definitions(benchledger-probe PRIVATE
    BENCHLEDGER_PROBE_VERSION="${PROJECT_VERSION}")

include(GNUInstallDirs)
install(TARGETS benchledger-probe RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES probe-v2.schema.json DESTINATION ${CMAKE_INSTALL_DATADIR}/benchledger-probe)

if(BENCHLEDGER_PROBE_BUILD_TESTS)
    enable_testing()

    add_executable(benchledger_probe_tests tests/probe_tests.cpp)
    target_link_libraries(benchledger_probe_tests PRIVATE benchledger_probe_core)
    target_compile_definitions(benchledger_probe_tests PRIVATE
        BENCHLEDGER_PROBE_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures")

    add_executable(benchledger_fake_fastfetch tests/fake_fastfetch.cpp)
    target_compile_definitions(benchledger_fake_fastfetch PRIVATE
        BENCHLEDGER_FAKE_FASTFETCH_FIXTURE="${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures/linux.json")

    add_executable(benchledger_fake_fastfetch_fail tests/fake_fastfetch.cpp)
    target_compile_definitions(benchledger_fake_fastfetch_fail PRIVATE
        BENCHLEDGER_FAKE_FASTFETCH_FAIL=1)

    add_test(NAME benchledger_probe_tests COMMAND benchledger_probe_tests)
    add_test(NAME benchledger_probe_cli_linux_fixture
        COMMAND benchledger-probe --input ${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures/linux.json)
    add_test(NAME benchledger_probe_cli_process
        COMMAND benchledger-probe --fastfetch $<TARGET_FILE:benchledger_fake_fastfetch>)
    add_test(NAME benchledger_probe_cli_process_failure
        COMMAND benchledger-probe --fastfetch $<TARGET_FILE:benchledger_fake_fastfetch_fail>)
    set_tests_properties(benchledger_probe_cli_process_failure PROPERTIES WILL_FAIL TRUE)
endif()
