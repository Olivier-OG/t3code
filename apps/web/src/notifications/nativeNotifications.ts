/**
 * The browser side of native notifications.
 *
 * The Notification API is not everywhere: it needs a secure context, so a
 * client reached over plain http on a LAN address does not have it, and some
 * mobile browsers only deliver through a service worker. Every entry point
 * here answers for the platform it actually got rather than assuming one, so
 * the settings UI can say why a switch is unavailable instead of silently
 * doing nothing.
 *
 * The desktop app needs no special case: Electron maps the same API onto the
 * OS notification centre. Only the click needs help, because raising the
 * window from a renderer is the shell's job.
 */

export type NativeNotificationPermission = "default" | "granted" | "denied";

/** Why native notifications cannot be used here, or `null` when they can. */
export type NativeNotificationUnavailability = "unsupported" | "insecure-context";

export function nativeNotificationUnavailability(): NativeNotificationUnavailability | null {
  if (typeof window === "undefined") {
    return "unsupported";
  }
  // A page served over plain http drops the constructor entirely, so the
  // more useful of the two answers is the one about the origin.
  const insecure = window.isSecureContext === false;
  if (!("Notification" in window)) {
    return insecure ? "insecure-context" : "unsupported";
  }
  return null;
}

export function nativeNotificationsSupported(): boolean {
  return nativeNotificationUnavailability() === null;
}

export function nativeNotificationPermission(): NativeNotificationPermission | null {
  return nativeNotificationsSupported() ? window.Notification.permission : null;
}

/**
 * Asks for permission. Must be called from a user gesture: a browser prompt
 * raised on page load is denied for the whole origin in Chrome and Safari,
 * and that denial is not something the app can undo.
 *
 * An already-decided permission is returned as-is rather than asked again.
 * The desktop app arrives here already granted — Electron approves its own
 * renderer without a prompt — and re-asking would put the answer behind a
 * permission handler round trip for no gain.
 */
export async function requestNativeNotificationPermission(): Promise<NativeNotificationPermission | null> {
  if (!nativeNotificationsSupported()) {
    return null;
  }
  if (window.Notification.permission !== "default") {
    return window.Notification.permission;
  }
  try {
    // Older Safari answers through a callback and returns undefined, so the
    // resolved value is not load-bearing: the live permission is.
    await window.Notification.requestPermission();
  } catch {
    // A refusal to even ask is answered by the permission itself, below.
  }
  return window.Notification.permission;
}

export interface NativeNotificationRequest {
  readonly title: string;
  readonly body: string;
  /** Same tag replaces the previous banner for that thread instead of stacking. */
  readonly tag: string;
  readonly onClick: () => void;
}

/**
 * Shows one banner. Returns false when the platform refused it, which is
 * ordinary: permission can be revoked from OS settings between renders, and
 * Android Chrome throws rather than returning.
 */
export function showNativeNotification(request: NativeNotificationRequest): boolean {
  if (!nativeNotificationsSupported() || window.Notification.permission !== "granted") {
    return false;
  }

  try {
    const notification = new window.Notification(request.title, {
      body: request.body,
      tag: request.tag,
      icon: "/apple-touch-icon.png",
    });
    notification.addEventListener("click", () => {
      request.onClick();
      notification.close();
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Brings the app forward. In a browser this is only ever advisory — window
 * managers ignore focus requests from background tabs — so the click also
 * navigates, which is what makes the tab the user switches to show the right
 * thread. The desktop shell can actually raise its window, and does.
 */
export function focusAppWindow(): void {
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  if (bridge?.focusWindow) {
    void bridge.focusWindow().catch(() => undefined);
    return;
  }
  try {
    window.focus();
  } catch {
    // Focus is advisory; a refusal is not an error worth surfacing.
  }
}
