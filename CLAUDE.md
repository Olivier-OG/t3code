@AGENTS.md

# This fork

This is Olivier's fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It exists to
run a locally built T3 Code with a few policy and convenience changes we want and upstream does
not ship. Nothing here is meant to go back upstream. `main` is upstream `main` with the commits
below replayed on top, kept current by rebasing onto upstream by hand and rebuilding locally.

## Fork changes

Each change is kept as small as possible so upstream rebases conflict rarely. When touching one,
stay inside its footprint.

- **The web app offers `full-access` only on remote environments.** It lets an agent act without
  coming back to the user at all, which weighs most on the machine the client itself runs on, so
  `runtimeModeOptions` in `apps/web/src/components/chat/runtimeModeConfig.ts` stops at
  `approval-required`, `auto-accept-edits` and `auto`. That constant feeds Settings → New threads →
  Permissions, which has no environment to judge; `resolveRuntimeModeOptions` appends
  `full-access` when a thread's environment is neither the primary one nor a desktop-local backend,
  and an unresolved target counts as local, so the pre-bootstrap window cannot offer it.
  `useRuntimeModeOptions` wraps that for `ChatComposer`, which hands one list to its select and to
  `CompactComposerControlsMenu`, whose radio items upstream hardcodes and this fork maps from the
  prop. `runtimeModeConfig` still describes all four modes, so a thread already set
  to `full-access` renders its label. `RuntimeMode` in `packages/contracts/src/orchestration.ts`
  keeps all four literals (upstream's schema, no decode transform) and only
  `DEFAULT_RUNTIME_MODE` changes, to `auto-accept-edits`, so a thread never inherits an
  unprompted mode without a choice. The same
  default replaces upstream's `?? "full-access"` fallback in `ProviderService` and
  `ProviderSessionDirectory`, and `ClaudeAdapter`'s `canUseTool` reads `input.runtimeMode`
  directly rather than defaulting it to `full-access`. `docs/user/permission-modes.md` states the
  rule. Everything else is upstream's, including the whole mobile picker — the phone still offers
  all four.

- **Remote SSH runtimes name an upstream release.** Upstream points a remote at
  `environment.appVersion` and downloads `t3-<version>-<platform>` from its GitHub release.
  This fork publishes no releases, so that URL always 404s and SSH environments fail to prepare
  with `curl: (22)`. `REMOTE_ARCHIVE_UPSTREAM_VERSION` in `apps/desktop/src/main.ts` names the
  upstream release this fork is rebased onto instead. Only releases that attach `t3-<version>-*`
  archives work; upstream now attaches them on stable, preview and nightly alike.

- **Worktree branch names carry no `t3code/` prefix.** `buildGeneratedWorktreeBranchName` in
  `ProviderCommandReactor.ts` returns the bare slug, and `buildTemporaryWorktreeBranchName` in
  `packages/shared/src/git.ts` returns the bare `<8 hex>` token. `TEMP_WORKTREE_BRANCH_PATTERN`
  makes the prefix optional so worktrees created before this change stay recognisable. Note the
  cost: a bare 8-hex branch is what T3 Code recognises as its own throwaway, so a user branch
  named like one (`abc12345`) is eligible for automatic renaming.

- **Rebrand to T4.** The wordmark path in `apps/web/src/components/T3Wordmark.tsx` and its
  `aria-label` in `SidebarChrome.tsx`. That component also renders in the welcome wizard and the
  messages timeline, which follow. `APP_BASE_NAME`, the window title, the desktop app name and the
  icon assets are all left as upstream's, so everything outside the wordmark still says T3.

- **A local macOS build script.** `scripts/build-local-dmg.sh` wraps `dist:desktop:artifact` to
  build an unsigned DMG and swap it into `/Applications`; `docs/operations/development.md`
  documents it. Purely additive, since this fork ships no releases to install from.

- **A sync skill.** `.agents/skills/merge-with-upstream/SKILL.md` walks the procedure below and
  carries the operational traps that keep biting: a clean rebase is not proof a fork change is
  still wired up, `vp run -F` silently skips a filter that matches nothing, and installing the
  build quits the app that is running the agent. Purely additive, alongside upstream's skills.

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

Rebase, never merge. Upstream rewrites its own `main`, so the same change reaches us under a new
SHA on every sync; merging accumulates that churn as history and leaves the merge-base stranded
somewhere upstream no longer has. `main` here is upstream's history with the fork's commits
replayed on top, one per bullet above, so `git diff upstream/main..main` is exactly the fork
delta. Keep it that way.

Syncing rewrites `main`, so tag the old tip first (`backup/main-pre-<date>`) and push the tag.
Other worktrees and any branch cut from the old `main` need a reset afterwards.

1. `git fetch upstream`, then `git rebase upstream/main` on a branch off `main`.
2. Resolve conflicts by taking upstream's side and reapplying the fork change from the list
   above. Upstream rewrites docs wholesale, so expect the permission-modes wording to need
   reapplying. If upstream has adopted a fork change, drop its commit and move it to Retired
   above.
3. Sweep for regressions the rebase cannot flag: `grep -rn "runtimeModeOptions\|DEFAULT_RUNTIME_MODE\|full-access"`
   in `apps/web/src` and `packages/contracts/src` should cover every place a runtime mode is
   offered or defaulted. A new upstream mode picker that builds its own option list, or a changed
   default, shows up here.
4. Verify with `vp i`, then typecheck and the focused tests for contracts, web, desktop and
   server. Run mobile typecheck too when the sync touched `apps/mobile`.
5. Bump `REMOTE_ARCHIVE_UPSTREAM_VERSION` in `apps/desktop/src/main.ts` to the newest upstream
   release that attaches `t3-<version>-*` archives, so remote SSH environments run the code this
   sync landed on. Check with
   `curl -s "https://api.github.com/repos/pingdotgg/t3code/releases?per_page=20"` and pick a tag
   whose assets include `t3-`. Not every release does, so check rather than assume.
6. Confirm the shape held: `git diff --stat upstream/main..main` should list only the files the
   bullets above name. Anything else is a fork change nobody wrote down.
7. Force-push the branch to `main`, then rebuild from this checkout with
   `scripts/build-local-dmg.sh --install`, which replaces the app in `/Applications`.
