import {
  BearerConnectionTarget,
  type ConnectionTarget,
  PrimaryConnectionTarget,
  SshConnectionTarget,
} from "@t3tools/client-runtime/connection";
import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { desktopLocalConnectionId } from "../../connection/desktopLocal";
import { resolveCompatibleRuntimeMode, resolveRuntimeModeOptions } from "./runtimeModeConfig";

const primary = EnvironmentId.make("environment-primary");
const other = EnvironmentId.make("environment-other");

const optionsFor = (environmentId: EnvironmentId, target: ConnectionTarget | undefined) =>
  resolveRuntimeModeOptions({ environmentId, primaryEnvironmentId: primary, target });

describe("runtime mode options", () => {
  it("offers full access on a remote environment", () => {
    const target = new SshConnectionTarget({
      connectionId: "ssh:build-box",
      environmentId: other,
      label: "Build box",
    });

    expect(optionsFor(other, target)).toContain("full-access");
  });

  it("withholds full access on this machine", () => {
    const primaryTarget = new PrimaryConnectionTarget({
      environmentId: primary,
      httpBaseUrl: "http://127.0.0.1:3773",
      label: "This device",
      wsBaseUrl: "ws://127.0.0.1:3773",
    });
    const desktopLocalTarget = new BearerConnectionTarget({
      connectionId: desktopLocalConnectionId("wsl:Ubuntu"),
      environmentId: other,
      label: "WSL (Ubuntu)",
    });

    expect(optionsFor(primary, primaryTarget)).toEqual([
      "approval-required",
      "auto-accept-edits",
      "auto",
    ]);
    expect(optionsFor(other, desktopLocalTarget)).not.toContain("full-access");
    expect(optionsFor(other, undefined)).not.toContain("full-access");
  });

  it("keeps a full access thread only where full access is offered", () => {
    const supported = ["approval-required", "full-access"] as const;
    const remote = resolveCompatibleRuntimeMode("full-access", supported, [
      "approval-required",
      "full-access",
    ]);
    const local = resolveCompatibleRuntimeMode("full-access", supported);

    expect(remote).toEqual({ modes: ["approval-required", "full-access"], mode: "full-access" });
    expect(local).toEqual({ modes: ["approval-required"], mode: "approval-required" });
  });
});
