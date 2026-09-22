"""Adapt the upstream test harness and inject a deterministic expression clock.

The stock harness constructs default parameters instead of reading per-rule
parameters, and doesn't export environment state or register synthetic devices.
The cached additions let KMK exercise exported assets and compare cleanup and
device selection. The only engine seam replaces its
system-clock read; expression evaluation and manipulation are unchanged.
Upstream license remains in cache.
"""
from pathlib import Path
root = Path('.cache/karabiner')
text = (root / 'tests/src/share/manipulator_helper.hpp').read_text()
needle = 'auto parameters = std::make_shared<core_configuration::details::complex_modifications_parameters>();'
assert text.count(needle) == 1
text = text.replace(needle, needle + '\n            if (j.contains("parameters")) parameters->update(j["parameters"], core_configuration::error_handling::strict);')
needle = '      // Run manipulators'
assert text.count(needle) == 1
text = text.replace(needle, '''      // Register synthetic hardware properties in each queue's real environment.
      // Built-in status is derived by upstream device_properties, not mocked.
      if (test.contains("kmk_device")) {
        auto device = krbn::device_properties::make_device_properties(test["kmk_device"]);
        for (auto& queue : *event_queues) {
          queue->get_manipulator_environment().insert_device_properties(krbn::device_id(1), device);
        }
      }

''' + needle)
needle = '      input_event_arrived_connection.disconnect();'
assert text.count(needle) == 1
text = text.replace(needle, '''      if (test.contains("kmk_variables")) {
        std::ofstream vars(test["kmk_variables"].get<std::string>());
        nlohmann::json state;
        state["variables"] = (*event_queues)[1]->get_manipulator_environment().to_json()["variables"];
        state["activeModifierFlags"] = (*event_queues)[1]->get_modifier_flag_manager().active_modifier_flags_size();
        vars << state.dump();
      }
''' + needle)
needle = '      pseudo_time_source_->set_now(pqrs::dispatcher::time_point(std::chrono::milliseconds(0)));'
assert text.count(needle) == 1
text = text.replace(needle, needle + '\n      kmk_test_clock::elapsed_ms = 0;')
needle = '      pseudo_time_source_->set_now(pqrs::dispatcher::time_point(ms));'
assert text.count(needle) == 1
text = text.replace(needle, needle + '\n      kmk_test_clock::elapsed_ms = ms.count();')
Path('.cache/native/manipulator_helper.hpp').write_text(text)
engine = (root / 'src/share/manipulator/manipulator_environment.hpp').read_text()
needle = 'auto now = std::chrono::system_clock::now();'
assert engine.count(needle) == 1
engine = engine.replace(needle, 'auto now = kmk_test_clock::now();')
shadow = Path('.cache/native/manipulator/manipulator_environment.hpp')
shadow.parent.mkdir(parents=True, exist_ok=True)
shadow.write_text(engine)
