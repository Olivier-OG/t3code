@AGENTS.md

# This fork

This is Olivier's fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It exists to
run a locally built T3 Code with a few policy and convenience changes we want and upstream does
not ship. Nothing here is meant to go back upstream. `main` is upstream `main` plus the changes
below, kept current by merging upstream in by hand and rebuilding locally.

## Fork changes

Each change is kept as small as possible so upstream merges conflict rarely. When touching one,
stay inside its footprint.

- **No unattended mode.** `full-access` is withdrawn. `RuntimeMode` in
  `packages/contracts/src/orchestration.ts` keeps the literal on the wire and rewrites it to `auto`
  on decode, so old threads and bindings still load. `DEFAULT_RUNTIME_MODE` is `auto`. The web
  composer, the compact controls menu, the mobile Runtime page and the web draft store all omit the
  row. Docs (`permission-modes.md`, `providers-antigravity.md`, `glossary.md`) describe Auto as the
  most permissive mode.
- **Native notifications on web and desktop.** `apps/web/src/notifications/` and
  `ThreadNotifications.tsx` raise a system notification when a thread needs approval, asks a
  question, finishes or fails. Per-device toggles live in `NotificationSettings.tsx` and as
  `notificationsEnabled` / `notifyOn*` keys in `packages/contracts/src/settings.ts`. Clicking a
  banner raises the window through the desktop `focusWindow` IPC method. User doc:
  `docs/user/notifications.md`.
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

## Syncing with upstream

Merge, never rebase: `main` is published and its history contains earlier merges.

1. `git fetch upstream` then `git merge upstream/main` on a branch off `main`.
2. Resolve conflicts by taking upstream's side and reapplying the fork change from the list
   above. Upstream rewrites docs wholesale, so expect the runtime-mode wording to need reapplying.
   If upstream has adopted a fork change, drop the fork's copy and move it to Retired above.
3. Sweep for regressions the merge cannot flag: `grep -rn "full-access\|Full access"` in
   `apps/web/src`, `apps/mobile/src`, `packages/contracts/src` and `docs/user` should hit only the
   places listed under "No unattended mode" plus Codex's unrelated `danger-full-access` sandbox
   literal. A new upstream mode picker or default shows up here first.
4. Verify with `vp i`, then typecheck and the focused tests for contracts, web, desktop and
   server. Run mobile typecheck too when the merge touched `apps/mobile`.
5. Merge the branch into `main`, push `origin`, and rebuild the desktop app from this checkout
   with the `build:desktop` and `dist:desktop:*` scripts in the root `package.json`.
