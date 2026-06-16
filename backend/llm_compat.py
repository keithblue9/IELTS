"""Compatibility shim — drop-in replacement for emergentintegrations.llm.chat.LlmChat.

Mimics the same interface (LlmChat, UserMessage, with_model, send_message) but uses
the Anthropic SDK directly. This lets us deploy outside Emergent's private package.
"""
import os
from dataclasses import dataclass
from typing import Optional

from anthropic import AsyncAnthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


@dataclass
class UserMessage:
    text: str


class LlmChat:
    """Stateless wrapper. Each .send_message() makes one fresh Anthropic call.

    Note: the original LlmChat kept conversation state by session_id. Our existing
    code already passes full context manually in each prompt (see speaking_turn),
    so stateless is fine and actually safer (no hidden cross-request state).
    """

    def __init__(self, api_key: str = "", session_id: str = "", system_message: str = ""):
        # We ignore api_key (passed for compat) and use ANTHROPIC_API_KEY env.
        self._client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY or api_key)
        self._session_id = session_id
        self._system = system_message
        self._provider = "anthropic"
        self._model = "claude-sonnet-4-5-20250929"
        self._max_tokens = 4096

    def with_model(self, provider: str, model: str) -> "LlmChat":
        self._provider = provider
        self._model = model
        return self

    def with_max_tokens(self, n: int) -> "LlmChat":
        self._max_tokens = n
        return self

    async def send_message(self, message: UserMessage) -> str:
        """Send a single user message; return the assistant's text reply."""
        # Only anthropic provider supported here. (Original supported others via emergent.)
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=self._system or "You are a helpful assistant.",
            messages=[{"role": "user", "content": message.text}],
        )
        # Concatenate text blocks
        parts = []
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                parts.append(block.text)
            elif hasattr(block, "text"):
                parts.append(block.text)
        return "".join(parts).strip()
