import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import type { EnvironmentId, RuntimeMode } from "@t3tools/contracts";
import { type LucideIcon, LockIcon, PenLineIcon, ShieldOffIcon, SparklesIcon } from "lucide-react";

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
    // An open lock reads like a closed one at small sizes; a crossed shield does not.
    icon: ShieldOffIcon,
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

/**
 * The offered modes a provider supports (all offered when it reports none) and
 * the mode a thread really runs in. Pass `useRuntimeModeOptions` for a thread.
 */
export function resolveCompatibleRuntimeMode(
  runtimeMode: RuntimeMode,
  supportedRuntimeModes: ReadonlyArray<RuntimeMode> | undefined,
  offeredModes: ReadonlyArray<RuntimeMode> = runtimeModeOptions,
) {
  const modes =
    supportedRuntimeModes && supportedRuntimeModes.length > 0
      ? offeredModes.filter((mode) => supportedRuntimeModes.includes(mode))
      : offeredModes;
  return { modes, mode: modes.includes(runtimeMode) ? runtimeMode : (modes[0] ?? runtimeMode) };
}
