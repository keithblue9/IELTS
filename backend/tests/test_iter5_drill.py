"""Iteration 5 — Daily Drill backend tests.

Tests:
- /api/drill/streak (initial + after completion)
- /api/drill/today (cached behavior, item structure)
- /api/drill/complete-item (idempotent, xp, completion bonus)
- /api/drill/history
- Back-compat: /api/listening/tests, /api/reading/passages no explanation leak
  (this was the iter4 outstanding bug; verify fix)
"""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DEFAULT_PIN = "123456"
DRILL_TIMEOUT = 180  # claude generation can take ~30s, allow safety margin


@pytest.fixture(scope="module")
def owner_session():
    r = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"PIN login failed: {r.status_code} {r.text}")
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ===================== STREAK =====================
class TestDrillStreakInitial:
    def test_streak_shape(self, owner_session):
        r = owner_session.get(f"{API}/drill/streak", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("streak_days", "total_xp", "completed_count", "today_done"):
            assert key in data, f"missing key {key}"
        assert isinstance(data["streak_days"], int)
        assert isinstance(data["total_xp"], int)
        assert isinstance(data["completed_count"], int)
        assert isinstance(data["today_done"], bool)


# ===================== TODAY (generate + cache) =====================
class TestDrillToday:
    @pytest.fixture(scope="class")
    def state(self):
        return {}

    def test_get_today_generates_or_returns_existing(self, owner_session, state):
        r = owner_session.get(f"{API}/drill/today", timeout=DRILL_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        # core shape
        for k in ("id", "user_id", "date_str", "items", "completed_items", "xp_earned", "completed"):
            assert k in data, f"missing key {k} in drill: {list(data.keys())}"
        assert isinstance(data["items"], list)
        assert len(data["items"]) == 4, f"expected 4 items, got {len(data['items'])}"

        # items in order: vocab, listen, speak, grammar
        expected_types = ["vocab", "listen", "speak", "grammar"]
        for i, it in enumerate(data["items"]):
            assert "type" in it and "title" in it and "minutes" in it and "data" in it
            assert it["type"] == expected_types[i], f"item {i} type={it['type']} expected {expected_types[i]}"

        # vocab item.data.cards
        vocab = data["items"][0]
        assert "cards" in vocab["data"]
        assert isinstance(vocab["data"]["cards"], list) and len(vocab["data"]["cards"]) >= 1

        # listen item.data.script + questions
        listen = data["items"][1]
        assert "script" in listen["data"]
        assert "questions" in listen["data"]
        assert isinstance(listen["data"]["questions"], list) and len(listen["data"]["questions"]) >= 1

        # speak item.data.prompt + model_answer + tips
        speak = data["items"][2]
        assert "prompt" in speak["data"]
        assert "model_answer" in speak["data"]
        assert "tips" in speak["data"]
        assert isinstance(speak["data"]["tips"], list)

        # grammar item.data.sentences
        grammar = data["items"][3]
        assert "sentences" in grammar["data"]
        assert isinstance(grammar["data"]["sentences"], list)
        for s in grammar["data"]["sentences"]:
            assert "wrong" in s and "fixed" in s and "explanation" in s

        state["drill"] = data

    def test_second_call_returns_same_drill_cached(self, owner_session, state):
        """Second call same day must return exact same drill (no re-generation)."""
        import time as _t
        t0 = _t.time()
        r = owner_session.get(f"{API}/drill/today", timeout=30)
        elapsed = _t.time() - t0
        assert r.status_code == 200
        d2 = r.json()
        assert d2["id"] == state["drill"]["id"], "drill ID changed on second call — not cached!"
        assert d2["date_str"] == state["drill"]["date_str"]
        # Should be fast (cached, no LLM call); allow generous threshold
        assert elapsed < 10, f"Second call took {elapsed:.1f}s — looks like it re-generated"


# ===================== COMPLETE-ITEM =====================
class TestDrillComplete:
    @pytest.fixture(scope="class")
    def state(self):
        return {}

    def test_get_drill_for_completion(self, owner_session, state):
        r = owner_session.get(f"{API}/drill/today", timeout=DRILL_TIMEOUT)
        assert r.status_code == 200
        state["drill"] = r.json()
        state["drill_id"] = r.json()["id"]
        state["initial_completed"] = list(r.json().get("completed_items", []))
        state["initial_xp"] = r.json().get("xp_earned", 0)
        state["was_completed"] = r.json().get("completed", False)

    def test_complete_item_0_adds_xp(self, owner_session, state):
        if 0 in state["initial_completed"]:
            pytest.skip("item 0 already completed in previous run; cannot retest idempotent add")
        r = owner_session.post(
            f"{API}/drill/complete-item",
            json={"drill_id": state["drill_id"], "item_index": 0},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert 0 in data["completed_items"]
        assert data["xp_earned"] == state["initial_xp"] + 25

    def test_complete_item_0_idempotent(self, owner_session, state):
        """Re-completing the same item must NOT double-add to completed_items or XP."""
        # capture current state
        r0 = owner_session.get(f"{API}/drill/today", timeout=30)
        assert r0.status_code == 200
        before = r0.json()
        if 0 not in before["completed_items"]:
            pytest.skip("Item 0 was not completed yet — cannot test idempotency")
        xp_before = before["xp_earned"]
        count_before = before["completed_items"].count(0)
        # repeat call
        r = owner_session.post(
            f"{API}/drill/complete-item",
            json={"drill_id": state["drill_id"], "item_index": 0},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["completed_items"].count(0) == count_before, "item 0 duplicated"
        assert data["xp_earned"] == xp_before, f"XP double-added: {xp_before} -> {data['xp_earned']}"

    def test_complete_all_items_and_bonus(self, owner_session, state):
        # complete items 1,2,3 (item 0 may already be done)
        for idx in (1, 2, 3):
            r = owner_session.post(
                f"{API}/drill/complete-item",
                json={"drill_id": state["drill_id"], "item_index": idx},
                timeout=15,
            )
            assert r.status_code == 200, r.text
        final = r.json()
        assert final["completed"] is True, "drill.completed should be true after all 4 items"
        assert final["completed_at"], "completed_at should be set"
        assert set(final["completed_items"]) == {0, 1, 2, 3}
        # 4 items × 25 + 25 bonus = 125 (assuming initial_xp was 0)
        # Be tolerant if drill was partly done before
        assert final["xp_earned"] >= 125, f"xp_earned={final['xp_earned']} expected >= 125"


# ===================== STREAK POST-COMPLETION =====================
class TestStreakAfterCompletion:
    def test_streak_today_done(self, owner_session):
        r = owner_session.get(f"{API}/drill/streak", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["today_done"] is True, "today_done should be true after completing all items"
        assert data["streak_days"] >= 1, f"streak_days={data['streak_days']} should be >=1"
        assert data["completed_count"] >= 1
        assert data["total_xp"] >= 125


# ===================== HISTORY =====================
class TestDrillHistory:
    def test_history_contains_drill(self, owner_session):
        r = owner_session.get(f"{API}/drill/history", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        d = items[0]
        for k in ("id", "date_str", "items", "completed"):
            assert k in d


# ===================== BACK-COMPAT (verify iter4 leak fix) =====================
class TestBackCompatNoExplanationLeak:
    def test_listening_tests_no_explanation_leak(self, owner_session):
        r = owner_session.get(f"{API}/listening/tests", timeout=15)
        assert r.status_code == 200
        for it in r.json():
            for sec in it.get("sections", []):
                for q in sec.get("questions", []):
                    assert "answer" not in q
                    assert "explanation" not in q, "BUG: explanation still leaks in /listening/tests"

    def test_reading_passages_no_explanation_leak(self, owner_session):
        r = owner_session.get(f"{API}/reading/passages", timeout=15)
        assert r.status_code == 200
        for p in r.json():
            for q in p.get("questions", []):
                assert "answer" not in q
                assert "explanation" not in q, "BUG: explanation still leaks in /reading/passages"

    def test_pin_login_still_works(self):
        r = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=15)
        assert r.status_code == 200

    def test_dashboard_stats(self, owner_session):
        r = owner_session.get(f"{API}/dashboard/stats", timeout=15)
        assert r.status_code == 200
        assert "counts" in r.json()

    def test_dashboard_pain_points(self, owner_session):
        r = owner_session.get(f"{API}/dashboard/pain-points", timeout=15)
        assert r.status_code == 200
        for k in ("speaking", "writing", "weakest", "strongest"):
            assert k in r.json()
