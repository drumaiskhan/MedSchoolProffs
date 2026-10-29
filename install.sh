#!/usr/bin/env bash
# Lock-file installer: installs EXACTLY the versions pinned in pnpm-lock.yaml.
# Usage:  ./install.sh            (strict: fails if the lock file is out of date)
#         ./install.sh --relock   (updates pnpm-lock.yaml if package.json files changed)
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "Node.js 22+ is required: https://nodejs.org"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || { echo "Node 22+ required (found $(node -v))."; exit 1; }
[ -f pnpm-lock.yaml ] || { echo "pnpm-lock.yaml not found - run from the project root."; exit 1; }

# The project is pnpm-only (scripts/preinstall.cjs rejects npm/yarn and deletes their lock files).
# corepack installs the exact pnpm version pinned in package.json "packageManager".
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable 2>/dev/null || npm install -g corepack
  corepack prepare --activate >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null 2>&1 || { echo "Could not set up pnpm. Try: npm install -g pnpm"; exit 1; }

if [ "${1:-}" = "--relock" ]; then
  echo "Installing and refreshing pnpm-lock.yaml..."
  pnpm install --no-frozen-lockfile
else
  echo "Installing from pnpm-lock.yaml (frozen)..."
  if ! pnpm install --frozen-lockfile; then
    echo ""
    echo "The lock file does not match package.json. Run  ./install.sh --relock  once,"
    echo "then commit the updated pnpm-lock.yaml."
    exit 1
  fi
fi
echo "Done. Next: pnpm run build:student | build:admin | build:api   (or ./scripts/build-hostinger.sh)"
