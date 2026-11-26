#!/bin/sh
# Checks that the renderer bundle inside a packaged app.asar reports the
# expected release tag, so a stale or empty tag can never be published.
#
# The tag is compiled into the bundle by webpack's DefinePlugin
# (__RELEASE_TAG__) and read back by getCurrentVersion() in
# client/app/utils/UpdateUtils.ts. When it is missing or wrong the client
# keeps offering itself as an update.
#
# Usage:
#   RELEASE_TAG=v1.2.3 sh tools/verify_release_tag.sh <path-to-app.asar>

set -e

asar="$1"
tag="${RELEASE_TAG:-}"
expected='parseVersion("'"$tag"'")'

if [ -z "$tag" ]; then
	echo "verify_release_tag: RELEASE_TAG is empty" >&2
	exit 1
fi

if [ ! -f "$asar" ]; then
	echo "verify_release_tag: not found: $asar" >&2
	exit 1
fi

if grep -a -q 'parseVersion("")' "$asar"; then
	echo "verify_release_tag: empty release tag in $asar" >&2
	exit 1
fi

actual=$(grep -a -o 'parseVersion("v[^"]*")' "$asar" | sort -u || true)

if [ -z "$actual" ]; then
	echo "verify_release_tag: no embedded release tag in $asar" >&2
	exit 1
fi

if [ "$actual" != "$expected" ]; then
	echo "verify_release_tag: embedded release tag mismatch in $asar" >&2
	echo "  expected: $expected" >&2
	echo "$actual" | sed 's/^/  found:    /' >&2
	exit 1
fi

echo "verify_release_tag: $asar -> $tag"
