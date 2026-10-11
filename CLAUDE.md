@AGENTS.md

# ことのあめ（旧 PolyLinga）

Read [CONCEPT.md](CONCEPT.md) before adding anything. A feature that does not fit the shower
(浴びる → 気づく → 言ってみる → また出会う) does not get built. No quizzes, no forced review, no grammar lessons.

## Stack

- Next.js 16 (App Router, Turbopack, `src/proxy.ts` instead of middleware), React 19, plain CSS modules.
- Supabase: shares the project with the old poly-lang app. Everything new is prefixed `pl_`; never touch the old tables
  or the old `tts-audio` bucket (the old app's cron empties it). Schema: `supabase/migrations/`.
- AI (`src/lib/ai.ts`): OpenAI `gpt-5.2` for corrections (one call per attempt, also returns which library patterns the
  corrected sentence uses) and `text-embedding-3-small` for finding close example sentences.
- Audio: Gemini TTS on Vertex AI (`src/lib/tts.ts`), stored in the public `pl-audio` bucket (`src/lib/audio.ts`).
  Pages link straight to the stored file; `/api/tts` only generates missing clips, and only for approved sentences or the
  learner's own corrections (never for text from the request). The client falls back to the browser's voice.

## Where things are

- `src/lib/auth.ts`, `src/lib/settings.ts`: request-cached user and settings (`requireUser`, `requireSettings`).
- `src/lib/shower.ts` (+ pure helpers in `shower-core.ts`): picks the next cluster (patterns due to return first,
  then new ones; unseen sentences first) and records exposures, seen sentences and memo-word meetings. A pattern is due
  after `RETURN_DAYS` days or `RETURN_RAINS` other clusters, whichever first, so heavy users meet it again the same
  sitting. A cluster counts as bathed in once all of it has fallen (`recordFinished`), not only on 次の雨.
- `src/lib/corpus.ts`: the sentence library (search for 書いてみる hints, examples by pattern). RLS hides drafts.
- `src/lib/reading.ts`: pinyin over Chinese text. Library sentences use their checked `zh_pinyin`; anything else
  (corrections, memo words) falls back to pinyin-pro, which misreads polyphones such as 得・只・长.
- `src/lib/metering.ts`: daily limits through `pl_consume_for` / `pl_refund_for`, callable by the service role only.
- `src/lib/i18n/`: UI copy per learner language. Only `ja` exists; launch is Japanese speakers → ko / en / zh.
- `src/app/app/`: the learner app — `/app` shower, `/app/write` 書いてみる, `/app/s/[id]` a correction, `/app/memo` typed words.
  `src/app/admin/library`: check flagged AI content (allowed for addresses in `ADMIN_EMAILS`).

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm test` (node:test, `tests/*.test.mjs`)
- `npx tsc --noEmit` (run `npx next typegen` first after adding routes)
- `node --env-file=.env.local scripts/migrate.mjs supabase/migrations/<file>.sql`: apply one migration in a transaction.
- `node --env-file=.env.local scripts/seed.mjs [--dry-run]`: load the hand-written library (`scripts/seed-data.json`).
- `node --env-file=.env.local scripts/draft-library.mjs [function ids]`: AI-draft functions from `scripts/library/functions.json`.
- `node --env-file=.env.local scripts/expand-library.mjs [function id] [count]`: more chat-style sentences for existing patterns.
- `node --env-file=.env.local scripts/review-library.mjs [function ids]`: AI second opinion on drafts, shown in the admin page.
- `node --env-file=.env.local scripts/publish-reviewed.mjs`: publish drafts the reviewer passed, and embed them.
- `node --env-file=.env.local scripts/generate-audio.mjs`: pre-generate audio for approved sentences (Vertex quota is per minute; the script waits).
- `node --env-file=.env.local scripts/prepare-pinyin.mjs` → check `scripts/library/work/pinyin/batch-*.json` by hand
  (corrections in `batch-*.out.json`) → `scripts/apply-pinyin.mjs [--dry-run]`: store checked pinyin for new sentences.

## Conventions

- UI copy goes in `src/lib/i18n/ja.ts`, written plainly from the learner's side. Client components get strings as props.
- Colors come from the tokens in `src/app/globals.css`, taken from the app icon (`src/app/icon.png`, `public/icons/`):
  the accent is `var(--accent)` / `var(--tint)` and follows `data-accent` (rain, ink, hydrangea, dusk); `var(--again)` marks a
  pattern or memo word coming back. No gradients inside the app; the icon is the one exception. The wordmark ことのあめ
  is mincho (`.wordmark-kana`, `<Logo>`); everything else is IBM Plex.
- Writes that later get read aloud or counted (corrections, usage) go through the service-role client, never the learner's.
