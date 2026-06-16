"""Weekly Recap generator — aggregates last 7 days into a teaching essay + top vocab + common errors."""
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from llm_compat import UserMessage  # local shim
from llm_service import _build_chat, _parse_json


RECAP_SYSTEM = """You are an IELTS coach writing a SUNDAY EVENING RECAP for a busy professional learner.
Given the user's past-7-day activity (speaking criteria, writing criteria, listening errors, grammar drills, vocab seen),
produce a focused, motivating recap that helps them retain pattern in their brain without adding study time.

Return ONLY JSON:
{
  "title": "Week of <e.g. Jun 10–16> — Pattern Lock",
  "headline": "Single sentence summarising the week's biggest lesson.",
  "essay": "Exactly 3 paragraphs (separated by blank lines). Paragraph 1 = wins and progress. Paragraph 2 = recurring mistakes (be specific). Paragraph 3 = the ONE thing to fix next week + a concrete drill prescription.",
  "common_errors": [
    {"pattern": "tense agreement (past + present mixed)", "example": "I have went to the office yesterday", "fix": "Past time marker -> simple past, never present perfect."}
  ],
  "top_vocab": [
    {"word": "ubiquitous", "definition": "present everywhere", "best_used_in": "Speaking Part 3 on technology", "example": "Smartphones have become ubiquitous."}
  ],
  "next_week_focus": "<one of: Fluency | Lexical | Grammar | Pronunciation | Task Achievement | Coherence | Listening | Reading>",
  "wallpaper_quote": "A short (≤80 chars) punchy line the user can set as their lock-screen quote for the coming week."
}

The essay must be 220–320 words total across the 3 paragraphs. Tone: warm, direct, like a senior tutor who knows the learner."""


async def generate_weekly_recap(
    week_label: str,
    metrics: Dict,
    speak_criteria: Dict[str, List[float]],
    write_criteria: Dict[str, List[float]],
    listening_errors: List[Dict],
    grammar_drills: List[Dict],
    vocab_drills: List[Dict],
    target_band: float,
    native_language: str,
) -> dict:
    # Sanitize session_id (week_label may contain spaces or em-dash)
    safe_id = week_label.replace(" ", "-").replace("–", "-")[:40]
    chat = _build_chat(f"recap-{safe_id}", RECAP_SYSTEM)
    msg = (
        f"User target band: {target_band}. Native language: {native_language}.\n"
        f"Week: {week_label}\n"
        f"7-day metrics: {metrics}\n"
        f"Speaking criteria scores (recent sessions): {speak_criteria}\n"
        f"Writing criteria scores (recent submissions): {write_criteria}\n"
        f"Listening incorrect-answer review (most recent): {listening_errors[:8]}\n"
        f"Grammar fix-the-mistake drills completed: {grammar_drills[:6]}\n"
        f"Vocab seen in drills: {vocab_drills[:10]}\n\n"
        "Generate the recap JSON now."
    )
    resp = await chat.send_message(UserMessage(text=msg))
    parsed = _parse_json(resp if isinstance(resp, str) else str(resp))
    return parsed or {}
