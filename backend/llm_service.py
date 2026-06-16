"""LLM service for IELTS tutoring & scoring (Claude Sonnet 4.5 via Anthropic SDK).

NOTE: imports from local `llm_compat` shim instead of `emergentintegrations` so the
backend can run on standard Python hosts (Render, Railway, Fly.io, etc.).
"""
import json
import os
import re
from typing import Dict, List, Optional

from llm_compat import LlmChat, UserMessage  # local shim

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"


def _build_chat(session_id: str, system_message: str) -> LlmChat:
    return LlmChat(
        api_key=ANTHROPIC_API_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)


def _parse_json(text: str) -> Optional[dict]:
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def raw_to_band(correct: int, total: int) -> float:
    """Map raw score (correct/total) to approximate IELTS band."""
    if total == 0:
        return 0.0
    pct = correct / total
    # Standard IELTS band conversion approximation
    if pct >= 0.975:
        return 9.0
    elif pct >= 0.925:
        return 8.5
    elif pct >= 0.875:
        return 8.0
    elif pct >= 0.80:
        return 7.5
    elif pct >= 0.725:
        return 7.0
    elif pct >= 0.65:
        return 6.5
    elif pct >= 0.575:
        return 6.0
    elif pct >= 0.50:
        return 5.5
    elif pct >= 0.40:
        return 5.0
    elif pct >= 0.30:
        return 4.5
    elif pct >= 0.20:
        return 4.0
    return 3.5


# ===================== SPEAKING =====================

SPEAKING_SYSTEM_TMPL = """You are Aria, a warm, attentive IELTS Speaking tutor and examiner.
You are conducting IELTS Speaking Part {part} with a candidate whose target band is {target_band}.
Personality: {personality}. Native language: {native_language}.

Tone: gentle, encouraging, naturally conversational. Use the candidate's name when known.
Soft acknowledgements like "lovely", "great", "go on" are welcome between questions.

Rules:
- Stay in character as the examiner.
- Ask ONE question at a time, then wait for the candidate's spoken reply.
- For Part 1: ask short personal/familiar topic questions (10-15 sec answers expected).
- For Part 2: deliver a cue card with 4 bullet points and give the candidate 1 minute to prepare and 2 minutes to speak.
- For Part 3: ask abstract/discursive questions tied to the Part 2 topic.
- After every 2-3 turns, you may briefly (1 sentence) acknowledge ("Lovely, let's move on...") — never break character with lengthy feedback.
- Keep your utterances under 60 words and use natural spoken English.
- Do NOT correct the candidate during the test; full feedback happens at the end.

Begin the test now."""


async def generate_speaking_opener(
    part: int,
    topic: str,
    target_band: float,
    personality: str,
    native_language: str,
    session_id: str,
) -> Dict[str, str]:
    system = SPEAKING_SYSTEM_TMPL.format(
        part=part, target_band=target_band,
        personality=personality, native_language=native_language,
    )
    chat = _build_chat(session_id, system)

    if part == 1:
        prompt = f"Begin Part 1 by greeting the candidate warmly and asking the first question about: {topic}. Output only your spoken examiner line."
    elif part == 2:
        prompt = (
            f"Deliver the Part 2 cue card for topic '{topic}'. "
            "Output JSON with keys: 'cue_card' (the full cue card including 'Describe...' + 4 bullet 'You should say:' lines + closing line), "
            "'spoken' (what you would say out loud to introduce it). Return ONLY JSON."
        )
    else:
        prompt = f"Begin Part 3 with a discursive opening question linked to '{topic}'. Output only your spoken line."

    resp = await chat.send_message(UserMessage(text=prompt))
    text = resp if isinstance(resp, str) else str(resp)

    if part == 2:
        parsed = _parse_json(text)
        if parsed:
            return {"spoken": parsed.get("spoken", ""), "cue_card": parsed.get("cue_card", "")}
        return {"spoken": text, "cue_card": text}
    return {"spoken": text.strip(), "cue_card": ""}


