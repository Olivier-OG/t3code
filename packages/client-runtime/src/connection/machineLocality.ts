import type { RuntimeModeMachineLocality } from "@t3tools/contracts";

import type { ConnectionTarget } from "./model.ts";

/**
 * Where an environment's work runs relative to this client. Fork-only: it
 * gates which runtime modes a client offers (see `runtimeModesForMachine` in
 * the contracts).
 *
 * Only SSH answers this on its own — every other target kind describes how
 * this client reached a server, not where that server sits. A client that owns
 * a primary environment is running on the host machine, so anything it reached
 * some other way is another machine. A client with no primary (the hosted web
 * app, mobile) is itself the remote end and cannot place anything else.
 */
export function environmentMachineLocality(input: {
  readonly target: ConnectionTarget;
  /** This client hosts its own primary environment. */
  readonly hasPrimaryEnvironment: boolean;
  /** Host-managed local backend registered as a bearer connection, such as WSL. */
  readonly isHostLocalBackend: boolean;
}): RuntimeModeMachineLocality {
  if (input.target._tag === "SshConnectionTarget") return "remote";
  if (input.target._tag === "PrimaryConnectionTarget") return "host";
  if (!input.hasPrimaryEnvironment) return "unknown";
  return input.isHostLocalBackend ? "host" : "remote";
}
