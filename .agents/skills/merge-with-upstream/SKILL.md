---
name: merge-with-upstream
description: Sync this fork with upstream pingdotgg/t3code by rebasing, re-checking every documented fork change, bumping REMOTE_ARCHIVE_UPSTREAM_VERSION, verifying, and rebuilding the local app. Use for "merge with upstream", "sync the fork", or "pull in upstream changes".
---

# Sync the fork with upstream

Despite the name, this **rebases** — never merges. Upstream rewrites its own `main`, so the same
change reaches us under a new SHA every sync; merging accumulates that churn as history and strands
the merge-base somewhere upstream no longer has. `main` is upstream's history with the fork's
commits replayed on top, **one commit per bullet in `CLAUDE.md` → Fork changes**, so
`git diff upstream/main..main` is exactly the fork delta. That invariant is the point. Preserve it.

`CLAUDE.md` is the source of truth for the fork bullets and the numbered procedure — read it first,
it drifts. This skill adds the operational traps that are not obvious from it.

## Before you start

- **Check the working tree.** There is often uncommitted fork work in progress. Do not commit it,
  discard it, or let it get swept into a rebase or a fixup. `git stash push -m "..."`, sync,
  `git stash pop`, and tell the developer it is back and still dirty. When you need to commit
  something that touches a file they have dirty, stash _that path alone_
  (`git stash push -- CLAUDE.md`) so their hunk cannot ride along.
- **Tag the old tip**, since syncing rewrites `main`:
  `git tag backup/main-pre-<YYYY-MM-DD> main`. Other worktrees and any branch cut from the old
  `main` need a reset afterwards.
- `upstream` may not be configured:
  `git remote add upstream https://github.com/pingdotgg/t3code.git`. That writes `.git/config`,
  which the sandbox denies — retry with `dangerouslyDisableSandbox: true`. So do `git fetch`,
  `git branch -d` and anything else that locks the config.

## The two things that are easy to forget

### 1. Re-check every custom build feature

A clean rebase is **not** proof the fork changes survived. Upstream restructures these files
constantly, and git will happily apply a hunk into code nothing calls anymore, or drop a prop along
with a render site it deleted. Walk the `CLAUDE.md` bullets one at a time and confirm each change is
still _wired up_, not merely present. As of this writing:

| Bullet                                    | Verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full-access` only on remote environments | `runtimeModeConfig.ts` exports `runtimeModeOptions` (3 modes), `resolveRuntimeModeOptions`, `useRuntimeModeOptions`; `ChatComposer.tsx` calls the hook and passes `runtimeModeOptions` to **both** `ComposerFooterModeControls` and `CompactComposerControlsMenu`; the menu maps the prop instead of hardcoding radio items; `DEFAULT_RUNTIME_MODE` in `packages/contracts/src/orchestration.ts` and `apps/web/src/types.ts`; no `?? "full-access"` left in `ProviderService` / `ProviderSessionDirectory`; `ClaudeAdapter.canUseTool` reads `input.runtimeMode` directly |
| Remote SSH release pin                    | `REMOTE_ARCHIVE_UPSTREAM_VERSION` in `apps/desktop/src/main.ts` — see below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Bare worktree branch names                | `buildGeneratedWorktreeBranchName` in `ProviderCommandReactor.ts` and `buildTemporaryWorktreeBranchName` in `packages/shared/src/git.ts` return bare tokens; `TEMP_WORKTREE_BRANCH_PATTERN` keeps the prefix optional                                                                                                                                                                                                                                                                                                                                                     |
| T4 rebrand                                | the path in `T3Wordmark.tsx` and the `aria-label` in `SidebarChrome.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Local DMG build script                    | `scripts/build-local-dmg.sh` and its section in `docs/operations/development.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Then sweep for regressions the rebase cannot flag:

```bash
grep -rn "runtimeModeOptions\|DEFAULT_RUNTIME_MODE\|full-access" apps/web/src packages/contracts/src
```

A new upstream mode picker that builds its own option list, or a changed default, only shows up
here. Expect `ProjectDefaultsSettings.tsx` to use the bare `runtimeModeOptions` — that surface has
no environment to judge, which is intended. If upstream has adopted a fork change outright, drop its
commit and move the bullet to **Retired** in `CLAUDE.md`.

### 2. Bump the server version flag

`REMOTE_ARCHIVE_UPSTREAM_VERSION` in `apps/desktop/src/main.ts` names the upstream release that
remote SSH environments download `t3-<version>-<platform>` from. This fork publishes no releases, so
a stale or wrong value makes every SSH environment fail to prepare with `curl: (22)`.

Pick the newest release **whose assets actually include a `t3-` archive** — not every release
attaches them, so check rather than assume:

```bash
curl -s "https://api.github.com/repos/pingdotgg/t3code/releases?per_page=20" \
  | jq -r '.[] | "\(.tag_name)\t\(.target_commitish[0:10])\tt3=\([.assets[].name] | map(select(startswith("t3-"))) | length)"'
