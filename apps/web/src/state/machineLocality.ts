import { environmentMachineLocality } from "@t3tools/client-runtime/connection";
import type { EnvironmentId, RuntimeModeMachineLocality } from "@t3tools/contracts";
import { useMemo } from "react";

import { isDesktopLocalConnectionTarget } from "../connection/desktopLocal";
import { useEnvironment, useEnvironments, usePrimaryEnvironmentId } from "./environments";

/**
 * Where an environment runs its work, which is what this fork asks before it
 * offers the runtime modes that skip approvals. An environment the catalog has
 * not resolved yet is unplaceable rather than local.
 */
export function useEnvironmentMachineLocality(
  environmentId: EnvironmentId | null,
): RuntimeModeMachineLocality {
  const environment = useEnvironment(environmentId);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const target = environment?.entry.target ?? null;
  return useMemo(
    () =>
      target === null
        ? "unknown"
        : environmentMachineLocality({
            target,
            hasPrimaryEnvironment: primaryEnvironmentId !== null,
            isHostLocalBackend: isDesktopLocalConnectionTarget(target),
          }),
    [primaryEnvironmentId, target],
  );
}

/**
 * The same question for a settings scope, which can span several environments.
 * A scope is only as permissive as its least remote member.
 */
export function useScopeMachineLocality(
  environmentIds: ReadonlyArray<EnvironmentId>,
): RuntimeModeMachineLocality {
  const { presentationById } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  return useMemo(() => {
    if (environmentIds.length === 0) return "unknown";
    let scoped: RuntimeModeMachineLocality = "remote";
    for (const environmentId of environmentIds) {
      const target = presentationById.get(environmentId)?.entry.target;
      const locality: RuntimeModeMachineLocality =
        target === undefined
          ? "unknown"
          : environmentMachineLocality({
              target,
              hasPrimaryEnvironment: primaryEnvironmentId !== null,
              isHostLocalBackend: isDesktopLocalConnectionTarget(target),
            });
      if (locality === "host") return "host";
      if (locality === "unknown") scoped = "unknown";
    }
    return scoped;
  }, [environmentIds, presentationById, primaryEnvironmentId]);
}
