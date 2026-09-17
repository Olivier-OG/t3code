#!/usr/bin/env bash
# One-shot local macOS DMG build for T3 Code.
#
# Produces an unsigned, adhoc-signed .dmg in ./release. Unsigned builds cannot
# auto-update (no publish config -> no app-update.yml), so upgrading means
# rerunning this script and replacing the installed app; --install does that.
#
#   ./scripts/build-local-dmg.sh                     # build for the host arch
#   ./scripts/build-local-dmg.sh --install           # build, then swap into /Applications
#   ./scripts/build-local-dmg.sh --arch universal    # needs rustup + the x86_64 target
#   ./scripts/build-local-dmg.sh --build-version 0.0.38-local.2
#   ./scripts/build-local-dmg.sh --skip-install      # reuse the existing node_modules
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

case "$(uname -m)" in
  arm64) host_arch='arm64' ;;
  x86_64) host_arch='x64' ;;
  *) echo "Unsupported host architecture: $(uname -m)" >&2; exit 1 ;;
esac

arch="$host_arch"
build_version=''
skip_install=0
do_install=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch) arch="${2:?--arch needs a value}"; shift 2 ;;
    --build-version) build_version="${2:?--build-version needs a value}"; shift 2 ;;
    --skip-install) skip_install=1; shift ;;
    --install) do_install=1; shift ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$(uname -s)" == 'Darwin' ]] || { echo 'This script only builds on macOS.' >&2; exit 1; }
command -v cargo >/dev/null || { echo 'cargo not found. The build compiles native/resource-monitor.' >&2; exit 1; }

# Homebrew's rust ships std for the host triple only; cross-arch needs rustup.
if [[ "$arch" != "$host_arch" ]]; then
  echo "==> Cross-building $arch on a $host_arch host; this needs the matching rustup target."
fi

if [[ $skip_install -eq 0 ]]; then
  echo '==> Installing workspace dependencies'
  pnpm install
elif [[ ! -x node_modules/.bin/vp ]]; then
  echo 'node_modules is missing; rerun without --skip-install.' >&2
  exit 1
fi

echo "==> Building macOS DMG ($arch)"
build_args=(--platform mac --target dmg --arch "$arch")
[[ -n "$build_version" ]] && build_args+=(--build-version "$build_version")
pnpm run dist:desktop:artifact "${build_args[@]}"

dmg="$(/bin/ls -t release/*.dmg 2>/dev/null | head -1 || true)"
[[ -n "$dmg" ]] || { echo 'Build reported success but no .dmg landed in ./release.' >&2; exit 1; }

echo
echo "Built: $repo_root/$dmg ($(du -h "$dmg" | cut -f1))"

if [[ $do_install -eq 1 ]]; then
  echo '==> Installing into /Applications'
  # Replacing a running bundle strands the live process on a deleted inode.
  osascript -e 'quit app id "com.t3tools.t3code"' >/dev/null 2>&1 || true
  for _ in $(seq 20); do
    pgrep -qf '/Applications/T3 Code.*\.app/Contents/MacOS/' || break
    sleep 0.5
  done

  mnt="$(mktemp -d "${TMPDIR:-/tmp}/t3code-dmg.XXXXXX")"
  trap 'hdiutil detach "$mnt" -quiet >/dev/null 2>&1 || true; rmdir "$mnt" 2>/dev/null || true' EXIT
  hdiutil attach -nobrowse -readonly -mountpoint "$mnt" "$dmg" >/dev/null

  app_source="$(/bin/ls -d "$mnt"/*.app | head -1)"
  app_name="$(basename "$app_source")"
  # ditto merges into an existing bundle, so clear the old one for a true replace.
  rm -rf "/Applications/${app_name:?}"
  ditto "$app_source" "/Applications/$app_name"

  echo "Installed: /Applications/$app_name"
fi
