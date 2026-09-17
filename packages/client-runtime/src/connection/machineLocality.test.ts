import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { environmentMachineLocality } from "./machineLocality.ts";
import {
  BearerConnectionTarget,
  PrimaryConnectionTarget,
  RelayConnectionTarget,
  SshConnectionTarget,
} from "./model.ts";

const environmentId = EnvironmentId.make("environment-1");

const PRIMARY = new PrimaryConnectionTarget({
  environmentId,
  label: "This machine",
  httpBaseUrl: "http://127.0.0.1:3000",
  wsBaseUrl: "ws://127.0.0.1:3000",
});
const BEARER = new BearerConnectionTarget({
  environmentId,
  label: "Saved environment",
  connectionId: "connection-1",
});
const RELAY = new RelayConnectionTarget({ environmentId, label: "Tunnelled environment" });
const SSH = new SshConnectionTarget({
  environmentId,
  label: "Build box",
  connectionId: "connection-2",
});

describe("environmentMachineLocality", () => {
  it("places an SSH environment on another machine from any client", () => {
    for (const hasPrimaryEnvironment of [true, false]) {
      expect(
        environmentMachineLocality({
          target: SSH,
          hasPrimaryEnvironment,
          isHostLocalBackend: false,
        }),
      ).toBe("remote");
    }
  });

  it("places the primary and host-managed local backends on the host device", () => {
    expect(
      environmentMachineLocality({
        target: PRIMARY,
        hasPrimaryEnvironment: true,
        isHostLocalBackend: false,
      }),
    ).toBe("host");
    expect(
      environmentMachineLocality({
        target: BEARER,
        hasPrimaryEnvironment: true,
        isHostLocalBackend: true,
      }),
    ).toBe("host");
  });

  it("places other saved environments on another machine when this client hosts T3 Code", () => {
    expect(
      environmentMachineLocality({
        target: BEARER,
        hasPrimaryEnvironment: true,
        isHostLocalBackend: false,
      }),
    ).toBe("remote");
    expect(
      environmentMachineLocality({
        target: RELAY,
        hasPrimaryEnvironment: true,
        isHostLocalBackend: false,
      }),
    ).toBe("remote");
  });

  it("cannot place anything but SSH from a client with no environment of its own", () => {
    // The hosted web app and mobile reach the host device the same way they
    // reach anything else, so a relay or bearer target says nothing.
    expect(
      environmentMachineLocality({
        target: RELAY,
        hasPrimaryEnvironment: false,
        isHostLocalBackend: false,
      }),
    ).toBe("unknown");
    expect(
      environmentMachineLocality({
        target: BEARER,
        hasPrimaryEnvironment: false,
        isHostLocalBackend: false,
      }),
    ).toBe("unknown");
  });
});
