"""Pydantic models for the IELTS app (UUID id-based, no Mongo _id leak)."""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth & user profile ----------
class PinLoginReq(BaseModel):
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ChangePinReq(BaseModel):
    current_pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(min_length=1, max_length=120)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ---------- Profile / preferences ----------
class Profile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    user_id: str
    target_band: float = 7.0  # 4.0 - 9.0
    current_band: float = 5.5
    test_date: Optional[str] = None  # iso date
    daily_minutes: int = 30
    tutor_voice: str = "nova"  # OpenAI TTS voice
    tutor_personality: str = "encouraging"  # encouraging | strict | conversational
    native_language: str = "Indonesian"
    weak_areas: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class ProfileUpdate(BaseModel):
    target_band: Optional[float] = None
    current_band: Optional[float] = None
    test_date: Optional[str] = None
    daily_minutes: Optional[int] = None
    tutor_voice: Optional[str] = None
    tutor_personality: Optional[str] = None
    native_language: Optional[str] = None
    weak_areas: Optional[List[str]] = None


# ---------- Speaking ----------
class SpeakingStartReq(BaseModel):
    part: int = Field(ge=1, le=3)  # IELTS Speaking Part 1, 2, 3
    topic: Optional[str] = None


class SpeakingTurnReq(BaseModel):
    session_id: str
    user_text: str  # transcript from STT (frontend will transcribe first via /api/stt)


class SpeakingSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    user_id: str
    part: int
    topic: str
    cue_card: Optional[str] = None
    questions: List[str] = Field(default_factory=list)
    messages: List[Dict[str, Any]] = Field(default_factory=list)  # [{role, content, audio_url?}]
    status: str = "active"  # active | completed
    score: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=now_iso)
    completed_at: Optional[str] = None


# ---------- Writing ----------
class WritingSubmitReq(BaseModel):
    task: int = Field(ge=1, le=2)  # task 1 or 2
    prompt: str
    response_text: str


class WritingSubmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    user_id: str
    task: int
    prompt: str
    response_text: str
    word_count: int = 0
    score: Optional[Dict[str, Any]] = None  # overall band + criteria + feedback
    created_at: str = Field(default_factory=now_iso)


# ---------- Listening ----------
class ListeningQuestion(BaseModel):
    q_number: int
    question: str
    options: Optional[List[str]] = None  # for MCQ; null = fill-in
    answer: str  # ground truth (used for grading)
    explanation: Optional[str] = None  # post-submit teaching


class ListeningSection(BaseModel):
    section: int  # 1-4
    title: str
    script: str  # narrative TTS will speak
    questions: List[ListeningQuestion]


class ListeningTest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    title: str
    difficulty: str = "intermediate"
    sections: List[ListeningSection]
    created_at: str = Field(default_factory=now_iso)


class ListeningAttemptReq(BaseModel):
    test_id: str
    answers: Dict[str, str]  # {"1": "A", "2": "library", ...}


class ListeningAttempt(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    user_id: str
    test_id: str
    answers: Dict[str, str]
    correct: int = 0
    total: int = 0
    band: float = 0.0
    created_at: str = Field(default_factory=now_iso)


# ---------- Reading ----------
class ReadingQuestion(BaseModel):
    q_number: int
    question: str
    options: Optional[List[str]] = None
    answer: str
    explanation: Optional[str] = None


class ReadingPassage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    title: str
    passage: str
    questions: List[ReadingQuestion]
    difficulty: str = "intermediate"
    created_at: str = Field(default_factory=now_iso)


class ReadingAttemptReq(BaseModel):
    passage_id: str
    answers: Dict[str, str]


# ---------- TTS / STT ----------
class TTSReq(BaseModel):
    text: str
    voice: str = "nova"


# ---------- Daily Drill ----------
class DrillItemComplete(BaseModel):
    drill_id: str
    item_index: int
    result: Optional[Dict[str, Any]] = None  # e.g., {"correct": 2, "total": 3}


class DailyDrill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    user_id: str
    date_str: str  # YYYY-MM-DD
    day_index: int = 1
    title: str = ""
    focus_area: str = ""
    estimated_minutes: int = 8
    items: List[Dict[str, Any]] = Field(default_factory=list)  # generated content
    completed_items: List[int] = Field(default_factory=list)  # item indexes completed
    item_results: Dict[str, Any] = Field(default_factory=dict)  # {"<idx>": {...}}
    xp_earned: int = 0
    completed: bool = False
    completed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