async def speaking_turn(
    session_id: str, part: int, topic: str, target_band: float,
    personality: str, native_language: str,
    history: List[Dict[str, str]], user_text: str,
) -> str:
    system = SPEAKING_SYSTEM_TMPL.format(
        part=part, target_band=target_band,
        personality=personality, native_language=native_language,
    )
    chat = _build_chat(session_id, system)
    context = "Here is the conversation so far:\n"
    for m in history[-8:]:
        role = "Candidate" if m["role"] == "user" else "Examiner"
        context += f"{role}: {m['content']}\n"
    context += f"Candidate (latest): {user_text}\n\nRespond now as the examiner with your next question or follow-up only. No meta-commentary."

    resp = await chat.send_message(UserMessage(text=context))
    return (resp if isinstance(resp, str) else str(resp)).strip()


SCORING_SPEAKING_SYSTEM = """You are an official IELTS Speaking examiner. Score the candidate transcript strictly using the IELTS public band descriptors:
- Fluency & Coherence
- Lexical Resource
- Grammatical Range & Accuracy
- Pronunciation (infer from word choice, repetition, hesitations in transcript)

Return ONLY valid JSON of the form:
{
  "overall_band": 6.5,
  "criteria": {"fluency": 6.5, "lexical": 6.0, "grammar": 7.0, "pronunciation": 6.5},
  "strengths": ["..."],
  "improvements": ["..."],
  "tip_of_the_day": "...",
  "model_answer": "A polished band-8 sample answer to the same prompt."
}
Bands must be in 0.5 increments between 4.0 and 9.0."""


async def score_speaking(transcript: List[Dict[str, str]], topic: str, part: int) -> dict:
    chat = _build_chat(f"score-speak-{topic[:10]}", SCORING_SPEAKING_SYSTEM)
    text = "TOPIC: " + topic + f"\nPART: {part}\nTRANSCRIPT:\n"
    for m in transcript:
        role = "Candidate" if m["role"] == "user" else "Examiner"
        text += f"{role}: {m['content']}\n"
    resp = await chat.send_message(UserMessage(text=text + "\nReturn JSON only."))
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    if not parsed:
        return {
            "overall_band": 6.0,
            "criteria": {"fluency": 6.0, "lexical": 6.0, "grammar": 6.0, "pronunciation": 6.0},
            "strengths": ["Attempted the question."],
            "improvements": ["Provide more detailed responses."],
            "tip_of_the_day": "Use linking words to extend your answers.",
            "model_answer": "",
        }
    return parsed


# ===================== WRITING =====================

WRITING_SYSTEM = """You are an official IELTS Writing examiner. Score the response strictly per IELTS public band descriptors:
- Task Achievement / Task Response
- Coherence & Cohesion
- Lexical Resource
- Grammatical Range & Accuracy

Return ONLY valid JSON:
{
  "overall_band": 6.5,
  "criteria": {"task_achievement": 6.5, "coherence_cohesion": 6.0, "lexical_resource": 7.0, "grammar_accuracy": 6.5},
  "word_count": 250,
  "strengths": ["..."],
  "improvements": ["..."],
  "annotated_feedback": [{"excerpt": "...", "issue": "grammar | lexis | coherence | task", "comment": "..."}],
  "model_answer": "A polished band-8 sample response for the same prompt (about 250-300 words)."
}
Bands in 0.5 increments. Be honest, not generous."""


async def score_writing(task: int, prompt: str, response_text: str) -> dict:
    chat = _build_chat(f"score-write-{task}", WRITING_SYSTEM)
    msg = f"TASK: {task}\nPROMPT:\n{prompt}\n\nCANDIDATE RESPONSE:\n{response_text}\n\nReturn JSON only."
    resp = await chat.send_message(UserMessage(text=msg))
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    if not parsed:
        return {
            "overall_band": 6.0,
            "criteria": {"task_achievement": 6.0, "coherence_cohesion": 6.0, "lexical_resource": 6.0, "grammar_accuracy": 6.0},
            "word_count": len(response_text.split()),
            "strengths": [],
            "improvements": ["Could not analyze in detail. Please try again."],
            "annotated_feedback": [],
            "model_answer": "",
        }
    return parsed


