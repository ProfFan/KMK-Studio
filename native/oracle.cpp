// Test-only adapter: executes upstream Karabiner's event-queue harness.
// Never opens a virtual device, changes a profile, or injects system events.
#include "test_clock.hpp"
#include "manipulator_helper.hpp"
#include "tests/src/share/json_helper.hpp"
#include "dispatcher_utility.hpp"
#include "run_loop_thread_utility.hpp"
#include <iostream>

int main(int argc, char** argv) {
  if (argc != 2) { std::cerr << "usage: kmk-oracle suite.json\n"; return 2; }
  try {
    auto dispatchers = krbn::dispatcher_utility::initialize_dispatchers();
    auto runloops = krbn::run_loop_thread_utility::initialize_scoped_run_loop_thread_manager(
      pqrs::cf::run_loop_thread::failure_policy::abort);
    auto helper = std::make_unique<krbn::unit_testing::manipulator_helper>();
    // Capture actual engine output. TypeScript compares it to independent expectations.
    helper->run_tests(krbn::unit_testing::json_helper::load_jsonc(argv[1]), true);
    helper.reset();
    return 0;
  } catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
