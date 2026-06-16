"""Audio service: OpenAI Whisper (STT) + ElevenLabs (TTS).

Replaces the previous emergentintegrations-based implementation. Uses OpenAI and
ElevenLabs official SDKs directly so the backend runs cleanly on Render/Railway/etc.
"""
import base64
import io
import os
from typing import Optional

from openai import AsyncOpenAI
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# Map friendly voice name → ElevenLabs voice_id (from the public Voice Library).
# Feel free to swap IDs after adding voices in your ElevenLabs VoiceLab.
VOICE_MAP = {
    "Bella":     "EXAVITQu4vr4xnSDxMaL",  # soft, sweet, young
    "Rachel":    "21m00Tcm4TlvDq8ikWAM",  # warm, mature, patient
    "Domi":      "AZnzlk1XvdvUeBnXmlld",  # playful, expressive
    "Freya":     "jsCqWAovK2LkecY7zXl4",  # soft, intimate
    "Lily":      "pFZP5JQG7iQjIQuC4Bku",  # friendly, warm
    "Charlotte": "XB0fDUnXU5powFXDhCwa",  # calm, soothing
    "Alice":     "Xb7hH8MSUJpSbSDYk0k2",  # bright, cheerful
    "Sarah":     "EXAVITQu4vr4xnSDxMaL",  # alias → Bella as fallback
}

DEFAULT_VOICE = "Bella"

_openai_client: Optional[AsyncOpenAI] = None
_el_client: Optional[ElevenLabs] = None


def _openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not set")
        _openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def _el() -> ElevenLabs:
    global _el_client
    if _el_client is None:
        if not ELEVENLABS_API_KEY:
            raise RuntimeError("ELEVENLABS_API_KEY not set")
        _el_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    return _el_client


# ===================== STT =====================
async def transcribe_audio(
    file_bytes: bytes, filename: str = "audio.webm", language: str = "en"
) -> str:
    """Transcribe audio bytes using OpenAI Whisper. Returns plain transcript text."""
    bio = io.BytesIO(file_bytes)
    bio.name = filename  # OpenAI SDK requires a filename on the file-like
    response = await _openai().audio.transcriptions.create(
        file=bio,
        model="whisper-1",
        response_format="json",
        language=language,
        temperature=0.0,
    )
    return getattr(response, "text", str(response))


# ===================== TTS =====================
async def synthesize_speech(
    text: str,
    voice: str = DEFAULT_VOICE,
    stability: float = 0.35,
    style: float = 0.65,
    similarity_boost: float = 0.75,
    model: str = "eleven_multilingual_v2",
) -> bytes:
    """Generate mp3 bytes via ElevenLabs.

    stability: 0-1, lower = more expressive/variable, higher = monotone-stable
    style:     0-1, higher = more breathy/dramatic (v2 model only)
    """
    voice_id = VOICE_MAP.get(voice, VOICE_MAP[DEFAULT_VOICE])
    safe_text = text[:4000]

    # ElevenLabs Python SDK returns an iterator of bytes chunks.
    audio_iter = _el().text_to_speech.convert(
        voice_id=voice_id,
        text=safe_text,
        model_id=model,
        output_format="mp3_44100_128",
        voice_settings=VoiceSettings(
            stability=max(0.0, min(1.0, float(stability))),
            similarity_boost=max(0.0, min(1.0, float(similarity_boost))),
            style=max(0.0, min(1.0, float(style))),
            use_speaker_boost=True,
        ),
    )
    return b"".join(audio_iter)


async def synthesize_speech_base64(
    text: str, voice: str = DEFAULT_VOICE, **kwargs
) -> str:
    audio_bytes = await synthesize_speech(text, voice=voice, **kwargs)
    return base64.b64encode(audio_bytes).decode("utf-8")
