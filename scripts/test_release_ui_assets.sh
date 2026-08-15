#!/bin/sh

set -eu

image=${1:?Usage: test_release_ui_assets.sh IMAGE}
platform=${PHOTOVIEW_TEST_PLATFORM:-linux/amd64}

docker run --rm --platform "$platform" --entrypoint sh "$image" -c '
set -eu

for asset in \
  /app/ui/photoview-logo.svg \
  /app/ui/manifest.json \
  /app/ui/logo192.png \
  /app/ui/logo512.png
do
  if [ ! -r "$asset" ]; then
    printf "UI asset is not readable by the runtime user: %s\n" "$asset" >&2
    exit 1
  fi
done

grep -q '"'"'"src": "/logo192.png"'"'"' /app/ui/manifest.json
grep -q '"'"'"src": "/logo512.png"'"'"' /app/ui/manifest.json
grep -q '"'"'"src": "/photoview-logo.svg"'"'"' /app/ui/manifest.json
'
