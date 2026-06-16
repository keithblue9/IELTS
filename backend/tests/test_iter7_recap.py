"""Iter7 — Weekly Recap endpoint tests."""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ielts-ai-tutor-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{API}/auth/pin-login", json={"pin": "123456"}, timeout=30)
    assert r.status_code == 200, f"PIN login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


# ----- /api/recap/this-week generation & caching -----
def test_recap_this_week_generates(headers):
    r = requests.get(f"{API}/recap/this-week", headers=headers, timeout=90)
    assert r.status_code == 200, f"recap this-week failed: {r.status_code} {r.text}"
    data = r.json()
    # Required keys
    for k in ["id", "week_str", "week_label", "title", "headline", "essay",
              "common_errors", "top_vocab", "next_week_focus", "wallpaper_quote", "metrics"]:
        assert k in data, f"missing key: {k}"
    # Essay >=200 chars
    assert isinstance(data["essay"], str)
    assert len(data["essay"]) >= 200, f"essay too short ({len(data['essay'])} chars)"
    # Lists
    assert isinstance(data["common_errors"], list)
    assert isinstance(data["top_vocab"], list)
    # Wallpaper quote string
    assert isinstance(data["wallpaper_quote"], str)
    # week_str ISO format YYYY-Www
    assert "-W" in data["week_str"]


def test_recap_this_week_cached_returns_fast(headers):
    """Second call same week should be cached and FAST (<2s)."""
    t0 = time.time()
    r = requests.get(f"{API}/recap/this-week", headers=headers, timeout=10)
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 2.0, f"second call took {elapsed:.2f}s — not cached"
    data = r.json()
    assert data["essay"]


# ----- /api/recap/history -----
def test_recap_history_after_generation(headers):
    r = requests.get(f"{API}/recap/history", headers=headers, timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    # sorted desc by week_str
    week_strs = [i["week_str"] for i in items]
    assert week_strs == sorted(week_strs, reverse=True)


# ----- /api/recap/regenerate -----
def test_recap_regenerate(headers):
    # Get current id first
    r1 = requests.get(f"{API}/recap/this-week", headers=headers, timeout=30)
    assert r1.status_code == 200
    id1 = r1.json()["id"]
    week1 = r1.json()["week_str"]

    r2 = requests.post(f"{API}/recap/regenerate", headers=headers, timeout=90)
    assert r2.status_code == 200, f"regenerate failed: {r2.status_code} {r2.text}"
    data = r2.json()
    assert data["week_str"] == week1
    assert data["id"] != id1, "new recap should have new id"
    assert len(data["essay"]) >= 200


# ----- back-compat: ensure existing endpoints still 200 -----
def test_existing_endpoints_still_work(headers):
    endpoints = [
        ("/auth/me", "GET"),
        ("/profile", "GET"),
        ("/dashboard/stats", "GET"),
        ("/dashboard/pain-points", "GET"),
        ("/drill/streak", "GET"),
        ("/badges", "GET"),
        ("/speaking/topics", "GET"),
        ("/writing/prompts", "GET"),
    ]
    for path, method in endpoints:
        r = requests.request(method, f"{API}{path}", headers=headers, timeout=30)
        assert r.status_code == 200, f"{method} {path} -> {r.status_code} {r.text[:200]}"


# ----- 400 path is documented; do NOT test destructively per request -----
