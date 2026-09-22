import type {
  DeviceFilter,
  DeviceIdentifier,
  InputEvent,
  Project,
} from "@kmk/compiler";
import { fixtureProject, scenarios } from "./fixtures.ts";
import { oneShotProject, oneShotScenarios } from "./oneshot-fixtures.ts";

export interface DeviceScenario {
  name: string;
  project: Project;
  events: InputEvent[];
  device?: DeviceIdentifier;
  matches: boolean;
}
export function deviceScenarios(): DeviceScenario[] {
  const cases: DeviceScenario[] = [];
  const filters: {
    filter: DeviceFilter;
    devices: { name: string; device?: DeviceIdentifier; matches: boolean }[];
  }[] = [
    {
      filter: { type: "vendor_product", vendorId: 1452, productId: 832 },
      devices: [
        {
          name: "matching IDs",
          device: { vendor_id: 1452, product_id: 832 },
          matches: true,
        },
        {
          name: "other product",
          device: { vendor_id: 1452, product_id: 833 },
          matches: false,
        },
        {
          name: "other vendor",
          device: { vendor_id: 1453, product_id: 832 },
          matches: false,
        },
        { name: "unknown device", matches: false },
      ],
    },
    {
      filter: { type: "built_in_keyboard" },
      devices: [
        {
          name: "built-in",
          device: { is_built_in_keyboard: true },
          matches: true,
        },
        {
          name: "external",
          device: { is_built_in_keyboard: false },
          matches: false,
        },
        { name: "unknown device", matches: false },
      ],
    },
  ];
  for (const { filter, devices } of filters) {
    for (const fixture of [
      {
        project: fixtureProject(),
        traces: Object.entries(scenarios).map(([name, events]) => ({
          name,
          events,
        })),
      },
      {
        project: oneShotProject(300),
        traces: Object.entries(oneShotScenarios).map(([name, { events }]) => ({
          name,
          events,
        })),
      },
    ]) {
      const project = { ...fixture.project, deviceFilter: filter };
      for (const device of devices)
        for (const trace of fixture.traces)
          cases.push({
            ...trace,
            ...device,
            project,
            name: `${filter.type}: ${device.name} / ${trace.name}`,
          });
    }
  }
  return cases;
}
