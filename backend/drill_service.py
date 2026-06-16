"""Daily Drill content generator (calibrated 7-10 min routine for busy learners)."""
import os
from datetime import datetime, timezone
from typing import Dict, List

from llm_compat import LlmChat, UserMessage  # local shim
from llm_service import _build_chat, _parse_json  # reuse

DRILL_SYSTEM = """You design ULTRA-EFFICIENT IELTS daily drills for busy professionals (target ~7-10 minutes total).
Output ONE JSON with EXACTLY 4 items in this order, calibrated to the user's weakest area:

{
  "title": "Day N — Focus: <weak area>",
  "focus_area": "<single weak label, e.g. 'Lexical' or 'Listening'>",
  "estimated_minutes": 8,
  "items": [
    {
      "type": "vocab",
      "title": "5 IELTS words — <theme>",
      "minutes": 2,
      "data": {
        "theme": "education / environment / etc",
        "cards": [
          {"word": "ubiquitous", "ipa": "/juːˈbɪkwɪtəs/", "pos": "adj", "definition": "present, appearing, or found everywhere", "example": "Smartphones have become ubiquitous in modern life.", "synonyms": ["omnipresent", "pervasive"], "ielts_tip": "Use in Speaking Part 3 for trends and society topics."}
        ]
      }
    },
    {
      "type": "listen",
      "title": "60-second listen — <context>",
      "minutes": 3,
      "data": {
        "script": "A 90-130 word monologue or short dialogue. Plain text, complete sentences.",
        "questions": [
          {"q_number": 1, "question": "What does the speaker recommend?", "options": ["A. ...", "B. ...", "C. ..."], "answer": "B", "explanation": "..."},
          {"q_number": 2, "question": "Fill in: The meeting is at ___ pm.", "options": null, "answer": "3:30", "explanation": "..."},
          {"q_number": 3, "question": "True/False/NG: ...", "options": ["True", "False", "Not Given"], "answer": "False", "explanation": "..."}
        ]
      }
    },
    {
      "type": "speak",
      "title": "60-second response",
      "minutes": 2,
      "data": {
        "prompt": "A Part 1 IELTS speaking question. Single sentence.",
        "ielts_part": 1,
        "expected_seconds": 60,
        "model_answer": "A polished band-8 example response (50-80 words).",
        "tips": ["Use a clear opening (Well, …)", "Include one specific example", "End with a brief reason or feeling"]
      }
    },
    {
      "type": "grammar",
      "title": "Fix 3 mistakes",
      "minutes": 2,
      "data": {
        "focus": "e.g. articles, tense consistency, prepositions",
        "sentences": [
          {"wrong": "He has went to London last year.", "fixed": "He went to London last year.", "explanation": "..."},
          {"wrong": "...", "fixed": "...", "explanation": "..."},
          {"wrong": "...", "fixed": "...", "explanation": "..."}
        ]
      }
    }
  ]
}

Make content fresh and exam-realistic. Vary themes daily. Calibrate difficulty to the target band."""


async def generate_daily_drill(weak_area: str, target_band: float, native_language: str, day_index: int) -> dict:
    chat = _build_chat(f"drill-{day_index}", DRILL_SYSTEM)
    user_msg = (
        f"Generate today's drill (Day {day_index}). "
        f"User's weakest area: {weak_area}. Target band: {target_band}. Native language: {native_language}. "
        f"Pick fresh themes (don't repeat 'technology' if Day {day_index-1} used it). Return JSON only."
    )
    resp = await chat.send_message(UserMessage(text=user_msg))
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    return parsed or {}
