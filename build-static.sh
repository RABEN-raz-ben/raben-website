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

# Install the SayBack portfolio card on the verified, pinned base release.
sayback='portfolio/sayback'
cp "$sayback/room-index.html" dist/index.html
cp "$sayback/sayback.css" dist/sayback.css
mkdir -p dist/assets/projects/sayback
cp "$sayback/index.html" "$sayback/image.webp" "$sayback/example.webp" dist/assets/projects/sayback/
catalog='dist/assets/projects/catalog.json'
test "$(tail -n 1 "$catalog")" = '}'
{
  sed '$d' "$catalog"
  printf ',\n'
  cat "$sayback/catalog.entry.json"
  printf '}\n'
} > "${catalog}.new"
mv "${catalog}.new" "$catalog"
printf 'Verified SayBack portfolio release overlay.\n'
