# Notifications

T3 Code can send a system notification when an agent needs you or finishes working, so you can
leave a long turn running and get on with something else.

Turn them on in **Settings → General → Notifications**. In a browser, enabling the switch asks
whether T3 Code may send notifications; if you refuse, the switch stays off — allow notifications
for the site, reload, and try again. The desktop app needs no such prompt and turns on right away.

Switching it on sends one notification straight away, so you can see that it works. **Send test**
next to the switch sends another whenever you want one. If no notification appears, your operating
system is holding it back rather than T3 Code: allow T3 Code in your system notification settings
and check that Do Not Disturb or a Focus mode is not on.

Once notifications are on, choose which moments are worth interrupting you for:

- **Approval requests** — an agent is asking permission to run something.
- **Input needed** — an agent asked a question and is waiting on an answer.
- **Completed turns** — a turn finished and the work is ready to review.
- **Failures** — a session errored out before finishing.

Notifications cover every thread in every environment you are connected to, not just the project
you have open. Clicking one brings T3 Code forward and opens that thread.

T3 Code stays quiet about the thread you are already looking at in a focused window, and about
threads it is seeing for the first time — so opening the app, reconnecting, or linking a new
environment never floods you with notifications for work you already know about.

Notifications are a per-device preference: turning them on in the desktop app does not turn them
on in a browser on the same machine, and each browser asks for its own permission.

## When notifications are unavailable

System notifications need a secure connection. If you reach an environment over a plain `http://`
address on your local network, the switch is unavailable — connect over `https://` instead, using
[remote access](./remote-access.md), T3 Connect, or the desktop app.

On iPhone and iPad, the T3 Code mobile app delivers push notifications instead; enable them in the
mobile app's own settings.
