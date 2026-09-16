# Permission modes

Permission modes control when an agent needs your approval to act. Choose a mode in the message
composer; it applies to that thread.

Set the default for new threads in **Settings → General → New threads → Permissions**.
Projects can override the environment default. New threads use this setting rather than the
mode of the thread you were viewing. The initial default is **Auto-accept edits**; existing
threads and modes you choose in a draft keep their permissions.

| Mode                  | Behavior                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Supervised**        | Requests approval for commands and file changes.                                      |
| **Auto-accept edits** | Approves file edits automatically; other actions can still require approval.          |
| **Auto**              | Uses the provider's automatic review to approve routine actions and ask about others. |
| **Full access**       | Allows commands and edits without approval prompts.                                   |

Approve or reject requests in the conversation to let the agent continue. Permission modes do
not prevent the agent from asking questions about the task.

## Where the unattended modes are offered

**Auto** and **Full access** let an agent act without coming back to you, so they are only
offered for threads whose work runs on another machine — an environment you added over SSH, or
another machine's server you connected to from the one running T3 Code. On the machine running
T3 Code itself, the composer offers **Supervised** and **Auto-accept edits** only, and a
default set to one of the other two runs as **Auto-accept edits** there.

The phone and the hosted web app reach every environment the same way, so they cannot tell the
two apart. They offer the two supervised modes, leaving a thread already set to **Auto** or
**Full access** from a client that could tell running in the mode you chose.

## Provider differences

Providers enforce permissions differently. Some read-only actions can proceed in **Supervised**.
**Auto** uses automatic review on Codex, Claude, and Cursor; providers without an equivalent,
including OpenCode and Antigravity, fall back to asking.

For Grok, **Always allow this session** remembers the matching command or tool input. Other
actions still require approval.

Antigravity can still send native approval requests in **Full access**. It only offers remembered
approvals for actions that support them.

See the [provider guides](./install.md#providers) for setup and provider-specific limits.
