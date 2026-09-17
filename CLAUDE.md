@AGENTS.md

# This fork

This is Olivier's fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It exists to
run a locally built T3 Code with a few policy and convenience changes we want and upstream does
not ship. Nothing here is meant to go back upstream. `main` is upstream `main` plus the changes
below, kept current by merging upstream in by hand and rebuilding locally.

## Fork changes

Each change is kept as small as possible so upstream merges conflict rarely. When touching one,
stay inside its footprint.

- **Unattended modes are remote-only.** `auto` and `full-access` are offered only for work that
  runs on another machine. `RuntimeMode` in `packages/contracts/src/orchestration.ts` keeps all
  four literals (upstream's schema, no decode transform) and carries the policy beside them:
  `runtimeModesForMachine` picks the list a client may offer and `clampRuntimeModeToMachine` caps
  a stored default or draft, both keyed by `RuntimeModeMachineLocality` (`host` | `remote` |
  `unknown`). `DEFAULT_RUNTIME_MODE` is `auto-accept-edits` so nothing a thread inherits without a
  choice names an unattended mode, and `ProviderService`/`ProviderSessionDirectory` fall back to it
  instead of upstream's `?? "full-access"` for a binding with no stored mode.
  `environmentMachineLocality` in `packages/client-runtime/src/connection/machineLocality.ts`
  answers the locality question: SSH is always `remote`, the primary and host-local backends are
  `host`, anything else is `remote` only when this client owns a primary, and a client with no
  primary (the hosted web app, mobile) gets `unknown`. Enforcement is client-side by design — a
  server is always local to itself — through `useEnvironmentMachineLocality` /
  `useScopeMachineLocality` in `apps/web/src/state/machineLocality.ts` and
  `apps/mobile/src/state/machine-locality.ts`. Web threads the list and the capped mode from
  `ChatView` into the composer picker and the compact controls menu, `ProjectDefaultsSettings`
  does the same for Settings → New threads → Permissions, and `runtimeModeChoices` in the mobile
  `thread-settings-options.ts` feeds the Runtime page. `unknown` narrows a picker but never
  rewrites a stored mode, so a thread set from a client that could place the machine keeps it.
  Everything else — the Claude adapter's `bypassPermissions` mapping, the other adapters'
  `full-access` branches, the web draft store — is upstream's. Docs
  (`permission-modes.md`, `glossary.md`) describe the remote-only rule.
- **Remote SSH runtimes name an upstream release.** Upstream points a remote at
  `environment.appVersion` and downloads `t3-<version>-<platform>` from its GitHub release.
  This fork publishes no releases, so that URL always 404s and SSH environments fail to prepare
  with `curl: (22)`. `REMOTE_ARCHIVE_UPSTREAM_VERSION` in `apps/desktop/src/main.ts` names the
  upstream release this fork is merged up to instead. Only releases that attach `t3-<version>-*`
  archives work, which today means the preview train, not stable or nightly.
- **Generated branch names carry no `t3code/` prefix.** `buildGeneratedWorktreeBranchName` in
  `ProviderCommandReactor.ts` returns the bare slug. The temporary pre-rename branch keeps its
  prefix, which is how T3 Code recognises its own throwaway branches.
- **Rebrand to T4.** `APP_BASE_NAME` in `apps/web/src/branding.ts` and
  `apps/desktop/src/app/DesktopEnvironment.ts`, the wordmark in `T3Wordmark.tsx`, and the logo SVGs
  under `assets/`. Scattered "T3 Code" copy is left alone on purpose; rewriting it would conflict on
  every merge. Raster icons still render T3 until regenerated with `pnpm icons:export`.

Retired: the fork once patched Claude text generation to stop passing
`--dangerously-skip-permissions`. Upstream now isolates that CLI call itself, so the fork carries
upstream's version.

Retired: the fork once shipped native web and desktop notifications. Upstream's
`ThreadNotificationCoordinator` now covers the same four moments and adds sound, badging, in-app
toasts and click-to-open-thread, so the fork's `apps/web/src/notifications/`,
`ThreadNotifications.tsx`, `notificationsEnabled` / `notifyOn*` client settings, `focusWindow` IPC
and `docs/user/notifications.md` are gone. The `notifyOn*` keys still in `relay.ts` are upstream's
mobile push preferences and unrelated.

## Syncing with upstream

Merge, never rebase: `main` is published and its history contains earlier merges.

1. `git fetch upstream` then `git merge upstream/main` on a branch off `main`.
2. Resolve conflicts by taking upstream's side and reapplying the fork change from the list
   above. Upstream rewrites docs wholesale, so expect the runtime-mode wording to need reapplying.
   If upstream has adopted a fork change, drop the fork's copy and move it to Retired above.
3. Sweep for regressions the merge cannot flag: `grep -rn "runtimeModesForMachine\|DEFAULT_RUNTIME_MODE"`
   in `apps/web/src`, `apps/mobile/src` and `packages/contracts/src` should cover every place a
   runtime mode is offered or defaulted. A new upstream mode picker, a new turn-start payload, or
   a changed default shows up as a picker that is not keyed by locality.
4. Verify with `vp i`, then typecheck and the focused tests for contracts, web, desktop and
   server. Run mobile typecheck too when the merge touched `apps/mobile`.
5. Bump `REMOTE_ARCHIVE_UPSTREAM_VERSION` in `apps/desktop/src/main.ts` to the newest upstream
   release that attaches `t3-<version>-*` archives, so remote SSH environments run the code this
   sync landed on. Check with
   `curl -s "https://api.github.com/repos/pingdotgg/t3code/releases?per_page=20"` and pick a tag
   whose assets include `t3-`; nightly builds do not attach them.
6. Merge the branch into `main`, push `origin`, and rebuild from this checkout with
   `scripts/build-local-dmg.sh --install`, which replaces the app in `/Applications`.
