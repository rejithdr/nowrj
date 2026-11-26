#!/usr/bin/env bash
# Quick checks against a running backend: it answers, protects what must be
# protected, rejects bad input and leaks no banners. update.sh runs it after
# every deploy; run it by hand any time:
#   bash /srv/nowrj/deploy/api-smoke.sh                 (the server itself)
#   bash deploy/api-smoke.sh https://nowrj.com/api      (from anywhere)
set -uo pipefail
BASE="${1:-http://127.0.0.1:3000}"
fails=0
check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "  pass  $1"; else echo "  FAIL  $1 (expected $2, got $3)"; fails=$((fails + 1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }

echo "API checks against $BASE"
check "health answers 200"                 200 "$(code "$BASE/health")"
check "shows feed answers"                 200 "$(code "$BASE/shows/now")"
check "programme list answers"             200 "$(code "$BASE/programmes")"
for path in /auth/me /me/messages /me/alerts /auth/me/data /advertiser/me /rjs/me/programmes /network-programmes/offices; do
  check "signed out is refused: $path"     401 "$(code "$BASE$path")"
done
admin=$(code "$BASE/admin/errors"); [ "$admin" = 401 ] || [ "$admin" = 403 ] && admin=refused
check "admin errors need the Super Admin"  refused "$admin"
check "bad id is a 400"                    400 "$(code "$BASE/ads/not-an-id/lead")"
check "malformed JSON is a 400"            400 "$(code -X POST -H 'Content-Type: application/json' -d '{bad' "$BASE/pulse")"
cors=$(curl -s -D - -o /dev/null --max-time 15 -H 'Origin: https://evil.example' "$BASE/auth/me" | grep -ci '^access-control-allow-origin')
check "other websites get no CORS permission" 0 "$cors"
banner=$(curl -s -D - -o /dev/null --max-time 15 "$BASE/shows/now" | grep -ci '^x-powered-by')
check "no X-Powered-By banner"             0 "$banner"

if [ "$fails" = 0 ]; then echo "All API checks passed."; else echo "$fails API check(s) failed."; exit 1; fi
