#!/bin/bash
# Update and restart the ERP on MilesWeb (cPanel Node.js app), run over SSH from the app folder:
#   cd ~/chanakyapublicschool && bash scripts/milesweb-deploy.sh
# Before the first run, enter the Node.js environment cPanel shows at the top of "Setup Node.js App", e.g.
#   source ~/nodevenv/chanakyapublicschool/22/bin/activate
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env in $(pwd). Upload it first (see DEPLOY_MILESWEB.md)." >&2
  exit 1
fi

echo "1/4 Getting the latest code"
git pull --ff-only

echo "2/4 Installing packages (build tools included)"
# cPanel sets NODE_ENV=production, which would skip the build tools; include them explicitly.
# Use install (not ci): on cPanel, node_modules is a link into the Node.js environment and ci would delete it.
npm install --include=dev --no-audit --no-fund

echo "3/4 Building website + server"
npm run build

echo "4/4 Restarting the app"
mkdir -p tmp
touch tmp/restart.txt

echo "Done. Check: curl -s https://\$(grep -E '^FRONTEND_URL=' .env | cut -d/ -f3)/api/health"
