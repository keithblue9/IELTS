"""Iter6 — Badges + reminder profile fields."""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DEFAULT_PIN = "123456"


@pytest.fixture(scope="module")
def s():
    r = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"PIN login failed: {r.status_code}")
    token = r.json()["token"]
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return sess


# ---------- Profile reminder fields ----------
class TestProfileReminder:
    def test_profile_has_reminder_fields(self, s):
        r = s.get(f"{API}/profile", timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert "reminder_enabled" in p
        assert "reminder_time" in p
        assert isinstance(p["reminder_enabled"], bool)

    def test_put_profile_persists_reminder(self, s):
        payload = {"reminder_enabled": True, "reminder_time": "08:30"}
        r = s.put(f"{API}/profile", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["reminder_enabled"] is True
        assert p["reminder_time"] == "08:30"

        # GET verifies persistence
        r2 = s.get(f"{API}/profile", timeout=15)
        p2 = r2.json()
        assert p2["reminder_enabled"] is True
        assert p2["reminder_time"] == "08:30"

    def test_put_profile_reminder_off(self, s):
        r = s.put(f"{API}/profile", json={"reminder_enabled": False, "reminder_time": "07:00"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["reminder_enabled"] is False
        assert r.json()["reminder_time"] == "07:00"


# ---------- Badges endpoint shape ----------
class TestBadges:
    @pytest.fixture(scope="class")
    def badges_data(self, s):
        r = s.get(f"{API}/badges", timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_shape(self, badges_data):
        for key in ("badges", "earned_count", "total", "counters"):
            assert key in badges_data
        assert badges_data["total"] == 11
        assert len(badges_data["badges"]) == 11

    def test_badge_fields(self, badges_data):
        for b in badges_data["badges"]:
            for k in ("id", "type", "threshold", "title", "desc", "icon", "earned", "progress", "current"):
                assert k in b, f"missing {k} in badge {b.get('id')}"
            assert b["progress"] <= b["threshold"], f"progress > threshold for {b['id']}"
            if b["earned"]:
                assert b["progress"] == b["threshold"]

    def test_expected_badge_ids(self, badges_data):
        ids = {b["id"] for b in badges_data["badges"]}
        for need in ("streak-3", "streak-7", "streak-30", "streak-100",
                     "xp-100", "xp-500", "xp-1000", "xp-5000",
                     "writer-5", "speaker-5", "listener-5"):
            assert need in ids, f"badge {need} missing"

    def test_counters_present(self, badges_data):
        c = badges_data["counters"]
        for k in ("streak", "xp", "writing", "speaking", "listening"):
            assert k in c
            assert isinstance(c[k], int)

    def test_xp_100_earned_with_existing_data(self, s, badges_data):
        # Iter5 left total_xp = 125 (>= 100) — verify xp-100 unlocked
        if badges_data["counters"]["xp"] >= 100:
            xp100 = next(b for b in badges_data["badges"] if b["id"] == "xp-100")
            assert xp100["earned"] is True, "xp-100 should be earned when xp>=100"


# ---------- Writer-5 unlock by creating submissions ----------
class TestWriter5Unlock:
    def test_unlock_writer_5(self, s):
        r = s.get(f"{API}/badges", timeout=15)
        assert r.status_code == 200
        before = r.json()
        write_count = before["counters"]["writing"]
        if write_count >= 5:
            # already unlocked or close — verify
            wb = next(b for b in before["badges"] if b["id"] == "writer-5")
            assert wb["earned"] is True
            return
        needed = 5 - write_count
        # Create submissions via writing/submit (LLM call — costly). Limit to actually needed.
        prompt = "Some people think technology has made our lives more complex. Do you agree or disagree?"
        text = ("Technology has undeniably transformed our daily lives in profound ways. "
                "While some argue it makes life more complex, I firmly believe the benefits "
                "outweigh the complications. From instant communication to medical advances, "
                "technology empowers us to achieve more with less effort and time.") * 2
        for _ in range(needed):
            r = s.post(f"{API}/writing/submit",
                       json={"task": 2, "prompt": prompt, "response_text": text},
                       timeout=120)
            assert r.status_code == 200, f"writing/submit failed: {r.status_code} {r.text}"

        r = s.get(f"{API}/badges", timeout=15)
        after = r.json()
        assert after["counters"]["writing"] >= 5
        wb = next(b for b in after["badges"] if b["id"] == "writer-5")
        assert wb["earned"] is True, f"writer-5 should be earned: {wb}"
        assert wb["progress"] == 5
        assert wb["current"] >= 5


# ---------- Back-compat: previous endpoints still work ----------
class TestBackCompat:
    def test_drill_streak(self, s):
        r = s.get(f"{API}/drill/streak", timeout=15)
        assert r.status_code == 200
        for k in ("streak_days", "total_xp", "completed_count", "today_done"):
            assert k in r.json()

    def test_listening_tests_no_leak(self, s):
        r = s.get(f"{API}/listening/tests", timeout=15)
        assert r.status_code == 200
        for it in r.json():
            for sec in it.get("sections", []):
                for q in sec.get("questions", []):
                    assert "answer" not in q
                    assert "explanation" not in q

    def test_reading_passages_no_leak(self, s):
        r = s.get(f"{API}/reading/passages", timeout=15)
        assert r.status_code == 200
        for p in r.json():
            for q in p.get("questions", []):
                assert "answer" not in q
                assert "explanation" not in q

    def test_pain_points(self, s):
        r = s.get(f"{API}/dashboard/pain-points", timeout=15)
        assert r.status_code == 200
        for k in ("speaking", "writing", "weakest", "strongest"):
            assert k in r.json()
