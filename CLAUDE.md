@AGENTS.md

# ことのあめ（旧 PolyLinga）

Read [CONCEPT.md](CONCEPT.md) before adding anything. A feature that does not fit the shower
(浴びる → 気づく → 言ってみる → また出会う) does not get built. No quizzes, no forced review, no grammar lessons.

## Stack

- Next.js 16 (App Router, Turbopack, `src/proxy.ts` instead of middleware), React 19, plain CSS modules.
- Supabase: shares the project with the old poly-lang app. Everything new is prefixed `pl_`; `kn_` objects (`kn_days`,
  `kn_hours`, `kn_ping`, `kn_hourly`, `kn_stats`, `kn_summary`) belong to the sister app ことのね (its usage counts; schema in that repo's `supabase/usage.sql`). Never touch the old tables
  or the old `tts-audio` bucket (the old app's cron empties it). Schema: `supabase/migrations/`.
- AI (`src/lib/ai.ts`): OpenAI `gpt-6.1-sol` for corrections (one call per attempt, also returns which library patterns the
  corrected sentence uses) and `text-embedding-3-small` for library sentences as they are published (nothing searches
  them at runtime since 自由に添削 replaced 書いてみる's hints). The one other runtime call
  is 詳しく解説 on a learner's own correction (`explainSentence`, action `explainCorrection`): each word with its plain
  meaning and its part of the translation, made only when they press the button and kept in
  `pl_corrections.result.breakdown`, so at most once per correction. Library sentences get no AI explanation.
- Audio: Gemini TTS on Vertex AI (`src/lib/tts.ts`), stored in the public `pl-audio` bucket (`src/lib/audio.ts`).
  Pages link straight to the stored file; `/api/tts` only generates missing clips, and only for approved sentences or the
  learner's own corrections (never for text from the request). The client falls back to the browser's voice.
  - Gemini's pace varies between generations, so each clip is asked for at a learner's pace and measured (speech units
    per second, `PACE_RANGE`); a rushed one is made again.
  - A correction's clip is made right after the correction (`after()` in actions.ts), so its speaker never waits.
  - `src/components/audio.ts` fetches a rain's clips while its first screen is up (they then play at once, even in a
    tunnel). One play per element: a newer one cancels an older one still loading.
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
- つなぐ for the sister apps (`/connect`, `src/lib/sisters.ts`): ことのは, ことのおと, ことのめ, ことのえだ and ことのみ send their learner
  to `/connect?app=&back=&state=`; signed out, they log in or sign up first and come back (`/login?next=`); signed in,
  one press makes a magic-link token (`generateLink`, never mailed) and sends it back to the sister's `/login` in the
  URL fragment with the sister's state. Only to the sisters listed there, at their public addresses or localhost (a
  token sent there signs the learner in; ことのみ has no public address yet, so only localhost until it is written
  there). ことのね keeps its record on the device and has no account yet.
- `src/lib/shower.ts` (+ pure helpers in `shower-core.ts`): picks the next cluster (patterns due to return first,
  then new ones; unseen sentences first) and records exposures, seen sentences and memo-word meetings. A pattern is due
  after `RETURN_DAYS` days or `RETURN_RAINS` other clusters, whichever first, so heavy users meet it again the same
  sitting. A cluster counts as bathed in once all of it has fallen (`recordFinished`), whatever the learner does next.
  A gentle start (a tester's first day of Korean began with -ㄹ래 and 하러 갈래, two patterns stacked): new patterns come
  in an order for someone new to each language (`pl_patterns.step` from `scripts/library/steps.json`: in Korean and
  Chinese first the everyday verbs in their plain form, one per rain with only the noun changing (eat … sleep: 밥 먹어,
  빵 먹어), then saying things about oneself, then fixed phrases after a noun, before (으)/아·어 forms and clauses), and a pattern's unseen
  sentences rain plainest first (`pl_sentence_patterns.extra`, what else a beginner would not know yet, judged by hand
  for each language's opening patterns; unjudged ones count as one), then shortest (`rainOrder`).
- Habit, without streaks (habits form from a cue repeated, and a missed day barely slows that): after the first rain the
  learner is asked once when they will bathe (`pl_settings.rain_cue`, e.g. 電車に乗ったら; `CuePrompt`, settings; not
  again on the rains a correction's 次の雨 leads to), and the rain shows 「〜、ひと雨。」. The first rain of a day ends with
  "enough for today", and coming back after 3+ days away is greeted (`rainSoFar` in me.ts). For train rides: sound and
  translation settings are kept on the device, a rain's clips are fetched before it falls, and half-written sentences
  are kept as drafts (`src/components/local.ts`).
- 単語の雨 (`/app?rain=words`, `_shower/WordRain.tsx`): the third rain on 浴びる, also linked from メモ. The learner's memo
  words fall one at a time with what they wrote beside them, in a new order each round, until they stop it; read aloud by
  the browser's voice if they want, speed kept on the device, the screen kept awake while it runs. Nothing is asked or
  counted, and it does not count as meeting a word (that stays the sentence rain's job).
- One way through: rain → これで言ってみる → correction → 次の雨. The rain has no 次の雨 of its own; the correction page of
  a way of saying has it, right after the correction (`/app?after=<pattern>`, `?rain=minna` too for みんなの雨's
  sentences): the next rain is another way of saying than the one just tried.
- 言ってみる after a rain (`_shower/TryPage.tsx`): a page of its own with no route. ShowerPlayer swaps the whole page and
  pushes a history entry, so back returns to the rain as it was left. The rain's sentences (`Material`: play, tap for
  the word sheet) sit beside the field, or above it on a phone. `tryAfterRain` keeps them with the saying in
  `pl_sayings.matches` (`sentence_id`, or `shared_id` for みんなの雨), and the correction page shows them beside every
  correction. On a phone they come after the correction, right above もう一度書く. The rain's way of saying is lit there
  and not listed again under 同じかたちの文. The correction takes the 言ってみる entry's place in the history; 自分's
  このかたちで言ってみる (`tryPattern`) pushes instead.
- `src/app/tutorial/` + `src/lib/tutorial.ts`: the hands-on tutorial (`/tutorial`, outside the app shell). A new learner
  lands there after `/start`; until `pl_settings.tutorial_seen_at` is set (finished or skipped) 浴びる offers it, and
  settings can open it again. Five steps, each started by the learner's tap and drawn with the app's own screens: the
  rain falls, they press what looks shared and it lights, a sample attempt is corrected and explained word by word (a
  hand-written sample per language, no AI call), three days pass and the way of saying returns with a memo word, and
  they choose when to bathe (saved as the real `rain_cue`). Library sentences of 〜したい in the language learned
  (`PICKS`, all judged plain): the easiest way of saying to notice on a first day (it was 誘う, which a beginner found hard).
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
- `src/lib/corpus.ts`: the sentence library (examples by pattern, sentences by id or word). RLS hides drafts.
- 自由に添削 (`/app/write`, the tab beside 浴びる; `correctFreely`): a sentence written in the language learned (unknown
  words may stay Japanese), with what they meant in Japanese if they like (`intent`, optional), corrected at once on one
  screen. It was 書いてみる: a Japanese intent first, then close library sentences as hints (`pl_hint_sentences`, still
  in the database, no longer called), then writing. Old sayings left at that step still show their stored hints.
- `src/lib/reading.ts`: pinyin over Chinese text. Library sentences use their checked `zh_pinyin`; anything else
  (corrections, memo words) falls back to pinyin-pro, which misreads polyphones such as 得・只・长.
- `src/lib/metering.ts`: daily limits through `pl_consume_for` / `pl_refund_for`, callable by the service role only.
- `src/lib/i18n/`: UI copy per learner language. Only `ja` exists; launch is Japanese speakers → ko / en / zh.
- `src/app/app/`: the learner app — `/app` shower, `/app/write` 自由に添削 (history can be deleted: a saying takes its
  corrections and their みんなの雨 rows with it), `/app/s/[id]` a correction, `/app/memo` typed words (`/app/memo/look`
  例文から探す: library sentences containing a word typed in either language, `lookUp` in corpus.ts; no definitions),
  `/app/me` 自分.
  `src/app/admin/library`: check flagged AI content (allowed for addresses in `ADMIN_EMAILS`).
- 管理 › 利用状況 (`/admin`) and 利用者 (`/admin/users`, `/admin/users/[id]`): how many learners there are and how much
  of each part they use, counts only (never what anyone wrote). A learner is an account with `pl_settings` (made on
  `/start`); a day is active when it has a finished rain, a sentence said, a correction or a memo word (opening the app
  leaves no trace). Read through `pl_admin_*` functions (`supabase/migrations/20261101000000_admin_usage.sql`, service
  role only) by `src/lib/admin-usage.ts`, whose every loader checks the admin itself; pure helpers in
  `admin-usage-core.ts`. Accounts in `pl_admin_excluded` (the admin's own, tests; 集計から外す on a learner's page) are
  left out unless 含めて見る. Charts are server-drawn (`src/app/admin/_usage/charts.tsx`): two tones of the accent,
  a readout on hover and focus, and the numbers in 表で見る.
- 管理 › 姉妹アプリ (`/admin/apps`, `/admin/apps/[id]`): the sisters' use, counted by device, not by person. ことのは,
  ことのおと, ことのめ, ことのえだ, ことのかげ and ことのみ each send `pl_app_ping` (anon key, no session) with a random
  number made on the device and one of `open` / `learn` (its own input step done) / `say` (something of the learner's
  own taken in), only from their public address and unless switched off in their settings; it counts by the hour in
  `pl_app_hours`, capped like ことのね's `kn_ping` (`supabase/migrations/20261103000000_app_usage.sql`). ことのね's own
  `kn_hours` / `kn_days` are read in the same shape. `src/lib/admin-apps-core.ts` lists the apps and names their
  counts (keep it and the SQL's app list in step: `tests/admin-apps.test.mjs`); `admin-apps.ts` loads them. Their
  accounts (`*_records` rows, excluded accounts left out) are counted too. Each ping also says whether a ことのあめ
  account is signed in there (a yes/no, never which) and the kind of device (`ios` / `android` / `pc` / `other`;
  ことのね sends the kind too, in `kn_hours.platform`), so an app's page splits guests from signed-in devices and shows
  the kinds, home screen or browser, how far devices got (opened → learn → say → 2 / 3 days), a weekday × hour grid
  (`WeekHeat`) and whether they came back (`supabase/migrations/20261103120000_usage_insights.sql`).
- 管理 › かたちごと (`/admin/patterns`): each approved pattern of a language in the beginner's order (`step`) with how
  many learners bathed in it, the share kept from the first pattern and from the step just before (marked under 6割:
  where learners stop), met it again, said something with it from its rain, and how many of those sentences came back
  natural (`pl_admin_patterns`). 利用状況 also has its weekday × hour grid and whether learners came back.

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
- `node --env-file=.env.local scripts/apply-steps.mjs [--dry-run]`: store the beginner order of `scripts/library/steps.json`.
- `node --env-file=.env.local scripts/prepare-plain.mjs [--langs=ko,zh,en] [function ids]` → judge
  `scripts/library/work/plain/<lang>.json` by hand (`<lang>.out.json`) → `scripts/apply-plain.mjs [langs] [--dry-run]`:
  how plain each sentence is (default: each language's opening patterns); it lists patterns with too few plain ones.

## Conventions

- UI copy goes in `src/lib/i18n/ja.ts`, written plainly from the learner's side. Client components get strings as props.
- Settings save themselves, with no save button to forget (`SettingsForm`, `UsernameForm`): a pick at once, typing once
  it pauses (`TYPING_PAUSE_MS`) or when the field or page is left, and how it went under the setting that changed.
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
    below this, so the narrower order is the DOM order): 自由に添削, a correction, メモ. 浴びる puts the rain (`.rain`)
    and its controls (`.side`) side by side; narrower, `order` keeps the switches above the rain and the after part
    below. The tutorial puts each step's words and action on the left and what it shows on the right.
  - 1280 px: the column widens to the name, the tab names beside their icons and the whole language pair, and the app
    stays a 1360 px block in the middle.
- Phone safe areas (`viewport-fit=cover`): `body` is padded by the top inset and `.status-fill` (root layout) paints
  the status bar solid, since iOS otherwise draws a gradient over content scrolling under it. Pages never add the top
  inset themselves; a page with another background sets `--status-fill` (see login.module.css). The bottom bar's room
  under the tabs is `--nav-bottom` in globals.css.
