"""End-to-end backend tests for IELTS Mentor API.

Covers:
- Health
- Auth (signup/login/me)
- Profile (GET/PUT)
- Speaking (topics/start/turn/finish/sessions) — LLM-backed
- Writing (prompts/submit/upload) — LLM-backed
- Listening (generate/list/submit) — LLM-backed (slow ~20-40s)
- Reading (generate/submit) — LLM-backed
- TTS (verify audio/mpeg return)
- STT (verify endpoint surface with a tiny TTS-generated mp3)
- Dashboard stats
"""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ielts-ai-tutor-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

LLM_TIMEOUT = 120
LISTEN_TIMEOUT = 240


# ===================== HEALTH =====================
class TestHealth:
    def test_root_ok(self, http):
        r = http.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "IELTS" in data.get("service", "")


# ===================== AUTH =====================
class TestAuth:
    def test_signup_returns_token_and_user(self, signup_user):
        token = signup_user["token"]
        user = signup_user["user"]
        assert isinstance(token, str) and len(token) > 20
        assert user["email"].lower() == signup_user["payload"]["email"].lower()
        assert user["name"] == signup_user["payload"]["name"]
        assert "id" in user

    def test_signup_duplicate_returns_400(self, http, signup_user):
        r = http.post(f"{API}/auth/signup", json=signup_user["payload"], timeout=30)
        assert r.status_code == 400

    def test_login_success(self, http, signup_user):
        r = http.post(
            f"{API}/auth/login",
            json={"email": signup_user["payload"]["email"], "password": signup_user["payload"]["password"]},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["email"].lower() == signup_user["payload"]["email"].lower()

    def test_login_wrong_password_returns_401(self, http, signup_user):
        r = http.post(
            f"{API}/auth/login",
            json={"email": signup_user["payload"]["email"], "password": "wrongpass"},
            timeout=30,
        )
        assert r.status_code == 401

    def test_me_with_token(self, auth_session, signup_user):
        r = auth_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"].lower() == signup_user["payload"]["email"].lower()

    def test_me_without_token_401(self, http):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ===================== PROFILE =====================
class TestProfile:
    def test_default_profile(self, auth_session):
        r = auth_session.get(f"{API}/profile", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["target_band"] == 7.0
        assert "tutor_voice" in data
        assert "native_language" in data

    def test_update_profile(self, auth_session):
        payload = {
            "target_band": 7.5,
            "native_language": "Spanish",
            "weak_areas": ["grammar", "fluency"],
        }
        r = auth_session.put(f"{API}/profile", json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["target_band"] == 7.5
        assert data["native_language"] == "Spanish"
        assert "grammar" in data["weak_areas"]

        # Verify persistence
        r2 = auth_session.get(f"{API}/profile", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["target_band"] == 7.5


# ===================== SPEAKING =====================
class TestSpeaking:
    @pytest.fixture(scope="class")
    def speak_state(self):
        return {}

    def test_topics(self, auth_session):
        r = auth_session.get(f"{API}/speaking/topics", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("part1"), list) and len(data["part1"]) > 0
        assert isinstance(data.get("part2"), list) and len(data["part2"]) > 0
        assert isinstance(data.get("part3"), list) and len(data["part3"]) > 0

    def test_start_speaking_session(self, auth_session, speak_state):
        r = auth_session.post(
            f"{API}/speaking/start",
            json={"part": 1, "topic": "Hometown"},
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data and isinstance(data["session_id"], str)
        assert data["topic"] == "Hometown"
        assert data.get("spoken") and len(data["spoken"]) > 5
        speak_state["session_id"] = data["session_id"]

    def test_speaking_turn(self, auth_session, speak_state):
        sid = speak_state.get("session_id")
        assert sid, "Need session_id from prior test"
        r = auth_session.post(
            f"{API}/speaking/turn",
            json={
                "session_id": sid,
                "user_text": "I'm from Jakarta. It's a busy city with lots of food and traffic. I really enjoy living there because of the diverse culture.",
            },
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("reply") and isinstance(data["reply"], str) and len(data["reply"]) > 3
        assert data["session_id"] == sid

    def test_speaking_finish(self, auth_session, speak_state):
        sid = speak_state.get("session_id")
        assert sid
        r = auth_session.post(
            f"{API}/speaking/finish",
            json={"session_id": sid},
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == sid
        score = data.get("score")
        assert score and "overall_band" in score and "criteria" in score
        assert isinstance(score["overall_band"], (int, float))

    def test_speaking_sessions_list(self, auth_session, speak_state):
        r = auth_session.get(f"{API}/speaking/sessions", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [it["id"] for it in items]
        assert speak_state["session_id"] in ids


# ===================== WRITING =====================
class TestWriting:
    @pytest.fixture(scope="class")
    def write_state(self):
        return {}

    def test_prompts(self, auth_session):
        r = auth_session.get(f"{API}/writing/prompts", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("task1"), list) and len(data["task1"]) > 0
        assert isinstance(data.get("task2"), list) and len(data["task2"]) > 0

    def test_submit_writing(self, auth_session, write_state):
        response = (
            "In recent years, the rise of remote work has fundamentally reshaped how professionals approach "
            "their careers. While critics argue that working from home leads to reduced productivity and weaker "
            "team bonds, I firmly believe the benefits outweigh the drawbacks. Firstly, remote work provides "
            "considerable flexibility, allowing employees to balance personal responsibilities with their "
            "professional duties. For instance, parents can spend more time with their children while still "
            "meeting deadlines. Secondly, companies benefit from a wider talent pool because geographic "
            "boundaries are removed. However, it is essential that employers invest in collaboration tools and "
            "establish clear communication norms to maintain team cohesion. In conclusion, remote work, when "
            "properly managed, can drive both employee satisfaction and organisational growth, making it a "
            "valuable model for the modern workplace."
        )
        r = auth_session.post(
            f"{API}/writing/submit",
            json={"task": 2, "prompt": "Some people think remote work is beneficial. Discuss.", "response_text": response},
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["word_count"] >= 100
        assert "score" in data
        sc = data["score"]
        assert "overall_band" in sc and "criteria" in sc
        write_state["submission_id"] = data["id"]

    def test_submit_writing_too_short(self, auth_session):
        r = auth_session.post(
            f"{API}/writing/submit",
            json={"task": 2, "prompt": "x", "response_text": "too short"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_upload_txt(self, auth_session, signup_user):
        # multipart upload — use raw requests with Authorization header
        headers = {"Authorization": f"Bearer {signup_user['token']}"}
        content = b"Hello world. This is a test essay uploaded as plain text."
        files = {"file": ("essay.txt", io.BytesIO(content), "text/plain")}
        r = requests.post(f"{API}/writing/upload", headers=headers, files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "text" in data and "Hello world" in data["text"]
        assert data["word_count"] >= 5


# ===================== LISTENING =====================
class TestListening:
    @pytest.fixture(scope="class")
    def listen_state(self):
        return {}

    def test_generate_listening_test(self, auth_session, listen_state):
        r = auth_session.post(f"{API}/listening/generate", timeout=LISTEN_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert isinstance(data.get("sections"), list) and len(data["sections"]) >= 1
        # answers should NOT leak in response
        for sec in data["sections"]:
            for q in sec.get("questions", []):
                assert "answer" not in q, "Answer key leaked in /listening/generate response"
        # Build dummy answers map for submit test
        listen_state["test_id"] = data["id"]
        answers = {}
        for sec in data["sections"]:
            for q in sec.get("questions", []):
                answers[str(q["q_number"])] = "A"
        listen_state["answers"] = answers

    def test_list_tests_hides_answers(self, auth_session, listen_state):
        r = auth_session.get(f"{API}/listening/tests", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [it["id"] for it in items]
        assert listen_state["test_id"] in ids
        for it in items:
            for sec in it.get("sections", []):
                for q in sec.get("questions", []):
                    assert "answer" not in q

    def test_submit_listening(self, auth_session, listen_state):
        r = auth_session.post(
            f"{API}/listening/submit",
            json={"test_id": listen_state["test_id"], "answers": listen_state["answers"]},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "correct" in data and "total" in data and "band" in data
        assert isinstance(data["band"], (int, float))
        assert isinstance(data["review"], list)


# ===================== READING =====================
class TestReading:
    @pytest.fixture(scope="class")
    def reading_state(self):
        return {}

    def test_generate_reading(self, auth_session, reading_state):
        r = auth_session.post(f"{API}/reading/generate", timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert "passage" in data and len(data["passage"]) > 100
        assert isinstance(data.get("questions"), list) and len(data["questions"]) >= 1
        for q in data["questions"]:
            assert "answer" not in q
        reading_state["passage_id"] = data["id"]
        reading_state["answers"] = {str(q["q_number"]): "A" for q in data["questions"]}

    def test_submit_reading(self, auth_session, reading_state):
        r = auth_session.post(
            f"{API}/reading/submit",
            json={"passage_id": reading_state["passage_id"], "answers": reading_state["answers"]},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "correct" in data and "total" in data and "band" in data


# ===================== TTS / STT =====================
class TestAudio:
    @pytest.fixture(scope="class")
    def audio_state(self):
        return {}

    def test_tts_returns_mp3(self, signup_user, audio_state):
        headers = {"Authorization": f"Bearer {signup_user['token']}", "Content-Type": "application/json"}
        r = requests.post(
            f"{API}/tts",
            headers=headers,
            json={"text": "Hello, this is a short IELTS test.", "voice": "nova"},
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("audio/")
        assert len(r.content) > 1000  # mp3 must be >1KB
        audio_state["mp3"] = r.content

    def test_tts_empty_text(self, auth_session):
        r = auth_session.post(f"{API}/tts", json={"text": "  "}, timeout=15)
        assert r.status_code == 400

    def test_stt_endpoint_wired(self, signup_user, audio_state):
        """Round-trip TTS->STT to ensure both endpoints are wired correctly."""
        mp3 = audio_state.get("mp3")
        if not mp3:
            pytest.skip("No TTS audio available to test STT")
        headers = {"Authorization": f"Bearer {signup_user['token']}"}
        files = {"file": ("clip.mp3", io.BytesIO(mp3), "audio/mpeg")}
        r = requests.post(f"{API}/stt", headers=headers, files=files, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "text" in data and isinstance(data["text"], str)

    def test_stt_requires_auth(self):
        files = {"file": ("clip.mp3", io.BytesIO(b"\x00" * 100), "audio/mpeg")}
        r = requests.post(f"{API}/stt", files=files, timeout=30)
        assert r.status_code == 401


# ===================== DASHBOARD =====================
class TestDashboard:
    def test_stats_shape(self, auth_session):
        r = auth_session.get(f"{API}/dashboard/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data and "bands" in data
        counts = data["counts"]
        assert "speaking_sessions" in counts
        assert "writing_submissions" in counts
        assert "listening_attempts" in counts
        # After running speaking/writing/listening tests, counts should be >= 1
        assert counts["speaking_sessions"] >= 1
        assert counts["writing_submissions"] >= 1
        assert counts["listening_attempts"] >= 1
