# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Type-check + Vite build (outputs to dist/)
npm run lint       # ESLint
npm run preview    # Preview the production build locally
npm run deploy     # Build + publish to GitHub Pages (gh-pages -d dist)
```

No test framework is configured.

## Architecture Overview

**TOCFL Study** is a Vietnamese-language Chinese (Traditional) exam prep app for TOCFL (Band A & B). It is a pure frontend SPA (React 19 + TypeScript + Vite), deployed to GitHub Pages at `/TOCFL-Study/`.

### Data flow

All study data is loaded at startup from static JSON files in `public/data/`:
- `vocabulary.json` — `Word[]` (hanzi, pinyin, level, pos, meaning, band)
- `exam_data.json` — `ExamData` (Band A/B, 3 exam keys, parts 1–5)
- `listening_data.json` — `ListeningData` (Band A/B/C, 3 exam keys)

`useData` (`src/hooks/useData.ts`) fetches these using `import.meta.env.BASE_URL` (dev: `/`, prod: `/TOCFL-Study/`).

### State management

No Redux or external state library. State lives in:
1. **`useProgress`** (`src/hooks/useProgress.ts`) — `Progress` object (`known`, `reading`, `exams`) persisted to `localStorage` under key `tocfl_progress_v2`.
2. **`ApiKeyContext`** (`src/contexts/ApiKeyContext.tsx`) — OpenAI API key, stored in `sessionStorage` (default) or `localStorage` (user opt-in "remember key"). Never sent to the backend.
3. **`HighlightsContext`** (`src/contexts/HighlightsContext.tsx`) — Text highlights, offline-first with BE sync on login.

### Backend API

`src/api/client.ts` defines all backend calls against `API_BASE = "https://tocfl-study-api.ngrok.app"` (a FastAPI backend exposed via ngrok). All requests include `"ngrok-skip-browser-warning": "true"`. The client exposes grouped API objects: `authApi`, `progressApi`, `aiContentApi`, `highlightsApi`, `examExplanationsApi`, `interviewApi`.

Progress is dual-written: localStorage is primary, backend is synced fire-and-forget. After login, server state is merged in (server wins on conflict).

### AI features

AI explanation (`src/utils/aiExplanation.ts`) calls **OpenAI** directly from the browser using the user's API key:
- Text questions → `gpt-*` via `streamCompletion` (SSE streaming)
- Image questions → `gpt-*` vision (base64 image encoding)
- Audio (listening) → Whisper API for transcription, then GPT for explanation
- Explanations cached in `localStorage` under `tocfl_ai_explanations`; Whisper transcripts under `tocfl_audio_transcripts`
- After login, explanation cache is bulk-synced with backend (`examExplanationsApi`)

AI content generation (`src/components/AIGenerator/`) uses the same OpenAI key for generating practice sentences and reading passages.

Model preference stored in `localStorage` under `tocfl_ai_model` via `useAIModel` (`src/hooks/useAIModel.ts`).

### Module tabs

`App.tsx` manages a single `tab` state (`TabId`) and conditionally renders:
- `flashcard` → `FlashcardModule` — vocabulary flashcards with known/unknown marking
- `reading` → `ReadingModule` — reading comprehension (exam_data, parts 3–5)
- `exam` → `ExamModule` — timed full-exam simulation
- `listening` → `ListeningModule` — audio-based exam with Whisper AI explanations
- `ai` → `AIGeneratorModule` — AI-generated practice content (sentences / reading)
- `interview` → `InterviewModule` — AI mock interview with CV upload
- `progress` → `ProgressModule` — statistics and history

### Key conventions

- All Chinese must use **Traditional characters** (繁體字), never Simplified. This is enforced in AI system prompts and is a core product requirement.
- Exam history (full question snapshots) stored in `localStorage` via `src/utils/historyStorage.ts` (keys `tocfl_exam_attempts` / `tocfl_listening_attempts`, max 50 per module).
- `HighlightableText` + `WordLookupTooltip` provide app-wide CJK text selection → pinyin/meaning lookup.
- i18n translations in `src/i18n/translations.ts`; language context in `src/i18n/LangContext.tsx`.
- Images for exam questions live in `public/exam-images/`.
- `src/utils/aiExplanation_v1.ts` is a legacy version — use `aiExplanation.ts` for all new work.
