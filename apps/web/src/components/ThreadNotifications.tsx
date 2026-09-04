/**
 * Turns thread state changes into native notifications.
 *
 * Mounted once, above the router, so it hears about every thread in every
 * connected environment rather than only the one on screen — the whole point
 * is the thread the user is *not* looking at.
 */
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { AgentAwarenessPhase } from "@t3tools/shared/agentAwareness";
import type { ClientSettings } from "@t3tools/contracts/settings";

import { useClientSettings } from "../hooks/useSettings";
import {
  focusAppWindow,
  nativeNotificationPermission,
  showNativeNotification,
} from "../notifications/nativeNotifications";
import { reconcileThreadNotifications } from "../notifications/threadNotifications";
import { useProjects, useThreadShells } from "../state/entities";
import { buildThreadRouteParams, resolveThreadRouteRef } from "../threadRoutes";

const selectNotificationSettings = (settings: ClientSettings) => ({
  notificationsEnabled: settings.notificationsEnabled,
  notifyOnApproval: settings.notifyOnApproval,
  notifyOnInput: settings.notifyOnInput,
  notifyOnCompletion: settings.notifyOnCompletion,
  notifyOnFailure: settings.notifyOnFailure,
});

export function ThreadNotifications() {
  const navigate = useNavigate();
  const settings = useClientSettings(selectNotificationSettings);
  const threadShells = useThreadShells();
  const projects = useProjects();
  const routeThreadRef = useParams({
    strict: false,
    select: (params) => resolveThreadRouteRef(params),
  });
  const windowFocused = useWindowFocused();
  const phasesRef = useRef<ReadonlyMap<string, AgentAwarenessPhase>>(new Map());

  const projectTitles = useMemo(() => {
    const titles = new Map<string, string>();
    for (const project of projects) {
      titles.set(`${project.environmentId}:${project.id}`, project.title);
    }
    return titles;
  }, [projects]);

  // A thread the user has open in a focused window is already showing them
  // the news; anything else is fair game, including this app in a background
  // tab or an unfocused desktop window.
  const suppressedThreadKey =
    routeThreadRef !== null && windowFocused ? scopedThreadKey(routeThreadRef) : null;

  useEffect(() => {
    if (!settings.notificationsEnabled) {
      // Enabling later starts from a clean slate, which stays quiet: an
      // unseen thread never notifies on its first sighting.
      phasesRef.current = new Map();
      return;
    }

    const threads = threadShells.flatMap((thread) => {
      const title = projectTitles.get(`${thread.environmentId}:${thread.projectId}`);
      return title === undefined
        ? []
        : [{ environmentId: thread.environmentId, project: { title }, thread }];
    });

    const decision = reconcileThreadNotifications({
      previous: phasesRef.current,
      threads,
      preferences: settings,
      suppressedThreadKey,
    });
    phasesRef.current = decision.phases;

    if (decision.notifications.length === 0 || nativeNotificationPermission() !== "granted") {
      return;
    }

    for (const notification of decision.notifications) {
      showNativeNotification({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        onClick: () => {
          focusAppWindow();
          void navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(notification.threadRef),
          });
        },
      });
    }
  }, [navigate, projectTitles, settings, suppressedThreadKey, threadShells]);

  return null;
}

/**
 * Whether this window has keyboard focus. `document.visibilityState` is too
 * coarse: a desktop window sitting behind an editor is visible in every sense
 * the browser reports, and its user still wants the banner.
 */
function useWindowFocused(): boolean {
  const [focused, setFocused] = useState(() =>
    typeof document === "undefined" ? true : document.hasFocus(),
  );

  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return focused;
}
