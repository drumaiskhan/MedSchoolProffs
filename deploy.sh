#!/usr/bin/env bash
# Run on the VPS from the repo folder:  ./deploy.sh
# Pulls the latest code from GitHub and rebuilds/restarts the containers.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Missing .env - copy hostinger.env.example to .env first."; exit 1; }
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
