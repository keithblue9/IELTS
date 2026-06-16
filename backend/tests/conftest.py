"""Shared pytest fixtures for IELTS backend testing."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ielts-ai-tutor-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _new_user_payload():
    eid = uuid.uuid4().hex[:10]
    return {
        "email": f"TEST_{eid}@demo.io",
        "password": "test123",
        "name": "Test User",
    }


@pytest.fixture(scope="session")
def signup_user(http):
    """Create one fresh user and reuse for the whole session to limit DB cost."""
    payload = _new_user_payload()
    r = http.post(f"{API}/auth/signup", json=payload, timeout=30)
    assert r.status_code == 200, f"Signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {"payload": payload, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def auth_headers(signup_user):
    return {"Authorization": f"Bearer {signup_user['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def auth_session(signup_user):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {signup_user['token']}",
        "Content-Type": "application/json",
    })
    return s
