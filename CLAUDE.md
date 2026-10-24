@AGENTS.md

# ことのあめ（旧 PolyLinga）

Read [CONCEPT.md](CONCEPT.md) before adding anything. A feature that does not fit the shower
(浴びる → 気づく → 言ってみる → また出会う) does not get built. No quizzes, no forced review, no grammar lessons.

## Stack

- Next.js 16 (App Router, Turbopack, `src/proxy.ts` instead of middleware), React 19, plain CSS modules.
- Supabase: shares the project with the old poly-lang app. Everything new is prefixed `pl_`; never touch the old tables
  or the old `tts-audio` bucket (the old app's cron empties it). Schema: `supabase/migrations/`.
- AI (`src/lib/ai.ts`): OpenAI `gpt-5.2` for corrections (one call per attempt, also returns which library patterns the
  corrected sentence uses) and `text-embedding-3-small` for finding close example sentences. The one other runtime call
  is 詳しく解説 on a learner's own correction (`explainSentence`, action `explainCorrection`): each word with its plain
  meaning and its part of the translation, made only when they press the button and kept in
  `pl_corrections.result.breakdown`, so at most once per correction. Library sentences get no AI explanation.
- Audio: Gemini TTS on Vertex AI (`src/lib/tts.ts`), stored in the public `pl-audio` bucket (`src/lib/audio.ts`).
  Pages link straight to the stored file; `/api/tts` only generates missing clips, and only for approved sentences or the
  learner's own corrections (never for text from the request). The client falls back to the browser's voice.
  - Gemini's pace varies between generations, so each clip is asked for at a learner's pace and measured (speech units
    per second, `PACE_RANGE`); a rushed one is made again.
  - A correction's clip is made right after the correction (`after()` in actions.ts), so its speaker never waits.
  - `src/components/audio.ts` fetches a rain's clips while its first screen is up, and the next rain's while this one
    plays (they then play at once, even in a tunnel). One play per element: a newer one cancels an older one still loading.
  - Pro TTS allows about 10 clips a minute per project, and the app needs that for its own generation. Bulk generation
    (`scripts/generate-audio.mjs`) therefore runs on Flash (same voice, its own quota).

## Where things are

- `src/lib/auth.ts`, `src/lib/settings.ts`: request-cached user and settings (`requireUser`, `requireSettings`). The
  session token is checked with `getClaims()` here and in `src/proxy.ts`: the project signs with ES256, so it is verified
  locally against the cached signing keys instead of a round trip to Supabase Auth on every page.
- Sign-in (`src/app/login/`): the Supabase project's mails, templates, Site URL and redirect list are the old app's, so
  ことのあめ does its own. Sign-up and a forgotten password make the link on the server (`generateLink`, the account
  unconfirmed until then) and send our mail through Resend (`src/lib/email.ts`), straight to `/auth/confirm`; counted as
  `emails` (5 per address, 80 a day). Google is our own OAuth client via Google Identity Services and
  `signInWithIdToken` (`GoogleButton`), falling back to the shared redirect sign-in until `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.
  Supabase takes its tokens only once that ID is in the project's Google provider (Client IDs, comma-separated), after the
  old app's: the redirect sign-in uses the first one. Otherwise every Google sign-in fails ("Unacceptable audience").
  `/login?next=` goes on to `next` (same-site only) after logging in, Google, or a new account's mail.
- ユーザー名 (`src/lib/username.ts`): the account's name, in the user's metadata as `username` like the old app's, so the
  session token carries it and the sister apps can read it. Not unique, not a login, never shown to other learners. An
  account without one is sent to `/name` by the proxy before any page (`/name?next=` goes on after, so つなぐ and `/start`
  still follow); `saveUsername` renews the session so the token has it at once. Changed in settings.
- つなぐ for the sister apps (`/connect`, `src/lib/sisters.ts`): ことのは, ことのおと, ことのめ and ことのえだ send their learner
  to `/connect?app=&back=&state=`; signed out, they log in or sign up first and come back (`/login?next=`); signed in,
  one press makes a magic-link token (`generateLink`, never mailed) and sends it back to the sister's `/login` in the
  URL fragment with the sister's state. Only to the sisters listed there, at their public addresses or localhost (a
  token sent there signs the learner in). ことのね keeps its record on the device and has no account yet.
- `src/lib/shower.ts` (+ pure helpers in `shower-core.ts`): picks the next cluster (patterns due to return first,
  then new ones; unseen sentences first) and records exposures, seen sentences and memo-word meetings. A pattern is due
  after `RETURN_DAYS` days or `RETURN_RAINS` other clusters, whichever first, so heavy users meet it again the same
  sitting. A cluster counts as bathed in once all of it has fallen (`recordFinished`), not only on 次の雨.
- Habit, without streaks (habits form from a cue repeated, and a missed day barely slows that): after the first rain the
  learner is asked once when they will bathe (`pl_settings.rain_cue`, e.g. 電車に乗ったら; `CuePrompt`, settings), and the
  rain shows 「〜、ひと雨。」. The first rain of a day ends with "enough for today", and coming back after 3+ days away is
  greeted (`rainSoFar` in me.ts). For train rides: sound and translation settings are kept on the device, the next rain
  is fetched while the current one is on screen, and half-written sentences are kept as drafts (`src/components/local.ts`).
- 単語の雨 (`/app?rain=words`, `_shower/WordRain.tsx`): the third rain on 浴びる, also linked from メモ. The learner's memo
  words fall one at a time with what they wrote beside them, in a new order each round, until they stop it; read aloud by
  the browser's voice if they want, speed kept on the device, the screen kept awake while it runs. Nothing is asked or
  counted, and it does not count as meeting a word (that stays the sentence rain's job).
- `src/app/tutorial/` + `src/lib/tutorial.ts`: the hands-on tutorial (`/tutorial`, outside the app shell). A new learner
  lands there after `/start`; until `pl_settings.tutorial_seen_at` is set (finished or skipped) 浴びる offers it, and
  settings can open it again. Five steps, each started by the learner's tap and drawn with the app's own screens: the
  rain falls, they press what looks shared and it lights, a sample attempt is corrected and explained word by word (a
  hand-written sample per language, no AI call), three days pass and the way of saying returns with a memo word, and
  they choose when to bathe (saved as the real `rain_cue`). Library sentences of 誘う in the language learned (`PICKS`).
- `src/lib/minna.ts`: みんなの雨 (`/app?rain=minna`). Learners who switch sharing on (`pl_settings.share_rain`) send
  corrected sentences the correction judged `shareable` into `pl_shared`, one row per pattern used, lit at the pattern's
  usual library part. Clusters by pattern from other learners (4 or more), never showing who wrote them: these tables have
  no learner policies and are read with the service role only. 「これ言いたかった」 (`pl_shared_hearts`) is never counted on
  screen; the author hears once that a sentence reached someone. A report hides the sentence at once (`pl_shared_reports`).
- `src/lib/me.ts`: 自分, a place to look back (`/app/me`, settings on their own page `/app/me/settings`). The learner's
  own counts (never compared with anyone), then 日ごと (days with something in them, from `pl_rain_days`, which
  `pl_log_rain` fills as each rain finishes; days are in Japan time like the limits), かたち (patterns met, whether
  they used them; `/app/me/f/[id]` shows the lit part, their sentences with it and the ones they bathed in, and lets them
  try it again) and 自分の文 (corrections, sentences hearted in みんなの雨, their own shared ones; withdraw hides every
  row of that correction). A correction is shown everywhere here as what they wrote above what it became, the changes
  marked as on its own page (`SaidPair` in views.tsx).
  学習の記録 (`/app/me/export`, `loadExport` + `src/lib/export.ts`): all of it as one Markdown text to copy or save, opening
  with a request the learner can paste into an AI of their choice. The app itself makes no AI call for it. Rain before `pl_rain_days` existed shows only on each pattern's last day.
- `src/lib/corpus.ts`: the sentence library (search for 書いてみる hints, examples by pattern). RLS hides drafts.
  書いてみる hints (`searchCorpus` → `pl_hint_sentences`) are one sentence per function (かたち), ranked by the
  sentence's closeness in meaning plus the function's average meaning, so they share a way of saying with the intent
  rather than only its topic words; weak or far-behind ones are left out, and the page names each hint's かたち.
- `src/lib/reading.ts`: pinyin over Chinese text. Library sentences use their checked `zh_pinyin`; anything else
  (corrections, memo words) falls back to pinyin-pro, which misreads polyphones such as 得・只・长.
- `src/lib/metering.ts`: daily limits through `pl_consume_for` / `pl_refund_for`, callable by the service role only.
- `src/lib/i18n/`: UI copy per learner language. Only `ja` exists; launch is Japanese speakers → ko / en / zh.
- `src/app/app/`: the learner app — `/app` shower, `/app/write` 書いてみる (history can be deleted: a saying takes its
  corrections and their みんなの雨 rows with it), `/app/s/[id]` a correction, `/app/memo` typed words (`/app/memo/look`
  例文から探す: library sentences containing a word typed in either language, `lookUp` in corpus.ts; no definitions),
  `/app/me` 自分.
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
- `node --env-file=.env.local scripts/generate-audio.mjs [--langs=zh,ko,en] [--redo-fast] [--dry-run]`: pre-generate audio for
  approved sentences on Flash (`--redo-fast` also remakes rushed clips; Vertex quota is per minute, the script waits).
- `node --env-file=.env.local scripts/prepare-pinyin.mjs` → check `scripts/library/work/pinyin/batch-*.json` by hand
  (corrections in `batch-*.out.json`) → `scripts/apply-pinyin.mjs [--dry-run]`: store checked pinyin for new sentences.

## Conventions

- UI copy goes in `src/lib/i18n/ja.ts`, written plainly from the learner's side. Client components get strings as props.
- Colors come from the tokens in `src/app/globals.css`, taken from the app icon (`src/app/icon.png`, `public/icons/`):
  the accent is `var(--accent)` / `var(--tint)` and follows `data-accent` (rain, ink, hydrangea, dusk); `var(--again)` marks a
  pattern or memo word coming back. No gradients inside the app; the icon is the one exception. The wordmark ことのあめ
  is mincho (`.wordmark-kana`, `<Logo>`); everything else is IBM Plex.
- Writes that later get read aloud or counted (corrections, usage) go through the service-role client, never the learner's.
- Every tab is rendered on the server per visit. `src/app/app/loading.tsx` makes the bottom bar switch at once (in
  production its links prefetch it): it shows the destination's own header, so keep those headers in step with the pages'.
  Pages run their queries in parallel where they can; each sequential Supabase call adds about 40 ms.
- Phone first, then three steps up, set in each module:
  - 720 px (a tablet, a narrow window, a phone on its side): the tab bar becomes a narrow column on the left
    (BottomNav: icons over names, the app icon, the language learned), clear of the notch. The page is one column in a
    720 px measure, and sheets open as centred dialogs.
  - 1024 px (a PC): a 1080 px measure, and pages with two halves use `.split` with `.col` groups (`display: contents`
    below this, so the narrower order is the DOM order): 書いてみる, a correction, メモ. 浴びる puts the rain (`.rain`)
    and its controls (`.side`) side by side; narrower, `order` keeps the switches above the rain and the after part
    below. The tutorial puts each step's words and action on the left and what it shows on the right.
  - 1280 px: the column widens to the name, the tab names beside their icons and the whole language pair, and the app
    stays a 1360 px block in the middle.
- Phone safe areas (`viewport-fit=cover`): `body` is padded by the top inset and `.status-fill` (root layout) paints
  the status bar solid, since iOS otherwise draws a gradient over content scrolling under it. Pages never add the top
  inset themselves; a page with another background sets `--status-fill` (see login.module.css). The bottom bar's room
  under the tabs is `--nav-bottom` in globals.css.
