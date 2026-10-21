#!/usr/bin/env bash
# Screenshots the real extension popup (html/popup.html on main) for the home page.
#
#   scripts/capture-popup.sh
#
# It exports the extension's files from main into a temporary folder, loads popup.html
# with scripts/popup-shot/shot-stub.js standing in for the WebExtension APIs, and saves
# assets/popup-light.webp and assets/popup-dark.webp at 2x.
# Needs Microsoft Edge or Google Chrome, ImageMagick and Python 3.
set -euo pipefail

SITE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PORT=8790
trap 'kill "${SERVER:-0}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

BROWSER=""
for b in "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "$(command -v google-chrome || true)" "$(command -v microsoft-edge || true)"; do
  if [ -n "$b" ] && [ -x "$b" ]; then BROWSER="$b"; break; fi
done
[ -n "$BROWSER" ] || { echo "Needs Microsoft Edge or Google Chrome" >&2; exit 1; }

mkdir -p "$WORK/ext"
git -C "$SITE" archive main html core_js external_js css LinkumorI_HTML_SVG _locales img Old-Country-Nobility | tar -x -C "$WORK/ext"
cp "$SITE/scripts/popup-shot/shot-stub.js" "$WORK/ext/shot-stub.js"
python3 - "$WORK/ext/html" <<'PY'
import sys
d = sys.argv[1]
s = open(d + '/popup.html').read()
tag = '<script src="../external_js/theme_bootstrap.js"></script>'
assert s.count(tag) == 1, 'popup.html changed: update capture-popup.sh'
open(d + '/popup-shot.html', 'w').write(s.replace(tag, '<script src="../shot-stub.js"></script>\n    ' + tag))
PY

if curl -s -o /dev/null "http://localhost:$PORT/"; then
  echo "Port $PORT is already in use; stop whatever is serving it and try again" >&2; exit 1
fi
# Started directly (not in a subshell) so the trap stops the server itself.
python3 -m http.server "$PORT" --directory "$WORK/ext" >/dev/null 2>&1 & SERVER=$!
disown "$SERVER"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.3
done
URL="http://localhost:$PORT/html/popup-shot.html"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = 200 ] || { echo "The popup page did not load from $URL" >&2; exit 1; }

for theme in light dark; do
  # The headless browser can linger after writing the file, so it gets a time limit.
  perl -e 'my $t = shift; my $pid = fork; exec @ARGV unless $pid;
            $SIG{ALRM} = sub { kill "KILL", $pid; exit 0 }; alarm $t; waitpid $pid, 0' 40 "$BROWSER" --headless=new --disable-gpu --hide-scrollbars \
    --no-first-run --user-data-dir="$WORK/profile-$theme" --force-device-scale-factor=2 \
    --virtual-time-budget=3000 --window-size=340,580 --screenshot="$WORK/$theme.png" \
    "$URL?theme=$theme" >/dev/null 2>&1 || true
  magick "$WORK/$theme.png" -strip -quality 90 "$SITE/assets/popup-$theme.webp"
  echo "assets/popup-$theme.webp"
done
