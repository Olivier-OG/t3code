import { environmentMachineLocality } from "@t3tools/client-runtime/connection";
import type { EnvironmentId, RuntimeModeMachineLocality } from "@t3tools/contracts";
import { useMemo } from "react";

import { useEnvironments } from "./environments";

/**
 * Where an environment runs its work, which is what this fork asks before it
 * offers the runtime modes that skip approvals. The phone never hosts an
 * environment of its own, so it recognises SSH environments and leaves the
 * rest unplaceable — it narrows the picker without rewriting a mode chosen
 * from a client that could place the machine.
 */
export function useEnvironmentMachineLocality(
  environmentId: EnvironmentId | null,
): RuntimeModeMachineLocality {
  const { presentationById } = useEnvironments();
  const target =
    environmentId === null ? undefined : presentationById.get(environmentId)?.entry.target;
  return useMemo(
    () =>
      target === undefined
        ? "unknown"
        : environmentMachineLocality({
            target,
            hasPrimaryEnvironment: false,
            isHostLocalBackend: false,
          }),
    [target],
  );
}