# ===================== WRITING PROMPT GENERATION =====================

WRITING_PROMPT_SYSTEM = """You generate fresh IELTS Writing prompts. Each prompt must be original, exam-realistic, and end with the standard rubric instruction ("Write at least 150/250 words").
Return ONLY valid JSON: {"id": "<short-id>", "title": "<5-8 word title>", "prompt": "<full prompt text including any data description for Task 1>"}"""


async def generate_writing_prompt(task: int, hint: str = "") -> dict:
    chat = _build_chat(f"gen-write-{task}", WRITING_PROMPT_SYSTEM)
    if task == 1:
        user = f"Generate a Task 1 Academic IELTS Writing prompt (chart/graph/diagram/letter). Topic hint: {hint or 'random'}. Include a brief textual description of the visual since this is text-only practice. End with 'Write at least 150 words.' Return JSON only."
    else:
        user = f"Generate a Task 2 IELTS Writing prompt (essay). Topic hint: {hint or 'random'}. Vary the question type (opinion / discussion / problem-solution / advantages-disadvantages). End with 'Write at least 250 words.' Return JSON only."
    resp = await chat.send_message(UserMessage(text=user))
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    return parsed or {}


# ===================== LISTENING / READING GENERATION =====================

LISTENING_SYSTEM = """You generate authentic IELTS Listening practice tests in a compact, fast format.
A test has 4 sections. Each section has 5 questions (mix MCQ + short fill-in, max 3 words for fill-in).
- Section 1: a short transactional conversation between two speakers.
- Section 2: a short monologue in a social context.
- Section 3: a short discussion among 2 speakers in an educational context.
- Section 4: a short academic monologue (lecture excerpt).

Scripts should be 180-260 words each.

IMPORTANT: Every question MUST include an "explanation" field that teaches the candidate WHY the correct answer is right.

Return ONLY valid JSON of the exact shape:
{
  "title": "Practice Test - ...",
  "difficulty": "intermediate",
  "sections": [
    {
      "section": 1, "title": "...",
      "script": "Speaker A: ... Speaker B: ... (180-260 words)",
      "questions": [
        {"q_number": 1, "question": "...", "options": ["A. ...", "B. ...", "C. ..."], "answer": "B", "explanation": "..."},
        {"q_number": 2, "question": "...", "options": null, "answer": "42", "explanation": "..."}
      ]
    }
  ]
}
Sections 1-4 must contain q_numbers 1-5, 6-10, 11-15, 16-20 respectively. Total 20 questions."""


async def generate_listening_test(topic_hint: str = "general") -> dict:
    chat = _build_chat(f"gen-listen-{topic_hint[:10]}", LISTENING_SYSTEM)
    resp = await chat.send_message(
        UserMessage(text=f"Generate a complete IELTS Listening practice test. Theme hint: {topic_hint}. Return JSON only.")
    )
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    return parsed or {}


READING_SYSTEM = """You generate IELTS Academic Reading passages with questions and teaching explanations.

Return ONLY valid JSON:
{
  "title": "...",
  "difficulty": "intermediate",
  "passage": "A 600-900 word academic passage on the given topic. Use paragraphs separated by blank lines.",
  "questions": [
    {"q_number": 1, "question": "True/False/Not Given: ...", "options": ["True", "False", "Not Given"], "answer": "True", "explanation": "..."},
    {"q_number": 2, "question": "Fill in: ...", "options": null, "answer": "word", "explanation": "..."}
  ]
}
Generate exactly 10 questions. Every question MUST include an explanation."""


async def generate_reading_passage(topic_hint: str = "science and society") -> dict:
    chat = _build_chat(f"gen-read-{topic_hint[:10]}", READING_SYSTEM)
    resp = await chat.send_message(UserMessage(text=f"Topic: {topic_hint}. Return JSON only."))
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    return parsed or {}
