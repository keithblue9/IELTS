"""IELTS Mentor — FastAPI backend."""
import io
import logging
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import create_token, get_current_user_id, hash_password, verify_password  # noqa: E402
from audio_service import synthesize_speech, transcribe_audio  # noqa: E402
import drill_service  # noqa: E402
import llm_service  # noqa: E402
import recap_service  # noqa: E402
from models import (  # noqa: E402
    AuthResponse,
    ChangePinReq,
    DailyDrill,
    DrillItemComplete,
    ListeningAttempt,
    ListeningAttemptReq,
    ListeningTest,
    PinLoginReq,
    Profile,
    ProfileUpdate,
    ReadingAttemptReq,
    ReadingPassage,
    SpeakingSession,
    SpeakingStartReq,
    SpeakingTurnReq,
    TTSReq,
    UserLogin,
    UserOut,
    UserSignup,
    WeeklyRecap,
    WritingSubmission,
    WritingSubmitReq,
    gen_id,
    now_iso,
)
from seed_data import (  # noqa: E402
    SPEAKING_PART1_TOPICS,
    SPEAKING_PART2_TOPICS,
    SPEAKING_PART3_TOPICS,
    WRITING_TASK1_PROMPTS,
    WRITING_TASK2_PROMPTS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ielts")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="IELTS Mentor API")
api = APIRouter(prefix="/api")


# ===================== HEALTH =====================
@api.get("/")
async def root():
    return {"service": "IELTS Mentor API", "status": "ok", "time": now_iso()}


# ===================== AUTH (PIN-based, single owner) =====================
OWNER_EMAIL = "owner@local"
DEFAULT_PIN = "123456"


async def ensure_owner() -> dict:
    """Single-user app: make sure exactly one owner exists with a PIN."""
    owner = await db.users.find_one({"email": OWNER_EMAIL})
    if owner:
        return owner
    user_id = gen_id()
    owner_doc = {
        "id": user_id,
        "email": OWNER_EMAIL,
        "name": "You",
        "password_hash": hash_password(DEFAULT_PIN),  # PIN stored hashed in same field
        "created_at": now_iso(),
        "is_owner": True,
    }
    await db.users.insert_one(owner_doc)
    profile = Profile(user_id=user_id).model_dump()
    await db.profiles.insert_one(profile)
    return owner_doc


@app.on_event("startup")
async def startup_seed():
    await ensure_owner()
    logger.info("Owner user ready (PIN-based auth)")


@api.post("/auth/pin-login", response_model=AuthResponse)
async def pin_login(payload: PinLoginReq):
    owner = await ensure_owner()
    if not verify_password(payload.pin, owner["password_hash"]):
        raise HTTPException(status_code=401, detail="Wrong PIN")
    token = create_token(owner["id"], owner["email"])
    return AuthResponse(
        token=token,
        user=UserOut(id=owner["id"], email=owner["email"], name=owner["name"], created_at=owner["created_at"]),
    )


@api.post("/auth/change-pin")
async def change_pin(payload: ChangePinReq, user_id: str = Depends(get_current_user_id)):
    user = await db.users.find_one({"id": user_id})
    if not user or not verify_password(payload.current_pin, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current PIN is wrong")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.new_pin)}},
    )
    return {"ok": True}


# Legacy email/password endpoints — kept for backward-compat tests but not used by UI
@api.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: UserSignup):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = gen_id()
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    profile = Profile(user_id=user_id).model_dump()
    await db.profiles.insert_one(profile)
    token = create_token(user_id, user_doc["email"])
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=user_doc["email"], name=user_doc["name"], created_at=user_doc["created_at"]),
    )


