#!/usr/bin/env python3
"""Seed dummy data via the Live Presence backend API.

Why this exists:
- The SQL seed (insert_dummy_data.sql) can drift from auth requirements (password hashing).
- API seeding guarantees logins work and exercises real business logic.

Default behavior:
- Creates or logs in N users (seed01@example.com, ...).
- Assigns interests.
- Creates posts near a given center lat/lon.
- Adds likes, comments, and reactions across users.
- Optionally marks some users live + sends a heartbeat.

Requires:
- Backend running (default: http://localhost:8080)

Usage example:
  python3 scripts/seed_api_dummy_data.py --users 12 --posts-per-user 3 --live-users 6
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Iterable


DEFAULT_INTERESTS = [
    "General",
    "Coffee",
    "Food",
    "Tech",
    "Fitness",
    "Music",
    "Travel",
    "Sports",
]

REACTIONS = ["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"]


@dataclass(frozen=True)
class AuthInfo:
    email: str
    password: str
    display_name: str
    user_id: str
    access_token: str


def _json_loads_maybe(raw: str) -> Any:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return raw


def http_json(method: str, url: str, *, token: str | None = None, body: Any | None = None, timeout_s: float = 15.0):
    headers = {
        "Accept": "application/json",
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url=url, data=data, headers=headers, method=method.upper())

    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, _json_loads_maybe(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return e.code, _json_loads_maybe(raw)
    except urllib.error.URLError as e:
        raise RuntimeError(f"Failed to reach backend at {url}: {e}") from e


def random_point_near(lat: float, lon: float, radius_m: float) -> tuple[float, float]:
    # Uniform over disk area.
    r = radius_m * math.sqrt(random.random())
    theta = random.random() * 2.0 * math.pi
    dx = r * math.cos(theta)
    dy = r * math.sin(theta)

    # Convert meters to degrees.
    dlat = dy / 111_320.0
    dlon = dx / (111_320.0 * math.cos(math.radians(lat)) + 1e-9)

    return lat + dlat, lon + dlon


def ensure_user(base_url: str, *, email: str, password: str, display_name: str) -> AuthInfo:
    register_url = f"{base_url}/api/auth/register"
    login_url = f"{base_url}/api/auth/login"

    status, payload = http_json(
        "POST",
        register_url,
        body={"email": email, "password": password, "displayName": display_name},
    )
    if status == 200 and isinstance(payload, dict) and payload.get("accessToken"):
        return AuthInfo(
            email=email,
            password=password,
            display_name=display_name,
            user_id=str(payload.get("userId")),
            access_token=str(payload.get("accessToken")),
        )

    # If already registered, log in.
    if status == 409:
        status, payload = http_json("POST", login_url, body={"email": email, "password": password})
        if status == 200 and isinstance(payload, dict) and payload.get("accessToken"):
            return AuthInfo(
                email=email,
                password=password,
                display_name=str(payload.get("displayName") or display_name),
                user_id=str(payload.get("userId")),
                access_token=str(payload.get("accessToken")),
            )

    raise RuntimeError(f"Failed to register/login {email}: HTTP {status} {payload}")


def set_interest(base_url: str, auth: AuthInfo, interest: str) -> None:
    url = f"{base_url}/api/me/interest"
    status, payload = http_json("PUT", url, token=auth.access_token, body={"interest": interest})
    if status not in (200, 204):
        raise RuntimeError(f"Failed to set interest for {auth.email}: HTTP {status} {payload}")


def heartbeat(base_url: str, auth: AuthInfo, *, lat: float, lon: float, is_live: bool) -> None:
    url = f"{base_url}/api/presence/heartbeat"
    status, payload = http_json(
        "POST",
        url,
        token=auth.access_token,
        body={"lat": lat, "lon": lon, "isLive": is_live},
    )
    if status not in (200, 204):
        raise RuntimeError(f"Failed heartbeat for {auth.email}: HTTP {status} {payload}")


def create_post(base_url: str, auth: AuthInfo, *, content: str, interest: str, lat: float, lon: float, image_url: str | None):
    url = f"{base_url}/api/posts"
    status, payload = http_json(
        "POST",
        url,
        token=auth.access_token,
        body={
            "content": content,
            "interest": interest,
            "lat": lat,
            "lon": lon,
            "imageUrl": image_url,
        },
    )
    if status != 200 or not isinstance(payload, dict) or not payload.get("id"):
        raise RuntimeError(f"Failed createPost for {auth.email}: HTTP {status} {payload}")
    return str(payload["id"])


def toggle_like(base_url: str, auth: AuthInfo, post_id: str) -> None:
    url = f"{base_url}/api/posts/{post_id}/like"
    status, payload = http_json("POST", url, token=auth.access_token)
    if status != 200:
        raise RuntimeError(f"Failed toggleLike {post_id}: HTTP {status} {payload}")


def add_comment(base_url: str, auth: AuthInfo, post_id: str, content: str) -> None:
    url = f"{base_url}/api/posts/{post_id}/comments"
    status, payload = http_json("POST", url, token=auth.access_token, body={"content": content})
    if status != 200:
        raise RuntimeError(f"Failed addComment {post_id}: HTTP {status} {payload}")


def react(base_url: str, auth: AuthInfo, post_id: str, reaction_type: str) -> None:
    url = f"{base_url}/api/posts/{post_id}/react"
    status, payload = http_json("POST", url, token=auth.access_token, body={"reactionType": reaction_type})
    if status != 200:
        raise RuntimeError(f"Failed react {post_id}: HTTP {status} {payload}")


def chunked(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Seed Live Presence via API")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Backend base URL")
    parser.add_argument("--users", type=int, default=12, help="Number of users to create/login")
    parser.add_argument("--password", default="123456", help="Password for all seeded users")
    parser.add_argument("--posts-per-user", type=int, default=3, help="Posts per user")
    parser.add_argument("--center-lat", type=float, default=37.7749, help="Center latitude")
    parser.add_argument("--center-lon", type=float, default=-122.4194, help="Center longitude")
    parser.add_argument("--radius-m", type=float, default=3000.0, help="Post location radius in meters")
    parser.add_argument("--live-users", type=int, default=6, help="How many users to mark live")
    parser.add_argument("--likes-per-user", type=int, default=6, help="How many likes each user performs")
    parser.add_argument("--comments-per-user", type=int, default=3, help="How many comments each user performs")
    parser.add_argument("--reactions-per-user", type=int, default=4, help="How many reactions each user performs")
    parser.add_argument("--seed", type=int, default=None, help="Random seed (optional)")
    parser.add_argument("--run-id", default=None, help="Optional tag embedded in post/comment content")

    args = parser.parse_args(argv)

    if args.users <= 0:
        print("--users must be > 0", file=sys.stderr)
        return 2

    if args.posts_per_user < 0:
        print("--posts-per-user must be >= 0", file=sys.stderr)
        return 2

    if args.seed is not None:
        random.seed(args.seed)

    run_id = args.run_id or time.strftime("%Y%m%d-%H%M%S")

    base_url = args.base_url.rstrip("/")

    # Quick health check (best-effort).
    try:
        http_json("GET", f"{base_url}/actuator/health")
    except Exception:
        pass

    # 1) Create/login users.
    users: list[AuthInfo] = []
    for i in range(1, args.users + 1):
        email = f"seed{i:02d}@example.com"
        display_name = f"Seed User {i:02d}"
        auth = ensure_user(base_url, email=email, password=args.password, display_name=display_name)
        users.append(auth)

    # 2) Set interests (spread across list).
    for idx, auth in enumerate(users):
        interest = DEFAULT_INTERESTS[idx % len(DEFAULT_INTERESTS)]
        set_interest(base_url, auth, interest)

    # 3) Mark some users live with heartbeats.
    live_count = max(0, min(args.live_users, len(users)))
    for auth in users[:live_count]:
        lat, lon = random_point_near(args.center_lat, args.center_lon, args.radius_m)
        heartbeat(base_url, auth, lat=lat, lon=lon, is_live=True)

    # 4) Create posts.
    post_ids: list[str] = []
    for idx, auth in enumerate(users):
        interest = DEFAULT_INTERESTS[idx % len(DEFAULT_INTERESTS)]
        for j in range(args.posts_per_user):
            lat, lon = random_point_near(args.center_lat, args.center_lon, args.radius_m)
            content = f"[{run_id}] {auth.display_name}: post #{j + 1} about {interest}."
            post_id = create_post(
                base_url,
                auth,
                content=content,
                interest=interest,
                lat=lat,
                lon=lon,
                image_url=None,
            )
            post_ids.append(post_id)

    # Nothing else to do.
    if not post_ids:
        print("Seeded users only (no posts requested).")
        for u in users:
            print(f"- {u.email} / {u.password}")
        return 0

    # 5) Likes, comments, reactions across users.
    for auth in users:
        # Avoid self bias; just sample from global list.
        sample_pool = post_ids

        for post_id in random.sample(sample_pool, k=min(args.likes_per_user, len(sample_pool))):
            toggle_like(base_url, auth, post_id)

        for post_id in random.sample(sample_pool, k=min(args.comments_per_user, len(sample_pool))):
            add_comment(base_url, auth, post_id, f"[{run_id}] {auth.display_name}: nice post!")

        for post_id in random.sample(sample_pool, k=min(args.reactions_per_user, len(sample_pool))):
            reaction = random.choice(REACTIONS)
            react(base_url, auth, post_id, reaction)

    print("Done.")
    print("Seeded logins:")
    for u in users:
        print(f"- {u.email} / {u.password}")
    print("Tip: fetch feed near your center:")
    print(
        f"  GET {base_url}/api/posts/feed?lat={args.center_lat}&lon={args.center_lon}&radiusKm=10&limit=50&offset=0"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
