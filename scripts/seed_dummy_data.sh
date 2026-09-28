#!/usr/bin/env bash
#
# Seed schema-correct dummy data for local testing of the vibe feed.
#
# Unlike the legacy insert_dummy_data.sql (which predates the auth/core split and
# writes a monolithic `users` table with password_hash), this script works with
# the split services:
#   1. registers users through the gateway  -> credentials land in auth.users
#   2. inserts a matching public.users profile row (same id)
#   3. creates posts through the feed API    -> vibes normalised, located near BASE
#
# Posts are scattered around Delhi (the frontend's fallback location) so they show
# up in the UI even when the browser denies geolocation.
#
# Usage: bash scripts/seed_dummy_data.sh
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
BASE_LAT="${BASE_LAT:-28.6139}"
BASE_LON="${BASE_LON:-77.2090}"
PASSWORD="demo123"

PSQL=(docker compose exec -T postgres psql -U postgres -d livepresence -v ON_ERROR_STOP=1 -q)

names=("Demo User" "Aarav Mehta" "Diya Sharma" "Kabir Singh" "Ananya Rao" "Vivaan Gupta" "Isha Nair" "Rohan Das" "Meera Iyer")
emails=("demo@live.dev" "aarav@live.dev" "diya@live.dev" "kabir@live.dev" "ananya@live.dev" "vivaan@live.dev" "isha@live.dev" "rohan@live.dev" "meera@live.dev")
# One "home" vibe per user (used for their profile interest).
homevibes=("General" "Coffee" "Music" "Sports" "Art" "Tech" "Fitness" "Food" "Photography")

vibes=("Music" "Food" "Coffee" "Sports" "Fitness" "Tech" "Art" "Travel" "Gaming" "Photography" "Movies" "Hiking")

# A few content lines per vibe for realistic posts.
contents=(
  "Live acoustic set just kicked off here 🎶|Music"
  "This playlist is unreal, who's around?|Music"
  "Best butter chicken in the neighbourhood, hands down 🍛|Food"
  "Street food crawl starting now, join in!|Food"
  "Third coffee of the day and no regrets ☕|Coffee"
  "New cafe opened round the corner, cosy vibes|Coffee"
  "Pickup football match at the park, need 2 more ⚽|Sports"
  "Morning run done, 5k in the books 🏃|Fitness"
  "Leg day survived. Barely. 🏋️|Fitness"
  "Anyone up for a hackathon this weekend? 💻|Tech"
  "Shipping a side project tonight, wish me luck|Tech"
  "Sketching the skyline from the rooftop 🎨|Art"
  "Booked a spontaneous weekend trip ✈️|Travel"
  "Ranked up finally, GG 🎮|Gaming"
  "Golden hour shots came out amazing 📸|Photography"
  "Late night movie marathon, recommendations?|Movies"
  "Sunrise trek was worth every step 🥾|Hiking"
)

echo "==> Seeding against $GATEWAY (base $BASE_LAT,$BASE_LON)"

declare -a IDS
declare -a TOKENS

# --- 1 & register/login users -------------------------------------------------
for i in "${!emails[@]}"; do
  email="${emails[$i]}"; name="${names[$i]}"
  resp=$(curl -s -X POST "$GATEWAY/api/auth/register" -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"displayName\":\"$name\"}")
  token=$(echo "$resp" | jq -r '.accessToken // empty')
  id=$(echo "$resp" | jq -r '.userId // empty')
  if [ -z "$token" ]; then
    # Already exists -> log in
    resp=$(curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
          -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")
    token=$(echo "$resp" | jq -r '.accessToken // empty')
    id=$(echo "$resp" | jq -r '.userId // empty')
  fi
  if [ -z "$token" ] || [ -z "$id" ]; then
    echo "!! failed to provision $email: $resp"; exit 1
  fi
  IDS[$i]="$id"; TOKENS[$i]="$token"
  echo "   user $email -> $id"
done

# --- 2 & upsert public.users profile rows ------------------------------------
echo "==> Writing profile rows into public.users"
sql="BEGIN;"
for i in "${!IDS[@]}"; do
  id="${IDS[$i]}"; email="${emails[$i]}"; name="${names[$i]//\'/}"; vibe="${homevibes[$i]}"
  # small jitter around base so live users are spread on the map
  dlat=$(awk -v s=$RANDOM 'BEGIN{srand(s);printf "%.5f",(rand()-0.5)*0.12}')
  dlon=$(awk -v s=$((RANDOM+7)) 'BEGIN{srand(s);printf "%.5f",(rand()-0.5)*0.12}')
  lat=$(awk -v b=$BASE_LAT -v d=$dlat 'BEGIN{printf "%.6f",b+d}')
  lon=$(awk -v b=$BASE_LON -v d=$dlon 'BEGIN{printf "%.6f",b+d}')
  sql+="INSERT INTO users (id,email,display_name,interest,live,profile_public,last_location_lat,last_location_lon)
        VALUES ('$id','$email','$name','$vibe',true,true,$lat,$lon)
        ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name, interest=EXCLUDED.interest,
        live=true, last_location_lat=EXCLUDED.last_location_lat, last_location_lon=EXCLUDED.last_location_lon;"
done
sql+="COMMIT;"
echo "$sql" | "${PSQL[@]}"

# --- 3 & create posts via the feed API ---------------------------------------
echo "==> Creating posts via the feed API"
post_count=0
for i in "${!IDS[@]}"; do
  token="${TOKENS[$i]}"
  # each user makes 4-5 posts with random vibes near base
  n=$(( (RANDOM % 2) + 4 ))
  for ((j=0;j<n;j++)); do
    line="${contents[$((RANDOM % ${#contents[@]}))]}"
    content="${line%%|*}"; vibe="${line##*|}"
    dlat=$(awk -v s=$RANDOM 'BEGIN{srand(s);printf "%.5f",(rand()-0.5)*0.18}')
    dlon=$(awk -v s=$((RANDOM+3)) 'BEGIN{srand(s);printf "%.5f",(rand()-0.5)*0.18}')
    lat=$(awk -v b=$BASE_LAT -v d=$dlat 'BEGIN{printf "%.6f",b+d}')
    lon=$(awk -v b=$BASE_LON -v d=$dlon 'BEGIN{printf "%.6f",b+d}')
    curl -s -o /dev/null -X POST "$GATEWAY/api/posts" \
      -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
      -d "{\"content\":\"$content\",\"interest\":\"$vibe\",\"lat\":$lat,\"lon\":$lon,\"imageUrl\":null}"
    post_count=$((post_count+1))
  done
done
echo "==> Done. Seeded ${#IDS[@]} users and $post_count posts."
echo "    Login: demo@live.dev / demo123   (posts are around $BASE_LAT,$BASE_LON = Delhi)"
