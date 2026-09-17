import {
  runtimeModesForMachine,
  type ProviderOptionDescriptor,
  type RuntimeMode,
  type RuntimeModeMachineLocality,
} from "@t3tools/contracts";

/**
 * Desktop-oriented effort keywords that don't belong in the phone picker.
 * Prompt-injected values (ultrathink and friends) are filtered from the
 * descriptor metadata; ultracode is a real option but a workflow trigger, not
 * a reasoning level. A value set elsewhere still displays, it just isn't
 * offered.
 */
const HIDDEN_EFFORT_OPTION_IDS: ReadonlySet<string> = new Set(["ultracode"]);

interface RuntimeModeChoice {
  readonly mode: RuntimeMode;
  readonly label: string;
  readonly description: string;
}

const RUNTIME_MODE_CHOICES: ReadonlyArray<RuntimeModeChoice> = [
  {
    mode: "approval-required",
    label: "Supervised",
    description: "Ask before commands and file changes.",
  },
  {
    mode: "auto-accept-edits",
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
  },
  {
    mode: "auto",
    label: "Auto",
    description: "Supported providers approve routine actions; others still ask.",
  },
  {
    mode: "full-access",
    label: "Full access",
    description: "Allow commands and edits without prompts.",
  },
];

/**
 * This fork offers the modes that skip approvals only for work that runs on
 * another machine, so the picker follows the thread's environment.
 */
export function runtimeModeChoices(
  locality: RuntimeModeMachineLocality,
): ReadonlyArray<RuntimeModeChoice> {
  const allowed = runtimeModesForMachine(locality);
  return RUNTIME_MODE_CHOICES.filter((choice) => allowed.includes(choice.mode));
}

export function runtimeModeChoiceLabel(mode: RuntimeMode): string | undefined {
  return RUNTIME_MODE_CHOICES.find((choice) => choice.mode === mode)?.label;
}

export function selectableChoices(
  descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>,
) {
  const injected = new Set(descriptor.promptInjectedValues ?? []);
  return descriptor.options.filter(
    (option) => !injected.has(option.id) && !HIDDEN_EFFORT_OPTION_IDS.has(option.id),
  );
}
