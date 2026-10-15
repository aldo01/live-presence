#!/usr/bin/env bash
#
# Keeps a set of demo users "online" by heartbeating the presence service on a
# loop. This populates the live map with interactive markers of varied vibes
# around Delhi so the online-users / vibe-filter / hover-to-chat features can be
# exercised without opening many real browser sessions.
#
# Presence is ephemeral (Redis GEO + short TTL), so this must keep running to
# keep the users online. Stop it with Ctrl-C (or by killing the process); the
# users then expire from the map within ~15s.
#
# Usage: bash scripts/seed_presence.sh
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
PASSWORD="demo123"
INTERVAL="${INTERVAL:-8}"

# email | display heartbeat name | vibe | lat | lon   (locations spread around Delhi NCR)
users=(
  "aarav@live.dev|Aarav Mehta|Coffee|28.6315|77.2167"
  "diya@live.dev|Diya Sharma|Music|28.6129|77.2295"
  "kabir@live.dev|Kabir Singh|Sports|28.5706|77.3210"
  "ananya@live.dev|Ananya Rao|Art|28.5921|77.0460"
  "vivaan@live.dev|Vivaan Gupta|Tech|28.4595|77.0266"
  "isha@live.dev|Isha Nair|Fitness|28.7041|77.1025"
  "rohan@live.dev|Rohan Das|Food|28.5677|77.2433"
  "meera@live.dev|Meera Iyer|Photography|28.5494|77.1926"
)

echo "==> Logging in ${#users[@]} demo users against $GATEWAY"
declare -a TOKENS
for i in "${!users[@]}"; do
  IFS='|' read -r email name vibe lat lon <<< "${users[$i]}"
  tok=$(curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken // empty')
  if [ -z "$tok" ]; then
    echo "!! login failed for $email (run scripts/seed_dummy_data.sh first)"; exit 1
  fi
  TOKENS[$i]="$tok"
  echo "   online: $name  [$vibe]  @ $lat,$lon"
done

echo "==> Heartbeating every ${INTERVAL}s (Ctrl-C to stop; users expire ~15s after)"
while true; do
  for i in "${!users[@]}"; do
    IFS='|' read -r email name vibe lat lon <<< "${users[$i]}"
    curl -s -o /dev/null -X POST "$GATEWAY/api/presence/heartbeat" \
      -H "Authorization: Bearer ${TOKENS[$i]}" -H 'Content-Type: application/json' \
      -d "{\"lat\":$lat,\"lon\":$lon,\"displayName\":\"$name\",\"interest\":\"$vibe\",\"isLive\":true}" || true
  done
  sleep "$INTERVAL"
done