@api.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"])
    return AuthResponse(
        token=token,
        user=UserOut(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"]),
    )


@api.get("/auth/me", response_model=UserOut)
async def me(user_id: str = Depends(get_current_user_id)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**user)


# ===================== PROFILE =====================
@api.get("/profile", response_model=Profile)
async def get_profile(user_id: str = Depends(get_current_user_id)):
    p = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not p:
        # create on the fly
        new_p = Profile(user_id=user_id).model_dump()
        await db.profiles.insert_one(new_p)
        return Profile(**new_p)
    return Profile(**p)


@api.put("/profile", response_model=Profile)
async def update_profile(payload: ProfileUpdate, user_id: str = Depends(get_current_user_id)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    updates["updated_at"] = now_iso()
    await db.profiles.update_one({"user_id": user_id}, {"$set": updates}, upsert=True)
    p = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    return Profile(**p)


# ===================== DASHBOARD STATS =====================
@api.get("/dashboard/stats")
async def dashboard_stats(user_id: str = Depends(get_current_user_id)):
    speaking_count = await db.speaking_sessions.count_documents({"user_id": user_id, "status": "completed"})
    writing_count = await db.writing_submissions.count_documents({"user_id": user_id})
    listening_count = await db.listening_attempts.count_documents({"user_id": user_id})

    # latest bands
    latest_speak = await db.speaking_sessions.find(
        {"user_id": user_id, "status": "completed", "score": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    latest_write = await db.writing_submissions.find(
        {"user_id": user_id, "score": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    latest_listen = await db.listening_attempts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)

    def avg(items, getter):
        vals = [getter(i) for i in items if getter(i) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    bands = {
        "speaking": avg(latest_speak, lambda x: x.get("score", {}).get("overall_band")),
        "writing": avg(latest_write, lambda x: x.get("score", {}).get("overall_band")),
        "listening": avg(latest_listen, lambda x: x.get("band")),
    }
    overall_vals = [v for v in bands.values() if v is not None]
    overall = round(sum(overall_vals) / len(overall_vals), 1) if overall_vals else None

    history = []
    for s in (latest_speak[:10] + latest_write[:10] + latest_listen[:10]):
        band = (s.get("score") or {}).get("overall_band") if "score" in s else s.get("band")
        if band:
            history.append({"date": s.get("created_at", ""), "band": band})
    history.sort(key=lambda x: x["date"])

    return {
        "counts": {
            "speaking_sessions": speaking_count,
            "writing_submissions": writing_count,
            "listening_attempts": listening_count,
        },
        "bands": bands,
        "overall_band": overall,
        "history": history[-20:],
    }


@api.get("/dashboard/pain-points")
async def dashboard_pain_points(user_id: str = Depends(get_current_user_id)):
    """Aggregate per-criterion averages across recent speaking & writing sessions to identify weak spots."""
    speak = await db.speaking_sessions.find(
        {"user_id": user_id, "status": "completed", "score": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    write = await db.writing_submissions.find(
        {"user_id": user_id, "score": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    listen = await db.listening_attempts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(20)

    sp_crit = {"fluency": [], "lexical": [], "grammar": [], "pronunciation": []}
    for s in speak:
        c = (s.get("score") or {}).get("criteria") or {}
        for k in sp_crit:
            v = c.get(k)
            if isinstance(v, (int, float)):
                sp_crit[k].append(v)

    wr_crit = {"task_achievement": [], "coherence_cohesion": [], "lexical_resource": [], "grammar_accuracy": []}
    for w in write:
        c = (w.get("score") or {}).get("criteria") or {}
        for k in wr_crit:
            v = c.get(k)
            if isinstance(v, (int, float)):
                wr_crit[k].append(v)

    def avg(arr):
        return round(sum(arr) / len(arr), 1) if arr else None

    speaking_breakdown = {k.title(): avg(v) for k, v in sp_crit.items()}
    writing_breakdown = {k.replace("_", " ").title(): avg(v) for k, v in wr_crit.items()}
    listening_band = avg([a.get("band") for a in listen if isinstance(a.get("band"), (int, float))])

    # Build flat list of all available scores
    flat = []
    for label, val in {**speaking_breakdown, **writing_breakdown, "Listening": listening_band}.items():
        if val is not None:
            flat.append({"label": label, "band": val})

    # Identify weakest: bottom 3
    flat_sorted = sorted(flat, key=lambda x: x["band"])
    weakest = flat_sorted[:3]
    strongest = list(reversed(flat_sorted))[:3]

    # Tips per known criterion
    TIP_MAP = {
        "Fluency": "Reduce hesitations — try recording yourself answering 2-min prompts and listen back for filler words.",
        "Lexical": "Build topic-based vocabulary (work, education, environment). Aim for 3-4 collocations per response.",
        "Grammar": "Drill complex structures: conditionals, passive, relative clauses. Mix in at least one per paragraph.",
        "Pronunciation": "Practise word stress and sentence intonation. Shadow a native speaker for 5 min/day.",
        "Task Achievement": "Address every part of the prompt explicitly in your introduction and conclusion.",
        "Coherence Cohesion": "Use varied linking words. One topic sentence per paragraph; signpost clearly.",
        "Lexical Resource": "Replace common verbs (do, get, make) with precise synonyms. Avoid repetition.",
        "Grammar Accuracy": "Proof-read for tense consistency and articles (a/an/the).",
        "Listening": "Practise prediction before each section. Read questions during the example pause.",
    }
    weakest_with_tips = [{**w, "tip": TIP_MAP.get(w["label"], "Keep practising daily.")} for w in weakest]

    return {
        "speaking": speaking_breakdown,
        "writing": writing_breakdown,
        "listening": listening_band,
        "weakest": weakest_with_tips,
        "strongest": strongest,
        "session_counts": {"speaking": len(speak), "writing": len(write), "listening": len(listen)},
    }


# ===================== SPEAKING =====================
@api.get("/speaking/topics")
async def speaking_topics():
    return {
        "part1": SPEAKING_PART1_TOPICS,
        "part2": SPEAKING_PART2_TOPICS,
        "part3": SPEAKING_PART3_TOPICS,
    }


@api.post("/speaking/start")
async def speaking_start(payload: SpeakingStartReq, user_id: str = Depends(get_current_user_id)):
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or Profile(user_id=user_id).model_dump()
    topic = payload.topic
    if not topic:
        if payload.part == 1:
            topic = random.choice(SPEAKING_PART1_TOPICS)
        elif payload.part == 2:
            topic = random.choice(SPEAKING_PART2_TOPICS)
        else:
            topic = random.choice(SPEAKING_PART3_TOPICS)
    session_id = gen_id()

    opener = await llm_service.generate_speaking_opener(
        part=payload.part,
        topic=topic,
        target_band=profile.get("target_band", 7.0),
        personality=profile.get("tutor_personality", "encouraging"),
        native_language=profile.get("native_language", "Indonesian"),
        session_id=session_id,
    )

    spoken_text = opener["spoken"]
    session = SpeakingSession(
        id=session_id,
        user_id=user_id,
        part=payload.part,
        topic=topic,
        cue_card=opener.get("cue_card") or None,
        questions=[spoken_text],
        messages=[{"role": "assistant", "content": spoken_text}],
        status="active",
    ).model_dump()
    await db.speaking_sessions.insert_one(session)
    return {"session_id": session_id, "topic": topic, "spoken": spoken_text, "cue_card": opener.get("cue_card") or None, "part": payload.part}


@api.post("/speaking/turn")
async def speaking_turn(payload: SpeakingTurnReq, user_id: str = Depends(get_current_user_id)):
    session = await db.speaking_sessions.find_one({"id": payload.session_id, "user_id": user_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("status") != "active":
        raise HTTPException(status_code=400, detail="Session already completed")

    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    history = session.get("messages", []) + [{"role": "user", "content": payload.user_text}]

    reply = await llm_service.speaking_turn(
        session_id=payload.session_id,
        part=session["part"],
        topic=session["topic"],
        target_band=profile.get("target_band", 7.0),
        personality=profile.get("tutor_personality", "encouraging"),
        native_language=profile.get("native_language", "Indonesian"),
        history=session.get("messages", []),
        user_text=payload.user_text,
    )

    new_messages = history + [{"role": "assistant", "content": reply}]
    await db.speaking_sessions.update_one(
        {"id": payload.session_id},
        {"$set": {"messages": new_messages}},
    )
    return {"reply": reply, "session_id": payload.session_id}


class SpeakingFinishReq(BaseModel):
    session_id: str


@api.post("/speaking/finish")
async def speaking_finish(payload: SpeakingFinishReq, user_id: str = Depends(get_current_user_id)):
    session = await db.speaking_sessions.find_one({"id": payload.session_id, "user_id": user_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    score = await llm_service.score_speaking(
        transcript=session.get("messages", []),
        topic=session["topic"],
        part=session["part"],
    )

    await db.speaking_sessions.update_one(
        {"id": payload.session_id},
        {"$set": {"status": "completed", "score": score, "completed_at": now_iso()}},
    )
    return {"session_id": payload.session_id, "score": score}


@api.get("/speaking/sessions")
async def speaking_sessions_list(user_id: str = Depends(get_current_user_id)):
    items = await db.speaking_sessions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@api.get("/speaking/sessions/{session_id}")
async def speaking_session_detail(session_id: str, user_id: str = Depends(get_current_user_id)):
    s = await db.speaking_sessions.find_one({"id": session_id, "user_id": user_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return s


# ===================== WRITING =====================
@api.get("/writing/prompts")
async def writing_prompts():
    return {"task1": WRITING_TASK1_PROMPTS, "task2": WRITING_TASK2_PROMPTS}


@api.post("/writing/generate-prompt")
async def writing_generate_prompt(task: int, hint: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    if task not in (1, 2):
        raise HTTPException(status_code=400, detail="task must be 1 or 2")
    data = await llm_service.generate_writing_prompt(task, hint or "")
    if not data or "prompt" not in data:
        raise HTTPException(status_code=500, detail="Failed to generate prompt")
    return data


@api.post("/writing/submit")
async def writing_submit(payload: WritingSubmitReq, user_id: str = Depends(get_current_user_id)):
    if len(payload.response_text.strip().split()) < 30:
        raise HTTPException(status_code=400, detail="Response too short (min 30 words for scoring).")
    score = await llm_service.score_writing(payload.task, payload.prompt, payload.response_text)
    submission = WritingSubmission(
        user_id=user_id,
        task=payload.task,
        prompt=payload.prompt,
        response_text=payload.response_text,
        word_count=len(payload.response_text.split()),
        score=score,
    ).model_dump()
    await db.writing_submissions.insert_one(submission)
    return {"id": submission["id"], "score": score, "word_count": submission["word_count"]}


@api.post("/writing/upload")
async def writing_upload(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """Extract text from .docx or .pdf upload — returns text only (frontend will combine with prompt/task)."""
    content = await file.read()
    name = (file.filename or "upload").lower()
    text = ""
    try:
        if name.endswith(".docx"):
            from docx import Document
            doc = Document(io.BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs)
        elif name.endswith(".pdf"):
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        elif name.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file. Upload .docx, .pdf, or .txt")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"file parse error: {e}")
        raise HTTPException(status_code=400, detail="Failed to read file content")
    return {"text": text.strip(), "word_count": len(text.split())}


@api.get("/writing/submissions")
async def writing_submissions_list(user_id: str = Depends(get_current_user_id)):
    items = await db.writing_submissions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@api.get("/writing/submissions/{submission_id}")
async def writing_submission_detail(submission_id: str, user_id: str = Depends(get_current_user_id)):
    s = await db.writing_submissions.find_one({"id": submission_id, "user_id": user_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return s


# ===================== LISTENING =====================
@api.get("/listening/tests")
async def listening_tests():
    items = await db.listening_tests.find(
        {},
        {"_id": 0, "sections.questions.answer": 0, "sections.questions.explanation": 0},
    ).sort("created_at", -1).to_list(50)
    return items


@api.get("/listening/tests/{test_id}")
async def listening_test_detail(test_id: str, user_id: str = Depends(get_current_user_id)):
    # Hide answers + explanations from response (frontend should not see them before submit)
    t = await db.listening_tests.find_one({"id": test_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Test not found")
    for sec in t.get("sections", []):
        for q in sec.get("questions", []):
            q.pop("answer", None)
            q.pop("explanation", None)
    return t


@api.post("/listening/generate")
async def listening_generate(topic_hint: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    test_data = await llm_service.generate_listening_test(topic_hint or "everyday life and academic")
    if not test_data or "sections" not in test_data:
        raise HTTPException(status_code=500, detail="Failed to generate test. Please retry.")
    test = ListeningTest(**test_data).model_dump()
    await db.listening_tests.insert_one(test)
    # build safe response (strip _id added by motor + strip answers)
    safe = {k: v for k, v in test.items() if k != "_id"}
    for sec in safe.get("sections", []):
        for q in sec.get("questions", []):
            q.pop("answer", None)
            q.pop("explanation", None)
    return safe


@api.post("/listening/submit")
async def listening_submit(payload: ListeningAttemptReq, user_id: str = Depends(get_current_user_id)):
    test = await db.listening_tests.find_one({"id": payload.test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    correct = 0
    total = 0
    review = []
    for sec in test.get("sections", []):
        for q in sec.get("questions", []):
            total += 1
            qn = str(q["q_number"])
            user_ans = (payload.answers.get(qn) or "").strip().lower()
            true_ans = str(q["answer"]).strip().lower()
            is_correct = user_ans == true_ans or (len(true_ans) > 3 and true_ans in user_ans)
            if is_correct:
                correct += 1
            review.append({
                "q_number": q["q_number"],
                "question": q["question"],
                "your_answer": payload.answers.get(qn, ""),
                "correct_answer": q["answer"],
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
            })
    band = llm_service.raw_to_band(correct, total)
    attempt = ListeningAttempt(
        user_id=user_id,
        test_id=payload.test_id,
        answers=payload.answers,
        correct=correct,
        total=total,
        band=band,
    ).model_dump()
    await db.listening_attempts.insert_one(attempt)
    return {"id": attempt["id"], "correct": correct, "total": total, "band": band, "review": review}


# ===================== READING =====================
@api.get("/reading/passages")
async def reading_passages_list():
    items = await db.reading_passages.find(
        {},
        {"_id": 0, "questions.answer": 0, "questions.explanation": 0},
    ).sort("created_at", -1).to_list(50)
    return items


@api.get("/reading/passages/{passage_id}")
async def reading_passage_detail(passage_id: str, user_id: str = Depends(get_current_user_id)):
    p = await db.reading_passages.find_one({"id": passage_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    for q in p.get("questions", []):
        q.pop("answer", None)
        q.pop("explanation", None)
    return p


@api.post("/reading/generate")
async def reading_generate(topic_hint: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    data = await llm_service.generate_reading_passage(topic_hint or "science and society")
    if not data or "passage" not in data:
        raise HTTPException(status_code=500, detail="Failed to generate passage. Please retry.")
    passage = ReadingPassage(**data).model_dump()
    await db.reading_passages.insert_one(passage)
    safe = {k: v for k, v in passage.items() if k != "_id"}
    for q in safe.get("questions", []):
        q.pop("answer", None)
        q.pop("explanation", None)
    return safe


@api.post("/reading/submit")
async def reading_submit(payload: ReadingAttemptReq, user_id: str = Depends(get_current_user_id)):
    passage = await db.reading_passages.find_one({"id": payload.passage_id}, {"_id": 0})
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    correct = 0
    total = 0
    review = []
    for q in passage.get("questions", []):
        total += 1
        qn = str(q["q_number"])
        user_ans = (payload.answers.get(qn) or "").strip().lower()
        true_ans = str(q["answer"]).strip().lower()
        is_correct = user_ans == true_ans or (len(true_ans) > 3 and true_ans in user_ans)
        if is_correct:
            correct += 1
        review.append({
            "q_number": q["q_number"],
            "question": q["question"],
            "your_answer": payload.answers.get(qn, ""),
            "correct_answer": q["answer"],
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
        })
    band = llm_service.raw_to_band(correct, total)
    return {"correct": correct, "total": total, "band": band, "review": review}


# ===================== AUDIO (STT + TTS) =====================
@api.post("/stt")
async def stt(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    content = await file.read()
    filename = file.filename or "audio.webm"
    if len(content) > 24 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (max 24MB)")
    try:
        text = await transcribe_audio(content, filename=filename, language="en")
    except Exception as e:
        logger.error(f"STT error: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")
    return {"text": text}


@api.post("/tts")
async def tts(payload: TTSReq, user_id: str = Depends(get_current_user_id)):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    # Pull voice settings from profile when not provided in the request payload
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    stability = payload.stability if payload.stability is not None else profile.get("tutor_voice_stability", 0.35)
    style = payload.style if payload.style is not None else profile.get("tutor_voice_style", 0.65)
    voice = payload.voice or profile.get("tutor_voice", "Bella")

    try:
        audio = await synthesize_speech(
            payload.text,
            voice=voice,
            stability=stability,
            style=style,
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail="TTS failed")
    return Response(content=audio, media_type="audio/mpeg")


# ===================== DAILY DRILL =====================
def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _compute_streak(user_id: str) -> int:
    """Count consecutive days (ending today or yesterday) where a drill was completed."""
    drills = await db.daily_drills.find(
        {"user_id": user_id, "completed": True}, {"_id": 0, "date_str": 1}
    ).sort("date_str", -1).to_list(120)
    if not drills:
        return 0
    today = datetime.now(timezone.utc).date()
    completed_days = {d["date_str"] for d in drills}
    streak = 0
    cursor = today
    # allow starting from today OR yesterday
    if cursor.isoformat() not in completed_days:
        from datetime import timedelta
        cursor = cursor - timedelta(days=1)
        if cursor.isoformat() not in completed_days:
            return 0
    from datetime import timedelta
    while cursor.isoformat() in completed_days:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


async def _pick_weak_area(user_id: str) -> str:
    """Pick the single most pressing weak area for today's drill."""
    speak = await db.speaking_sessions.find(
        {"user_id": user_id, "status": "completed", "score": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    write = await db.writing_submissions.find(
        {"user_id": user_id, "score": {"$ne": None}}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    avg_map = {}
    for s in speak:
        c = (s.get("score") or {}).get("criteria") or {}
        for k, v in c.items():
            if isinstance(v, (int, float)):
                avg_map.setdefault(k.title(), []).append(v)
    for w in write:
        c = (w.get("score") or {}).get("criteria") or {}
        for k, v in c.items():
            if isinstance(v, (int, float)):
                avg_map.setdefault(k.replace("_", " ").title(), []).append(v)

    if not avg_map:
        # fallback: take from profile weak_areas, or default
        profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
        if profile.get("weak_areas"):
            return profile["weak_areas"][0]
        return "Lexical Resource"

    averaged = {k: sum(v) / len(v) for k, v in avg_map.items()}
    return min(averaged, key=averaged.get)


@api.get("/drill/today")
async def drill_today(user_id: str = Depends(get_current_user_id)):
    today = _today_str()
    existing = await db.daily_drills.find_one({"user_id": user_id, "date_str": today}, {"_id": 0})
    if existing:
        return existing

    # generate fresh drill
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    target_band = profile.get("target_band", 7.0)
    native = profile.get("native_language", "Indonesian")
    weak = await _pick_weak_area(user_id)
    day_count = await db.daily_drills.count_documents({"user_id": user_id})

    data = await drill_service.generate_daily_drill(
        weak_area=weak, target_band=target_band, native_language=native, day_index=day_count + 1
    )
    if not data or "items" not in data:
        raise HTTPException(status_code=500, detail="Failed to generate today's drill — try again in a moment.")

    drill = DailyDrill(
        user_id=user_id,
        date_str=today,
        day_index=day_count + 1,
        title=data.get("title", f"Day {day_count + 1}"),
        focus_area=data.get("focus_area", weak),
        estimated_minutes=int(data.get("estimated_minutes", 8)),
        items=data.get("items", []),
    ).model_dump()
    await db.daily_drills.insert_one(drill)
    return {k: v for k, v in drill.items() if k != "_id"}


@api.post("/drill/complete-item")
async def drill_complete_item(payload: DrillItemComplete, user_id: str = Depends(get_current_user_id)):
    drill = await db.daily_drills.find_one({"id": payload.drill_id, "user_id": user_id}, {"_id": 0})
    if not drill:
        raise HTTPException(status_code=404, detail="Drill not found")
    completed = list(drill.get("completed_items", []))
    if payload.item_index in completed:
        return drill
    completed.append(payload.item_index)
    item_results = dict(drill.get("item_results", {}))
    if payload.result is not None:
        item_results[str(payload.item_index)] = payload.result

    total_items = len(drill.get("items", []))
    fully_done = len(completed) >= total_items
    xp = drill.get("xp_earned", 0) + 25
    update = {
        "completed_items": completed,
        "item_results": item_results,
        "xp_earned": xp,
    }
    if fully_done and not drill.get("completed"):
        update["completed"] = True
        update["completed_at"] = now_iso()
        update["xp_earned"] = xp + 25  # completion bonus
    await db.daily_drills.update_one({"id": payload.drill_id}, {"$set": update})
    refreshed = await db.daily_drills.find_one({"id": payload.drill_id}, {"_id": 0})
    return refreshed


@api.get("/drill/streak")
async def drill_streak(user_id: str = Depends(get_current_user_id)):
    streak = await _compute_streak(user_id)
    total_xp = 0
    cur = db.daily_drills.find({"user_id": user_id}, {"_id": 0, "xp_earned": 1})
    async for d in cur:
        total_xp += d.get("xp_earned", 0)
    completed_count = await db.daily_drills.count_documents({"user_id": user_id, "completed": True})
    today_done = await db.daily_drills.find_one(
        {"user_id": user_id, "date_str": _today_str(), "completed": True}
    )
    return {
        "streak_days": streak,
        "total_xp": total_xp,
        "completed_count": completed_count,
        "today_done": bool(today_done),
    }


@api.get("/drill/history")
async def drill_history(user_id: str = Depends(get_current_user_id)):
    items = await db.daily_drills.find({"user_id": user_id}, {"_id": 0}).sort("date_str", -1).to_list(60)
    return items


# ===================== WEEKLY RECAP =====================
def _iso_week_key(d: datetime = None) -> tuple:
    d = d or datetime.now(timezone.utc)
    iso = d.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _week_label(d: datetime = None) -> str:
    d = d or datetime.now(timezone.utc)
    iso = d.isocalendar()
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    if monday.month == sunday.month:
        return f"{monday.strftime('%b %-d')}–{sunday.strftime('%-d, %Y')}"
    return f"{monday.strftime('%b %-d')}–{sunday.strftime('%b %-d, %Y')}"


async def _build_recap_payload(user_id: str) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=7)
    since_iso = since.isoformat()

    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}

    speak = await db.speaking_sessions.find(
        {"user_id": user_id, "status": "completed", "created_at": {"$gte": since_iso}, "score": {"$ne": None}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    write = await db.writing_submissions.find(
        {"user_id": user_id, "created_at": {"$gte": since_iso}, "score": {"$ne": None}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    listen = await db.listening_attempts.find(
        {"user_id": user_id, "created_at": {"$gte": since_iso}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    drills = await db.daily_drills.find(
        {"user_id": user_id, "created_at": {"$gte": since_iso}}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    sp_crit = {}
    for s in speak:
        for k, v in ((s.get("score") or {}).get("criteria") or {}).items():
            if isinstance(v, (int, float)):
                sp_crit.setdefault(k, []).append(v)
    wr_crit = {}
    for w in write:
        for k, v in ((w.get("score") or {}).get("criteria") or {}).items():
            if isinstance(v, (int, float)):
                wr_crit.setdefault(k, []).append(v)

    # listening errors collected from attempts (we stored answers + test, can't easily reconstruct without re-grading; instead extract review-like data from test docs)
    listening_errors = []
    for a in listen[:5]:
        t = await db.listening_tests.find_one({"id": a.get("test_id")}, {"_id": 0})
        if not t:
            continue
        for sec in t.get("sections", []):
            for q in sec.get("questions", []):
                qn = str(q.get("q_number"))
                user_ans = (a.get("answers", {}).get(qn) or "").strip().lower()
                true_ans = str(q.get("answer", "")).strip().lower()
                if user_ans and user_ans != true_ans:
                    listening_errors.append(
                        {"q": q.get("question"), "your": user_ans, "correct": true_ans, "explanation": q.get("explanation", "")}
                    )

    grammar_drills = []
    vocab_drills = []
    for d in drills:
        for item in d.get("items", []):
            if item.get("type") == "grammar":
                for s in item.get("data", {}).get("sentences", []):
                    grammar_drills.append(s)
            elif item.get("type") == "vocab":
                for c in item.get("data", {}).get("cards", []):
                    vocab_drills.append(c)

    metrics = {
        "speaking_sessions": len(speak),
        "writing_submissions": len(write),
        "listening_attempts": len(listen),
        "drills_completed": sum(1 for d in drills if d.get("completed")),
        "drills_total": len(drills),
    }

    return {
        "profile": profile,
        "metrics": metrics,
        "speak_criteria": {k: v for k, v in sp_crit.items()},
        "write_criteria": {k: v for k, v in wr_crit.items()},
        "listening_errors": listening_errors,
        "grammar_drills": grammar_drills,
        "vocab_drills": vocab_drills,
    }


@api.get("/recap/this-week")
async def recap_this_week(user_id: str = Depends(get_current_user_id)):
    week_str = _iso_week_key()
    existing = await db.weekly_recaps.find_one(
        {"user_id": user_id, "week_str": week_str}, {"_id": 0}
    )
    if existing:
        return existing

    payload = await _build_recap_payload(user_id)
    metrics = payload["metrics"]
    if sum(metrics.values()) == 0:
        raise HTTPException(status_code=400, detail="Not enough activity this week — complete a session or drill first.")

    profile = payload["profile"]
    data = await recap_service.generate_weekly_recap(
        week_label=_week_label(),
        metrics=metrics,
        speak_criteria=payload["speak_criteria"],
        write_criteria=payload["write_criteria"],
        listening_errors=payload["listening_errors"],
        grammar_drills=payload["grammar_drills"],
        vocab_drills=payload["vocab_drills"],
        target_band=profile.get("target_band", 7.0),
        native_language=profile.get("native_language", "Indonesian"),
    )
    if not data or "essay" not in data:
        raise HTTPException(status_code=500, detail="Failed to generate recap — try again.")

    recap = WeeklyRecap(
        user_id=user_id,
        week_str=week_str,
        week_label=_week_label(),
        title=data.get("title", f"Week {week_str}"),
        headline=data.get("headline", ""),
        essay=data.get("essay", ""),
        common_errors=data.get("common_errors", []),
        top_vocab=data.get("top_vocab", []),
        next_week_focus=data.get("next_week_focus", ""),
        wallpaper_quote=data.get("wallpaper_quote", ""),
        metrics=metrics,
    ).model_dump()
    await db.weekly_recaps.insert_one(recap)
    return {k: v for k, v in recap.items() if k != "_id"}


@api.post("/recap/regenerate")
async def recap_regenerate(user_id: str = Depends(get_current_user_id)):
    week_str = _iso_week_key()
    await db.weekly_recaps.delete_many({"user_id": user_id, "week_str": week_str})
    return await recap_this_week(user_id=user_id)


@api.get("/recap/history")
async def recap_history(user_id: str = Depends(get_current_user_id)):
    items = await db.weekly_recaps.find({"user_id": user_id}, {"_id": 0}).sort("week_str", -1).to_list(20)
    return items


# ===================== BADGES / ACHIEVEMENTS =====================
BADGES = [
    {"id": "streak-3", "type": "streak", "threshold": 3, "title": "3-Day Spark", "desc": "Three days in a row", "icon": "🔥"},
    {"id": "streak-7", "type": "streak", "threshold": 7, "title": "Week Warrior", "desc": "Seven consecutive days", "icon": "🌟"},
    {"id": "streak-30", "type": "streak", "threshold": 30, "title": "Monthly Master", "desc": "30-day streak — habit locked in", "icon": "🏔️"},
    {"id": "streak-100", "type": "streak", "threshold": 100, "title": "Centurion", "desc": "100 days — band 8 is yours", "icon": "👑"},
    {"id": "xp-100", "type": "xp", "threshold": 100, "title": "First Steps", "desc": "Earned 100 XP", "icon": "🌱"},
    {"id": "xp-500", "type": "xp", "threshold": 500, "title": "Half-K Hero", "desc": "Earned 500 XP", "icon": "⚡"},
    {"id": "xp-1000", "type": "xp", "threshold": 1000, "title": "Kilo Club", "desc": "Earned 1,000 XP", "icon": "💎"},
    {"id": "xp-5000", "type": "xp", "threshold": 5000, "title": "XP Legend", "desc": "Earned 5,000 XP", "icon": "🏆"},
    {"id": "writer-5", "type": "writing", "threshold": 5, "title": "Wordsmith", "desc": "Submitted 5 essays", "icon": "✍️"},
    {"id": "speaker-5", "type": "speaking", "threshold": 5, "title": "Voice of Aria", "desc": "Completed 5 speaking sessions", "icon": "🎙️"},
    {"id": "listener-5", "type": "listening", "threshold": 5, "title": "Sharp Ears", "desc": "Finished 5 listening tests", "icon": "🎧"},
]


@api.get("/badges")
async def get_badges(user_id: str = Depends(get_current_user_id)):
    streak = await _compute_streak(user_id)
    total_xp = 0
    cur = db.daily_drills.find({"user_id": user_id}, {"_id": 0, "xp_earned": 1})
    async for d in cur:
        total_xp += d.get("xp_earned", 0)
    speak_count = await db.speaking_sessions.count_documents({"user_id": user_id, "status": "completed"})
    write_count = await db.writing_submissions.count_documents({"user_id": user_id})
    listen_count = await db.listening_attempts.count_documents({"user_id": user_id})

    counters = {
        "streak": streak,
        "xp": total_xp,
        "writing": write_count,
        "speaking": speak_count,
        "listening": listen_count,
    }
    result = []
    for b in BADGES:
        current = counters.get(b["type"], 0)
        earned = current >= b["threshold"]
        result.append({
            **b,
            "earned": earned,
            "progress": min(current, b["threshold"]),
            "current": current,
        })
    earned_count = sum(1 for b in result if b["earned"])
    return {"badges": result, "earned_count": earned_count, "total": len(result), "counters": counters}


# ===================== APP WIRING =====================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
