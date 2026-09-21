#pragma once
#include <atomic>
#include <chrono>

// Test-only clock seam. Keep an epoch-sized value to exercise KE's int64
// expression values, while tying wall-clock expressions to dispatcher time.
namespace kmk_test_clock {
inline std::atomic<int64_t> elapsed_ms{0};
inline auto now() {
  return std::chrono::system_clock::time_point(
      std::chrono::milliseconds(1700000000000LL + elapsed_ms.load()));
}
}