```

The newest tagged release usually trails `upstream/main` by a handful of commits. `CLAUDE.md` says
to take the newest archive-bearing release, so stay on `upstream/main` and accept the gap rather
than rebasing backwards onto the tagged commit. Note the value carries **no `v` prefix**, unlike the
git tag.

Squash the bump into the existing desktop pin commit — `git commit --fixup <sha>` then
`GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash upstream/main`. Do not add a new commit; that
grows the history past one-commit-per-bullet.

## Procedure

1. `git fetch upstream` — slow, and it has been killed at the default timeout. Use
   `timeout: 600000` and `dangerouslyDisableSandbox: true`.
2. Cut a branch off `main` and `git rebase upstream/main` on it.
3. Resolve conflicts by **taking upstream's side and re-applying the fork change**. Expect
   `ChatComposer.tsx` (upstream keeps restructuring the composer control strip) and
   `docs/user/permission-modes.md` (upstream rewrites docs wholesale). After resolving, re-read the
   surrounding code: if upstream collapsed two render sites into one, the prop has to land on the
   survivor rather than vanish with the deleted branch.
4. Do the bullet audit and the grep sweep above.
5. Bump `REMOTE_ARCHIVE_UPSTREAM_VERSION`.
6. Verify: `vp i`, then **focused** typecheck and tests for contracts, web, desktop, server and —
   when the sync touched `apps/mobile` — mobile. Never `vp check`, `vp run -r test` or
   `vp run -r typecheck`; CI owns the full suite. Lint only the files you touched.
7. Confirm the shape held: `git diff --stat upstream/main..<branch>`. Every file must map to a
   bullet. Anything else is a fork change nobody wrote down — stop and ask.
8. Land it: `git checkout main && git reset --hard <branch>`. **Ask before pushing** — force-pushing
   `main` is not always wanted, and a rebase that only lands locally is a valid outcome.
9. Rebuild and install (below), then restore any stashed work and say so.

### Package names for step 6

`vp run -F <pkg> typecheck` **silently skips filters that match nothing**, so a typo reads as a
pass. The server package is named `t3`, not `@t3tools/server`. Check the reported package count, or
just read the exit code:

```bash
vp run -F @t3tools/contracts -F @t3tools/web -F @t3tools/desktop -F @t3tools/mobile typecheck
vp run -F t3 typecheck
```

Typecheck prints a wall of `suggestion TS…` lines that are **not** failures. Grep for `error TS` or
trust the exit code.

## Building and installing

`scripts/build-local-dmg.sh --install` quits the running T3 Code app — **which kills your own agent
session mid-build** if you are running inside it. Split the two halves:

```bash
scripts/build-local-dmg.sh          # build only; slow, keep it in the foreground
```

then run the install detached so it survives the app quitting:

```bash
nohup "$TMPDIR/t3-install.sh" >/tmp/claude/t3-install.log 2>&1 & disown
```

where `t3-install.sh` replicates the `--install` block of `scripts/build-local-dmg.sh` (osascript
quit, wait, `hdiutil attach`, `rm -rf` the old bundle, `ditto`, detach). Re-read that script rather
than trusting this summary.

**Prove the install took** — it fails silently, and an mtime check is not enough. Grep the installed
bundle for the new pin:

```bash
grep -rl "0.0.43-nightly.YYYYMMDD.NNNN" "/Applications/T3 Code (Alpha).app" | head
```

The new pin must be present and the old one absent. The bundle's reported version is upstream's
`package.json` version (e.g. `0.0.42`), **not** the nightly tag — do not read that as a stale install.

## Aftermath: stale branches

Rewriting `main` strands every branch cut from it. Record the tips before deleting anything:

```bash
git for-each-ref --format='%(refname:short) %(objectname)' refs/remotes/origin > "$TMPDIR/stale-tips.txt"
```

`git fetch origin --prune` **first**: tracking refs go stale when a merged PR deletes its remote
branch, and `git push origin --delete` fails the **entire batch** if any one ref is missing —
deleting nothing while looking like a partial failure. Re-verify the remote after such an error
instead of trusting the output.

`git cherry` "unique patch" counts on these branches are mostly rebase drift, not genuinely unique
work. Say so before recommending deletion, and get explicit confirmation.

## Repo rules that still apply

- Never open a PR unless the developer explicitly asks.
- `gh` defaults to upstream `pingdotgg` — pin `--repo <fork> --base main`.
- `~/.t3/userdata` is the developer's live database: read-only, never serve from it, never clean it up.
- Never `pkill -f` or kill a PID found by pattern-matching.
