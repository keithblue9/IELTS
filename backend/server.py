"""IELTS Mentor — FastAPI backend."""
import io
import logging
import os
import random
from datetime import datetime, timezone
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
import llm_service  # noqa: E402
from models import (  # noqa: E402
    AuthResponse,
    ListeningAttempt,
    ListeningAttemptReq,
    ListeningTest,
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


# ===================== AUTH =====================
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
    # default profile
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
    items = await db.listening_tests.find({}, {"_id": 0, "sections.questions.answer": 0}).sort("created_at", -1).to_list(50)
    return items


@api.get("/listening/tests/{test_id}")
async def listening_test_detail(test_id: str, user_id: str = Depends(get_current_user_id)):
    # Hide answers from response (frontend should not see them before submit)
    t = await db.listening_tests.find_one({"id": test_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Test not found")
    for sec in t.get("sections", []):
        for q in sec.get("questions", []):
            q.pop("answer", None)
    return t


@api.post("/listening/generate")
async def listening_generate(topic_hint: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    test_data = await llm_service.generate_listening_test(topic_hint or "everyday life and academic")
    if not test_data or "sections" not in test_data:
        raise HTTPException(status_code=500, detail="Failed to generate test. Please retry.")
    test = ListeningTest(**test_data).model_dump()
    await db.listening_tests.insert_one(test)
    # don't return answers
    safe = {**test}
    for sec in safe.get("sections", []):
        for q in sec.get("questions", []):
            q.pop("answer", None)
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
    items = await db.reading_passages.find({}, {"_id": 0, "questions.answer": 0}).sort("created_at", -1).to_list(50)
    return items


@api.get("/reading/passages/{passage_id}")
async def reading_passage_detail(passage_id: str, user_id: str = Depends(get_current_user_id)):
    p = await db.reading_passages.find_one({"id": passage_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    for q in p.get("questions", []):
        q.pop("answer", None)
    return p


@api.post("/reading/generate")
async def reading_generate(topic_hint: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    data = await llm_service.generate_reading_passage(topic_hint or "science and society")
    if not data or "passage" not in data:
        raise HTTPException(status_code=500, detail="Failed to generate passage. Please retry.")
    passage = ReadingPassage(**data).model_dump()
    await db.reading_passages.insert_one(passage)
    safe = {**passage}
    for q in safe.get("questions", []):
        q.pop("answer", None)
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
    try:
        audio = await synthesize_speech(payload.text, voice=payload.voice or "nova")
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail="TTS failed")
    return Response(content=audio, media_type="audio/mpeg")


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
