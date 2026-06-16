# Ascent IELTS — Product Requirements Document

## Original problem statement
"buatkan aplikasi untuk belajar IELTS, terutama speaking, yg bisa komunikasi dengan AI sebagai tutor, semacam aplikasi Fluently. bikinkan yg bisa diset or modif config2nya, entah itu set target IELTS nya,dll. buat yg komperehensif seperti aplikasi pembelajaran yang advanced, AI sebagai mentornya. dan bisa upload word untuk IELTS writingnya. trus bisa listening jg. pokoknya latihan IELTS yang bener2 valid. referensi soal2nya bisa ambil dari https://ieltsonlinetests.com/ielts-exam-library. kerjakan yg rapi dan komperehensif tanpa ada error. audit dan double testing dulu"

## Stack
- Frontend: React 19 + Tailwind + shadcn/ui + framer-motion + recharts (axios, sonner)
- Backend: FastAPI + Motor (MongoDB), Pydantic v2, bcrypt + python-jose JWT
- LLM: Claude Sonnet 4.5 via `emergentintegrations` (EMERGENT_LLM_KEY)
- Audio: OpenAI Whisper (STT) + OpenAI TTS via `emergentintegrations`
- File parsing: python-docx, pypdf

## Personas
- Indonesian / international ESL learners 17–35 prepping for IELTS Academic or General Training, target bands 5.5–8.5

## Core requirements (locked)
- AI tutor "Ms. Aria" — multi-turn IELTS speaking simulation, voiced via TTS
- Configurable settings: target band, current band, test date, daily minutes, tutor voice (9 OpenAI voices), tutor personality (encouraging/strict/conversational), native language, weak areas
- Writing Task 1 & 2: paste text OR upload .docx/.pdf/.txt → Claude scoring with full IELTS criteria, annotated feedback, model band-8 answer
- Listening: AI-generated tests (4 sections × 5 questions), AI-narrated audio (TTS), MCQ + short-answer, auto-graded with band conversion
- Reading: AI-generated academic passages with T/F/NG + MCQ + short-answer, timed and auto-graded
- Speaking Part 1/2/3 simulation: cue cards, mic recording, Whisper STT, Claude reply, TTS voice, end-of-session band scoring (Fluency / Lexical / Grammar / Pronunciation)
- JWT auth (email/password, bcrypt)
- Dashboard with radar + line charts of progression, stat cards

## Implementation status (2026-06-16)
- [x] FastAPI backend with /api/* routes (auth, profile, speaking, writing, listening, reading, tts, stt, dashboard)
- [x] MongoDB collections: users, profiles, speaking_sessions, writing_submissions, listening_tests, listening_attempts, reading_passages
- [x] JWT auth + bcrypt password hashing
- [x] Claude Sonnet 4.5 tutoring + scoring (speaking, writing) + generation (listening, reading)
- [x] Whisper STT + OpenAI TTS endpoints (both via EMERGENT_LLM_KEY)
- [x] Frontend: Landing, Login, Signup, Onboarding (3-step), Dashboard, Speaking (voice room with orb), Writing (paste + upload), Listening (4×5 questions), Reading, Profile/Settings
- [x] Charts: Recharts radar + line; circular SVG band dial
- [x] Backend pytest E2E suite: 28/28 passing (iteration_2)
- [x] Frontend Playwright E2E: 9/9 flows passing (iteration_3)

## Known trade-offs
- Listening generation is 4×5 = 20 questions (vs official 40) to stay under Cloudflare's ~60s gateway timeout. Documented in UI copy.
- Speaking Part 2 uses Claude-generated cue cards (no copyrighted real IELTS material scraped from ieltsonlinetests.com).

## Prioritised backlog (P0 → P2)
- P1: Async listening generation with polling (so we can return to 40 questions)
- P1: Persistent result card for Reading/Listening (currently toast-only beyond inline review)
- P1: Streak tracking + daily-target reminders
- P1: Speaking session detail view (transcript + audio replays per turn)
- P2: Vocabulary builder + spaced-repetition flashcards
- P2: Mock full test mode (45min reading + 30min listening + 60min writing + speaking)
- P2: Social sharing of band score milestones
- P2: Multi-language UI (Indonesian first)
- P2: Group / classroom mode for tutors

## Operations
- All env vars in `/app/backend/.env` and `/app/frontend/.env` (do not commit)
- Universal key EMERGENT_LLM_KEY auto-tops via Emergent profile → Universal Key → Add Balance
- Test creds in `/app/memory/test_credentials.md`
