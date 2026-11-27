#!/usr/bin/env bash
set -euo pipefail
temp=$(mktemp)
trap 'rm -f "$temp"' EXIT
cat release/part-* > "$temp"
echo "6be8ce51974ebb4b48fa8222710e68b7dc6e2f1ff5267fa705d86c3ad1bcff5a  $temp" | sha256sum --check --status
tar -xzf "$temp"
test -s dist/index.html
test -s dist/showroom.js
test -s dist/assets/projects/catalog.json
printf 'Verified RABEN v5 static release.\n'
