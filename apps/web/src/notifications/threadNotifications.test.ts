import { describe, expect, it } from "@effect/vitest";

import type { EnvironmentId, OrchestrationThreadShell, ThreadId, TurnId } from "@t3tools/contracts";
import { ProviderInstanceId } from "@t3tools/contracts";
import type {
  AgentAwarenessPhase,
  ProjectThreadAwarenessInput,
} from "@t3tools/shared/agentAwareness";

import { reconcileThreadNotifications } from "./threadNotifications.ts";

const NOW = "2026-05-22T12:00:00.000Z";
const ENVIRONMENT_ID = "env-1" as EnvironmentId;

const ALL_EVENTS = {
  notifyOnApproval: true,
  notifyOnInput: true,
  notifyOnCompletion: true,
  notifyOnFailure: true,
};

function thread(overrides: Partial<OrchestrationThreadShell> = {}): ProjectThreadAwarenessInput {
  return {
    environmentId: ENVIRONMENT_ID,
    project: { title: "t3code" },
    thread: {
      id: "thread-1" as ThreadId,
      title: "Fix failing CI",
      modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
      session: null,
      latestTurn: null,
      updatedAt: NOW,
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      ...overrides,
    },
  };
}

function session(
  overrides: Partial<NonNullable<OrchestrationThreadShell["session"]>> = {},
): OrchestrationThreadShell["session"] {
  return {
    threadId: "thread-1" as ThreadId,
    status: "running",
    providerName: "Codex",
    runtimeMode: "full-access",
    activeTurnId: "turn-1" as TurnId,
    lastError: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function phases(
  entries: Record<string, AgentAwarenessPhase>,
): ReadonlyMap<string, AgentAwarenessPhase> {
  return new Map(Object.entries(entries));
}

const RUNNING = phases({ "env-1:thread-1": "running" });

describe("reconcileThreadNotifications", () => {
  it("stays silent the first time it sees a thread, however loud its state", () => {
    const decision = reconcileThreadNotifications({
      previous: new Map(),
      threads: [thread({ hasPendingApprovals: true, session: session() })],
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });

    expect(decision.notifications).toEqual([]);
    expect(decision.phases.get("env-1:thread-1")).toBe("waiting_for_approval");
  });

  it("notifies when a running thread starts waiting on an approval", () => {
    const decision = reconcileThreadNotifications({
      previous: RUNNING,
      threads: [thread({ hasPendingApprovals: true, session: session() })],
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });

    expect(decision.notifications).toEqual([
      {
        threadRef: { environmentId: ENVIRONMENT_ID, threadId: "thread-1" },
        tag: "env-1:thread-1",
        event: "approval",
        title: "Approval needed",
        body: "Fix failing CI · t3code",
      },
    ]);
  });

  it("notifies once per transition, not once per pass", () => {
    const waiting = [thread({ hasPendingUserInput: true, session: session() })];
    const first = reconcileThreadNotifications({
      previous: RUNNING,
      threads: waiting,
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });
    const second = reconcileThreadNotifications({
      previous: first.phases,
      threads: waiting,
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });

    expect(first.notifications.map((notification) => notification.event)).toEqual(["input"]);
    expect(second.notifications).toEqual([]);
  });

  it("carries the provider error into a failure body", () => {
    const decision = reconcileThreadNotifications({
      previous: RUNNING,
      threads: [
        thread({ session: session({ status: "error", lastError: "codex exited with 1" }) }),
      ],
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });

    expect(decision.notifications[0]?.body).toBe("Fix failing CI · t3code\ncodex exited with 1");
  });

  it("respects a disabled event without muting the others", () => {
    const preferences = { ...ALL_EVENTS, notifyOnCompletion: false };
    const completed = reconcileThreadNotifications({
      previous: RUNNING,
      threads: [thread({ session: session({ status: "ready", activeTurnId: null }) })],
      preferences,
      suppressedThreadKey: null,
    });
    const failed = reconcileThreadNotifications({
      previous: RUNNING,
      threads: [thread({ session: session({ status: "error", lastError: null }) })],
      preferences,
      suppressedThreadKey: null,
    });

    expect(completed.notifications).toEqual([]);
    expect(completed.phases.get("env-1:thread-1")).toBe("completed");
    expect(failed.notifications.map((notification) => notification.event)).toEqual(["failed"]);
  });

  it("ignores the completed flash a booting session projects on its way to running", () => {
    const decision = reconcileThreadNotifications({
      previous: phases({ "env-1:thread-1": "starting" }),
      threads: [thread({ session: session({ status: "ready", activeTurnId: null }) })],
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });

    expect(decision.notifications).toEqual([]);
    expect(decision.phases.get("env-1:thread-1")).toBe("completed");
  });

  it("says nothing about the thread the user is looking at", () => {
    const decision = reconcileThreadNotifications({
      previous: RUNNING,
      threads: [thread({ hasPendingApprovals: true, session: session() })],
      preferences: ALL_EVENTS,
      suppressedThreadKey: "env-1:thread-1",
    });

    expect(decision.notifications).toEqual([]);
    expect(decision.phases.get("env-1:thread-1")).toBe("waiting_for_approval");
  });

  it("forgets threads that are gone so the phase map cannot grow forever", () => {
    const decision = reconcileThreadNotifications({
      previous: phases({ "env-1:thread-1": "running", "env-1:thread-2": "running" }),
      threads: [thread({ session: session() })],
      preferences: ALL_EVENTS,
      suppressedThreadKey: null,
    });

    expect([...decision.phases.keys()]).toEqual(["env-1:thread-1"]);
  });
});
