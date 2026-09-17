import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import type { EnvironmentId, RuntimeMode } from "@t3tools/contracts";
import { type LucideIcon, LockIcon, LockOpenIcon, PenLineIcon, SparklesIcon } from "lucide-react";

import { isDesktopLocalConnectionTarget } from "../../connection/desktopLocal";
import { useEnvironment, usePrimaryEnvironmentId } from "../../state/environments";

export const runtimeModeConfig: Record<
  RuntimeMode,
  { label: string; description: string; icon: LucideIcon }
> = {
  "approval-required": {
    label: "Supervised",
    description: "Ask before commands and file changes.",
    icon: LockIcon,
  },
  "auto-accept-edits": {
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    icon: PenLineIcon,
  },
  auto: {
    label: "Auto",
    description: "Supported providers approve routine actions; others still ask.",
    icon: SparklesIcon,
  },
  "full-access": {
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    icon: LockOpenIcon,
  },
};

export const runtimeModeOptions: RuntimeMode[] = ["approval-required", "auto-accept-edits", "auto"];

const remoteRuntimeModeOptions: readonly RuntimeMode[] = [...runtimeModeOptions, "full-access"];

/**
 * The runtime modes offered for a thread. Full access lets an agent run
 * anything unprompted, so it is offered only on environments that are not the
 * machine this client runs on. An environment whose target has not resolved yet
 * counts as local.
 */
export function resolveRuntimeModeOptions(input: {
  environmentId: EnvironmentId | null;
  primaryEnvironmentId: EnvironmentId | null;
  target: ConnectionTarget | undefined;
}): readonly RuntimeMode[] {
  const isRemote =
    input.environmentId !== null &&
    input.environmentId !== input.primaryEnvironmentId &&
    input.target !== undefined &&
    input.target._tag !== "PrimaryConnectionTarget" &&
    !isDesktopLocalConnectionTarget(input.target);
  return isRemote ? remoteRuntimeModeOptions : runtimeModeOptions;
}

export function useRuntimeModeOptions(environmentId: EnvironmentId | null): readonly RuntimeMode[] {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environment = useEnvironment(environmentId);
  return resolveRuntimeModeOptions({
    environmentId,
    primaryEnvironmentId,
    target: environment?.entry.target,
  });
}
