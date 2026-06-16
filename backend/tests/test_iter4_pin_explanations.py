"""Iteration 4 — PIN auth, change-PIN, explanations in listening/reading,
writing/generate-prompt, dashboard pain-points. Verifies refactor + back-compat.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
LLM_TIMEOUT = 120
LISTEN_TIMEOUT = 240
DEFAULT_PIN = "123456"
NEW_PIN = "654321"


@pytest.fixture(scope="module")
def owner_token():
    """Login owner via PIN, get token. Skip rest if this fails."""
    r = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"PIN login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_session(owner_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"})
    return s


# ===================== PIN AUTH =====================
class TestPinAuth:
    def test_pin_login_default(self):
        r = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and len(data["token"]) > 20
        assert data["user"]["email"] == "owner@local"
        assert "id" in data["user"]

    def test_pin_login_wrong_pin_401(self):
        r = requests.post(f"{API}/auth/pin-login", json={"pin": "000000"}, timeout=30)
        assert r.status_code == 401

    def test_change_pin_and_revert(self, owner_session):
        # change 123456 -> 654321
        r = owner_session.post(f"{API}/auth/change-pin",
                               json={"current_pin": DEFAULT_PIN, "new_pin": NEW_PIN}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # default pin no longer works
        r2 = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=30)
        assert r2.status_code == 401

        # new pin works
        r3 = requests.post(f"{API}/auth/pin-login", json={"pin": NEW_PIN}, timeout=30)
        assert r3.status_code == 200
        new_token = r3.json()["token"]

        # CRITICAL: revert back so future runs work
        s2 = requests.Session()
        s2.headers.update({"Authorization": f"Bearer {new_token}", "Content-Type": "application/json"})
        r4 = s2.post(f"{API}/auth/change-pin",
                     json={"current_pin": NEW_PIN, "new_pin": DEFAULT_PIN}, timeout=30)
        assert r4.status_code == 200, r4.text

        # Verify default restored
        r5 = requests.post(f"{API}/auth/pin-login", json={"pin": DEFAULT_PIN}, timeout=30)
        assert r5.status_code == 200, "FAILED TO REVERT PIN — humans/future tests will be locked out!"

    def test_change_pin_wrong_current(self, owner_session):
        r = owner_session.post(f"{API}/auth/change-pin",
                               json={"current_pin": "000999", "new_pin": "111111"}, timeout=30)
        assert r.status_code == 400


# ===================== BACK-COMPAT (Profile, dashboard stats, TTS) =====================
class TestBackCompat:
    def test_profile_get(self, owner_session):
        r = owner_session.get(f"{API}/profile", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "target_band" in data

    def test_dashboard_stats(self, owner_session):
        r = owner_session.get(f"{API}/dashboard/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data and "bands" in data

    def test_tts_works(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/tts", headers=headers,
                          json={"text": "Hello world", "voice": "nova"}, timeout=LLM_TIMEOUT)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/")
        assert len(r.content) > 500


# ===================== WRITING GENERATE-PROMPT =====================
class TestWritingGeneratePrompt:
    def test_generate_prompt_task2(self, owner_session):
        r = owner_session.post(f"{API}/writing/generate-prompt?task=2&hint=technology", timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "prompt" in data
        assert isinstance(data["prompt"], str) and len(data["prompt"]) > 100

    def test_generate_prompt_task1(self, owner_session):
        r = owner_session.post(f"{API}/writing/generate-prompt?task=1", timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "prompt" in data and len(data["prompt"]) > 50

    def test_generate_prompt_invalid_task(self, owner_session):
        r = owner_session.post(f"{API}/writing/generate-prompt?task=5", timeout=30)
        assert r.status_code == 400


# ===================== LISTENING with EXPLANATIONS =====================
class TestListeningExplanations:
    @pytest.fixture(scope="class")
    def state(self):
        return {}

    def test_generate_no_answer_no_explanation_leak(self, owner_session, state):
        # /listening/generate may exceed Cloudflare 60s edge timeout intermittently;
        # if generate 502s, fall back to an existing test from /listening/tests.
        try:
            r = owner_session.post(f"{API}/listening/generate", timeout=LISTEN_TIMEOUT)
        except Exception as e:
            r = None
            print(f"generate request raised: {e}")
        data = None
        if r is not None and r.status_code == 200:
            data = r.json()
            for sec in data["sections"]:
                for q in sec.get("questions", []):
                    assert "answer" not in q, "answer leaked in /listening/generate"
                    assert "explanation" not in q, "explanation leaked in /listening/generate"
        else:
            # fallback: pull an existing test
            rl = owner_session.get(f"{API}/listening/tests", timeout=15)
            assert rl.status_code == 200
            items = rl.json()
            assert len(items) > 0, "no existing listening tests to fall back to"
            data = items[0]
            print(f"NOTE: /listening/generate returned {r.status_code if r else 'ERR'} — using existing test {data['id']} as fallback")
        state["test_id"] = data["id"]
        answers = {}
        for sec in data["sections"]:
            for q in sec.get("questions", []):
                answers[str(q["q_number"])] = "A"
        state["answers"] = answers

    def test_list_endpoint_leak_check(self, owner_session):
        """Bug check: /listening/tests should also strip explanation (not just answer)."""
        rl = owner_session.get(f"{API}/listening/tests", timeout=15)
        assert rl.status_code == 200
        items = rl.json()
        for it in items:
            for sec in it.get("sections", []):
                for q in sec.get("questions", []):
                    assert "answer" not in q, "answer leaked in /listening/tests list"
                    assert "explanation" not in q, "BUG: explanation leaked in /listening/tests list endpoint"

    def test_detail_endpoint_also_hides(self, owner_session, state):
        r = owner_session.get(f"{API}/listening/tests/{state['test_id']}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for sec in data.get("sections", []):
            for q in sec.get("questions", []):
                assert "answer" not in q
                assert "explanation" not in q

    def test_submit_returns_explanations(self, owner_session, state):
        r = owner_session.post(f"{API}/listening/submit",
                               json={"test_id": state["test_id"], "answers": state["answers"]},
                               timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "review" in data and isinstance(data["review"], list)
        assert len(data["review"]) > 0
        # All items must have an 'explanation' key, and most should be non-empty
        non_empty = 0
        for item in data["review"]:
            assert "explanation" in item, "missing explanation key in review item"
            if isinstance(item["explanation"], str) and item["explanation"].strip():
                non_empty += 1
        assert non_empty >= len(data["review"]) // 2, \
            f"too few explanations populated: {non_empty}/{len(data['review'])}"


# ===================== READING with EXPLANATIONS =====================
class TestReadingExplanations:
    @pytest.fixture(scope="class")
    def state(self):
        return {}

    def test_generate_no_leak(self, owner_session, state):
        try:
            r = owner_session.post(f"{API}/reading/generate", timeout=LLM_TIMEOUT)
        except Exception:
            r = None
        if r is not None and r.status_code == 200:
            data = r.json()
            for q in data["questions"]:
                assert "answer" not in q
                assert "explanation" not in q
        else:
            rl = owner_session.get(f"{API}/reading/passages", timeout=15)
            assert rl.status_code == 200
            items = rl.json()
            assert len(items) > 0
            data = items[0]
            print(f"NOTE: /reading/generate fallback — used existing passage {data['id']}")
        state["passage_id"] = data["id"]
        state["answers"] = {str(q["q_number"]): "A" for q in data["questions"]}

    def test_reading_list_leak_check(self, owner_session):
        """Bug check: /reading/passages list should also strip explanation."""
        rl = owner_session.get(f"{API}/reading/passages", timeout=15)
        assert rl.status_code == 200
        for p in rl.json():
            for q in p.get("questions", []):
                assert "answer" not in q
                assert "explanation" not in q, "BUG: explanation leaked in /reading/passages list endpoint"

    def test_submit_returns_explanations(self, owner_session, state):
        r = owner_session.post(f"{API}/reading/submit",
                               json={"passage_id": state["passage_id"], "answers": state["answers"]},
                               timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("review"), list) and len(data["review"]) > 0
        non_empty = 0
        for item in data["review"]:
            assert "explanation" in item
            if isinstance(item["explanation"], str) and item["explanation"].strip():
                non_empty += 1
        assert non_empty >= len(data["review"]) // 2


# ===================== DASHBOARD PAIN POINTS =====================
class TestPainPoints:
    def test_shape(self, owner_session):
        r = owner_session.get(f"{API}/dashboard/pain-points", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("speaking", "writing", "listening", "weakest", "strongest", "session_counts"):
            assert key in data, f"missing key {key} in pain-points response"
        assert isinstance(data["speaking"], dict)
        assert isinstance(data["writing"], dict)
        assert isinstance(data["weakest"], list)
        assert isinstance(data["strongest"], list)
        assert isinstance(data["session_counts"], dict)
        for k in ("speaking", "writing", "listening"):
            assert k in data["session_counts"]

    def test_weakest_has_tip_after_data(self, owner_session):
        """After running listening submit above (creates an attempt) we may already have data.
        Submit a quick writing+speaking session so weakest[] is populated."""
        # 1) speaking session — start, finish (turn optional)
        r = owner_session.post(f"{API}/speaking/start",
                               json={"part": 1, "topic": "Hometown"}, timeout=LLM_TIMEOUT)
        assert r.status_code == 200
        sid = r.json()["session_id"]
        owner_session.post(f"{API}/speaking/turn",
                           json={"session_id": sid, "user_text": "I live in Jakarta and I love the food and people."},
                           timeout=LLM_TIMEOUT)
        rf = owner_session.post(f"{API}/speaking/finish", json={"session_id": sid}, timeout=LLM_TIMEOUT)
        assert rf.status_code == 200

        # 2) writing submission with enough words
        essay = (
            "Working from home has become a major trend in modern professional life. "
            "While some argue that remote work reduces collaboration and weakens team spirit, "
            "I believe that the flexibility it offers outweighs these concerns. Employees can "
            "manage their personal duties alongside professional responsibilities, leading to "
            "greater satisfaction. Furthermore, companies gain access to a global talent pool "
            "without geographic restrictions. To make remote work effective, employers must "
            "invest in proper communication tools and set clear expectations. In conclusion, "
            "remote work is a sustainable model that benefits both individuals and organisations."
        )
        rw = owner_session.post(f"{API}/writing/submit",
                                json={"task": 2, "prompt": "Discuss remote work benefits.", "response_text": essay},
                                timeout=LLM_TIMEOUT)
        assert rw.status_code == 200

        # 3) now pain-points should show weakest items with tips
        r = owner_session.get(f"{API}/dashboard/pain-points", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["weakest"]) >= 1, "weakest list empty after sessions"
        for item in data["weakest"]:
            assert "label" in item and "band" in item and "tip" in item
            assert isinstance(item["tip"], str) and len(item["tip"]) > 5
