# Ascent IELTS — PRD

## Original problem statement
Personal IELTS app for busy professional learners. Comprehensive AI mentor (Speaking voice + Writing scoring + Listening + Reading) with PIN login, PWA install, dynamic content, post-submit teaching, pain-points tracking, daily drill routine, achievement badges, and weekly recap.

## Stack
- Frontend: React 19 + Tailwind + shadcn/ui + framer-motion + recharts + html2canvas + sonner
- Backend: FastAPI + Motor (Mongo) + Pydantic v2 + bcrypt + python-jose JWT
- LLM: Claude Sonnet 4.5 via emergentintegrations (EMERGENT_LLM_KEY)
- Audio: OpenAI Whisper (STT) + OpenAI TTS (9 voices)
- PWA: manifest.json + service worker (cache + notification click handler) + maskable icons

## Feature timeline
- **Iter 1** — MVP: auth, speaking voice room, writing scoring, listening, reading, profile, dashboard
- **Iter 2** — PIN-only auth (default 123456), PWA + mobile safe-area + bottom tab, dynamic regen, post-submit explanations, pain-points panel, Emergent badge removed
- **Iter 3 (Daily Drill)** — 4-item ~8-min routine (vocab + listen + speak + grammar) calibrated to weak area, streak + XP
- **Iter 4 (Reminder + Badges)** — local PWA notifications at configurable time, 11 achievement badges (streak 3/7/30/100 + XP 100/500/1k/5k + writer/speaker/listener counters)
- **Iter 5 (Recap Mode)** — Weekly recap: AI 3-paragraph essay + common errors (with fix) + top 5 vocab + next-week focus + lock-screen wallpaper PNG export + Print/PDF

## Test status (iteration 7)
- Backend: **100% (28/28 + 19 + 13 + 13 + 5)** across all iterations
- Frontend: **100%** flows on desktop + mobile (414×896)
- Bugs found-and-fixed in test cycles: 2 (ObjectId leak iter1, explanation leak iter4); 0 outstanding

## Known constraints
- Listening tests: 20 questions (4×5) instead of official 40 — Cloudflare 60s gateway
- Single-user app (one owner)
- Local notifications only (no push server) — works while PWA installed/active

## Backlog (Pn)
- P1: Streak freeze token (1/week skip)
- P1: Speaking session detail view (per-turn transcript + audio replay)
- P1: Async listening generation w/ polling → restore 40 questions
- P2: Vocabulary SRS based on top_vocab from recap
- P2: Mock full-test mode (R+L+W+S timed)
- P2: Rate-limit PIN endpoint
- P2: Split server.py (~950 lines now) into routers
- P2: Dynamic import html2canvas for code-split

## Ops
- Default PIN: `123456` (change at Settings → Change PIN)
- Default reminder time: `07:00` (configurable)
- Recap cache key: ISO week (YYYY-Www); regenerate via POST `/api/recap/regenerate`
- EMERGENT_LLM_KEY top-up: Profile → Universal Key → Add Balance
