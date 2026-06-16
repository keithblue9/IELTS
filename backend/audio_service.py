"""Audio service: OpenAI Whisper (STT) and OpenAI TTS via emergentintegrations."""
import base64
import io
import os
from typing import Optional

from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


async def transcribe_audio(file_bytes: bytes, filename: str = "audio.webm", language: str = "en") -> str:
    """Transcribe audio bytes using Whisper. Returns plain transcript text."""
    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    bio = io.BytesIO(file_bytes)
    bio.name = filename  # OpenAI SDK requires a filename on the file-like
    response = await stt.transcribe(
        file=bio,
        model="whisper-1",
        response_format="json",
        language=language,
        temperature=0.0,
    )
    return getattr(response, "text", str(response))


async def synthesize_speech(text: str, voice: str = "nova", model: str = "tts-1") -> bytes:
    """Generate mp3 audio bytes from text."""
    tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
    # cap to safe length
    safe_text = text[:4000]
    return await tts.generate_speech(text=safe_text, model=model, voice=voice)


async def synthesize_speech_base64(text: str, voice: str = "nova") -> str:
    audio_bytes = await synthesize_speech(text, voice=voice)
    return base64.b64encode(audio_bytes).decode("utf-8")
