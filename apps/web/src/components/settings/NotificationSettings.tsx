/**
 * The Notifications section of General settings.
 *
 * The master switch is the only place the app ever asks for notification
 * permission, because in a browser that ask has to come from a click: a
 * prompt raised on load is auto-denied for the whole origin, and no later
 * request can undo it.
 *
 * Turning the switch on always sends one banner, because "granted" and "you
 * will actually see something" are different claims and only the second one
 * matters. The desktop app grants itself permission without a prompt, and
 * macOS can still drop banners from an app it has not been told to allow —
 * neither of which the renderer can detect. The banner is the only honest
 * answer, so the switch produces one and the row says what it means if it
 * never arrives.
 */
import { useCallback, useState } from "react";

import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";

import { isElectron } from "~/env";
import { usePrimarySettings, useUpdatePrimarySettings } from "~/hooks/useSettings";
import {
  focusAppWindow,
  nativeNotificationPermission,
  nativeNotificationUnavailability,
  requestNativeNotificationPermission,
  showNativeNotification,
  type NativeNotificationPermission,
} from "~/notifications/nativeNotifications";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

/** Sub-switch rows read as belonging to the master switch above them. */
const EVENT_ROW_CLASS = "bg-muted/20 sm:pl-9";

const CONFIRMATION_TAG = "t3code:notification-check";

/** Sends the banner that proves the whole path works, end to end. */
function sendConfirmationNotification(): boolean {
  return showNativeNotification({
    title: "Notifications are on",
    body: "This is how T3 Code will reach you when a thread needs you.",
    tag: CONFIRMATION_TAG,
    onClick: focusAppWindow,
  });
}

export function NotificationSettings() {
  const settings = usePrimarySettings();
  const updateSettings = useUpdatePrimarySettings();
  const [permission, setPermission] = useState<NativeNotificationPermission | null>(() =>
    nativeNotificationPermission(),
  );
  const [confirmationSent, setConfirmationSent] = useState(false);
  const unavailability = nativeNotificationUnavailability();

  const toggleNotifications = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setConfirmationSent(false);
        updateSettings({ notificationsEnabled: false });
        return;
      }
      void (async () => {
        const granted = await requestNativeNotificationPermission();
        setPermission(granted);
        // Staying off when the ask was refused keeps the switch honest: an
        // "on" switch that can never show a banner is a lying control.
        updateSettings({ notificationsEnabled: granted === "granted" });
        if (granted === "granted") {
          setConfirmationSent(sendConfirmationNotification());
        }
      })();
    },
    [updateSettings],
  );

  const blocked = permission === "denied";
  const enabled = settings.notificationsEnabled && !blocked;

  return (
    <SettingsSection id="notifications" title="Notifications">
      <SettingsRow
        {...searchableSetting("native-notifications")}
        description="Get a system notification when an agent needs you or finishes working."
        status={notificationStatus({ unavailability, blocked, enabled, confirmationSent })}
        resetAction={
          settings.notificationsEnabled !== DEFAULT_UNIFIED_SETTINGS.notificationsEnabled ? (
            <SettingResetButton
              label="notifications"
              onClick={() =>
                updateSettings({
                  notificationsEnabled: DEFAULT_UNIFIED_SETTINGS.notificationsEnabled,
                })
              }
            />
          ) : null
        }
        control={
          <>
            {enabled ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setConfirmationSent(sendConfirmationNotification())}
              >
                Send test
              </Button>
            ) : null}
            <Switch
              checked={enabled}
              disabled={unavailability !== null || blocked}
              onCheckedChange={(checked) => toggleNotifications(Boolean(checked))}
              aria-label="Enable notifications"
            />
          </>
        }
      />

      {enabled ? (
        <>
          <NotificationEventRow
            searchId="notify-on-approval"
            description="An agent is asking permission to run something."
            checked={settings.notifyOnApproval}
            ariaLabel="Notify on approval requests"
            onCheckedChange={(checked) => updateSettings({ notifyOnApproval: checked })}
          />
          <NotificationEventRow
            searchId="notify-on-input"
            description="An agent asked a question and is waiting on an answer."
            checked={settings.notifyOnInput}
            ariaLabel="Notify when input is needed"
            onCheckedChange={(checked) => updateSettings({ notifyOnInput: checked })}
          />
          <NotificationEventRow
            searchId="notify-on-completion"
            description="A turn finished and the work is ready to review."
            checked={settings.notifyOnCompletion}
            ariaLabel="Notify on completed turns"
            onCheckedChange={(checked) => updateSettings({ notifyOnCompletion: checked })}
          />
          <NotificationEventRow
            searchId="notify-on-failure"
            description="A session errored out before finishing."
            checked={settings.notifyOnFailure}
            ariaLabel="Notify on failures"
            onCheckedChange={(checked) => updateSettings({ notifyOnFailure: checked })}
          />
        </>
      ) : null}
    </SettingsSection>
  );
}

function NotificationEventRow({
  searchId,
  description,
  checked,
  ariaLabel,
  onCheckedChange,
}: {
  readonly searchId: Parameters<typeof searchableSetting>[0];
  readonly description: string;
  readonly checked: boolean;
  readonly ariaLabel: string;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <SettingsRow
      {...searchableSetting(searchId)}
      className={EVENT_ROW_CLASS}
      description={description}
      control={
        <Switch
          checked={checked}
          onCheckedChange={(next) => onCheckedChange(Boolean(next))}
          aria-label={ariaLabel}
        />
      }
    />
  );
}

function notificationStatus(input: {
  readonly unavailability: ReturnType<typeof nativeNotificationUnavailability>;
  readonly blocked: boolean;
  readonly enabled: boolean;
  readonly confirmationSent: boolean;
}): string | undefined {
  if (input.unavailability === "insecure-context") {
    return "Unavailable over a plain http connection. Reach this environment over https — a tunnel, T3 Connect, or the desktop app — to turn notifications on.";
  }
  if (input.unavailability === "unsupported") {
    return "This browser does not support system notifications.";
  }
  if (input.blocked) {
    return "Blocked. Allow notifications for this site in your browser or system settings, then reload.";
  }
  if (input.enabled && input.confirmationSent) {
    // The app cannot see whether the OS actually drew the banner, so the one
    // useful thing to say is where to look when it did not.
    return isElectron
      ? "A test notification was sent. If nothing appeared, allow T3 Code in your operating system's notification settings."
      : "A test notification was sent. If nothing appeared, check notification permissions for this site and your operating system's notification settings.";
  }
  return undefined;
}
