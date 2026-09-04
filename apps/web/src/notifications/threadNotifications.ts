/**
 * Deciding which threads deserve a native notification.
 *
 * A notification is worth sending when a thread *changes* into a state that
 * wants the user back: it asked for an approval, it asked a question, it
 * finished, or it failed. The phases come from the same
 * `projectThreadAwareness` projection the mobile push relay uses, so a
 * desktop banner and an iOS push say the same thing about the same thread.
 *
 * Everything here is pure: the caller owns the phase map between renders and
 * hands back what it got, which keeps the "did this thread just change?"
 * question testable without a browser.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import {
  projectThreadAwareness,
  type AgentAwarenessPhase,
  type ProjectThreadAwarenessInput,
} from "@t3tools/shared/agentAwareness";

/** The four transitions a user can ask to hear about. */
export type ThreadNotificationEvent = "approval" | "input" | "completed" | "failed";

export interface ThreadNotificationPreferences {
  readonly notifyOnApproval: boolean;
  readonly notifyOnInput: boolean;
  readonly notifyOnCompletion: boolean;
  readonly notifyOnFailure: boolean;
}

export interface ThreadNotification {
  readonly threadRef: ScopedThreadRef;
  /**
   * Replaces an older banner for the same thread instead of stacking a
   * second one: a thread that finishes and then asks a question has one
   * current state, not two.
   */
  readonly tag: string;
  readonly event: ThreadNotificationEvent;
  readonly title: string;
  readonly body: string;
}

export interface ThreadNotificationDecision {
  /** The caller's next phase map. Threads that vanished are dropped from it. */
  readonly phases: ReadonlyMap<string, AgentAwarenessPhase>;
  readonly notifications: ReadonlyArray<ThreadNotification>;
}

/** Failure detail is a provider error string; a banner shows a sentence of it. */
const MAX_DETAIL_LENGTH = 180;

const EVENT_BY_PHASE: Partial<Record<AgentAwarenessPhase, ThreadNotificationEvent>> = {
  waiting_for_approval: "approval",
  waiting_for_input: "input",
  completed: "completed",
  failed: "failed",
};

export function isThreadNotificationEventEnabled(
  event: ThreadNotificationEvent,
  preferences: ThreadNotificationPreferences,
): boolean {
  switch (event) {
    case "approval":
      return preferences.notifyOnApproval;
    case "input":
      return preferences.notifyOnInput;
    case "completed":
      return preferences.notifyOnCompletion;
    case "failed":
      return preferences.notifyOnFailure;
  }
}

/**
 * Diffs the current thread states against the phases from the last pass.
 *
 * Two silences are deliberate. A thread seen for the first time never
 * notifies, however loudly it is asking for attention: the first pass after
 * a reload, a reconnect, or a newly linked environment sees every finished
 * thread at once, and nobody wants a banner per thread for work they already
 * know about. And the thread the user is looking at right now, in a focused
 * window, is already telling them — `suppressedThreadKey` carries that one.
 */
export function reconcileThreadNotifications(input: {
  readonly previous: ReadonlyMap<string, AgentAwarenessPhase>;
  readonly threads: ReadonlyArray<ProjectThreadAwarenessInput>;
  readonly preferences: ThreadNotificationPreferences;
  readonly suppressedThreadKey: string | null;
}): ThreadNotificationDecision {
  const phases = new Map<string, AgentAwarenessPhase>();
  const notifications: ThreadNotification[] = [];

  for (const threadInput of input.threads) {
    const state = projectThreadAwareness(threadInput);
    if (state === null) {
      continue;
    }
    const threadRef: ScopedThreadRef = {
      environmentId: state.environmentId,
      threadId: state.threadId,
    };
    const key = scopedThreadKey(threadRef);
    phases.set(key, state.phase);

    const previousPhase = input.previous.get(key);
    if (previousPhase === undefined || previousPhase === state.phase) {
      continue;
    }
    const event = EVENT_BY_PHASE[state.phase];
    if (event === undefined || !isThreadNotificationEventEnabled(event, input.preferences)) {
      continue;
    }
    if (isSessionBootArtifact(previousPhase, state.phase)) {
      continue;
    }
    if (key === input.suppressedThreadKey) {
      continue;
    }

    notifications.push({
      threadRef,
      tag: key,
      event,
      title: state.headline,
      body: notificationBody({
        threadTitle: state.threadTitle,
        projectTitle: state.projectTitle,
        // "Review the completed task." adds nothing next to "Agent finished";
        // a failure's provider error is the whole point of the banner.
        detail: state.phase === "failed" ? state.detail : undefined,
      }),
    });
  }

  return { phases, notifications };
}

/**
 * A session boots to "ready" before its first turn, and a ready session with
 * nothing pending projects as completed — so a thread starting up flashes
 * "Agent finished" on its way to doing the work. The same transient makes the
 * push relay defer a thread's first completed publish. A turn that really
 * finished was running first.
 */
function isSessionBootArtifact(previous: AgentAwarenessPhase, next: AgentAwarenessPhase): boolean {
  return previous === "starting" && next === "completed";
}

function notificationBody(input: {
  readonly threadTitle: string;
  readonly projectTitle: string;
  readonly detail: string | undefined;
}): string {
  const heading = `${input.threadTitle} · ${input.projectTitle}`;
  const detail = input.detail?.trim();
  if (!detail) {
    return heading;
  }
  return `${heading}\n${truncate(detail)}`;
}

function truncate(value: string): string {
  return value.length <= MAX_DETAIL_LENGTH ? value : `${value.slice(0, MAX_DETAIL_LENGTH - 1)}…`;
}
