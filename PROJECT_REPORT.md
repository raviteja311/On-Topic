# Ontopic - Project Report

Date: 2026-09-17
Repo: https://github.com/raviteja311/On-Topic
Reviewed at commit `a70e1a0` (working tree clean)

> **Status update, 2026-09-17:** every finding below has since been addressed.
> Section 0 records what changed. The findings are kept as written at review
> time, so the report still reads as the assessment it was; none of them
> describe the code as it now stands.

---

## 0. Fixes applied

All of the following are merged to `main` and green in CI.

| Report item | What changed |
|---|---|
| 5.1 Dependency vulnerabilities | `next` 15.5.23 -> 15.5.25 cleared both critical RCE advisories and `sharp` 0.34.5 -> 0.35.4 the libvips/libheif CVEs. Upgrading to `next` 16.3.5 cleared the two remaining `postcss` advisories. `npm audit` reports 0. |
| 5.2 `npm run lint` broken | ESLint 9 with `eslint-config-next`, flat config, script pointed at the ESLint CLI. Clean, and enforced in CI. |
| 5.3 Cap doesn't survive serverless | README states the per-instance behaviour plainly instead of implying one global cap. |
| 5.4 Watch page blames the link | `getVideoMeta` returns a result separating "the lookup came back empty" from "the lookup failed". Only the former 404s; the latter explains itself. |
| 5.5 No per-visitor rate limiting | `lib/rate-limit.ts` gives each visitor 15 of the 60 daily searches, keyed on a salted hash of the proxied address. |
| 5.6 `safeBack()` backslash bypass | Guard strips control characters and rejects a second character of `/` or `\`. Fixing it surfaced the tab and newline variants too. |
| 5.7 No security headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and a `Permissions-Policy`. No CSP: see below. |
| 5.8 No tests | 63 tests on Node's built-in runner, no new dependencies, enforced in CI. |
| 5.9 Polish | Favicon, generated Open Graph image, `global-error.tsx`, `engines` field, CI. |
| No CI | Three jobs on push and PR: the four checks on Node 22, a build on the 20.9 floor, and an audit at high and above. |

**Three things the review missed**, all found while doing the work:

1. `useRecentTopics` wrote to localStorage from inside a state updater, which
   React calls twice under the `reactStrictMode` this project enables. The
   React Hooks rules bundled with Next 16 flagged it.
2. `getVideoMeta` was called twice per watch page view. The TTL cache hid that
   for a hit, but a *failing* lookup was retried, spending two quota units at
   exactly the moment quota is scarce.
3. `inferLevel`'s fallback comment claimed ties resolved to intermediate, but
   the guard only caught a zero score, so ties were decided by key order.

**Deliberately not done:** no Content-Security-Policy. A useful one has to cover
both the inlined theme script and the inline scripts Next emits for hydration,
which means generating a nonce per request in a proxy. That is a real change
rather than a header, and a CSP weak enough to avoid it ('unsafe-inline') would
be worth nothing. The reasoning is recorded in `next.config.mjs`.

Note that Next 16 removes the `size` and `First Load JS` columns from build
output, so the 108 kB figure quoted in section 2 can no longer be reproduced
that way.

---

## 1. What it is

Ontopic is a single-purpose YouTube search front end. You type a topic, you get
24 videos on that topic, and nothing else: no feed, no sidebar, no comments, no
autoplay-next. Results are rendered server side from the YouTube Data API v3,
and playback happens inside YouTube's official `youtube-nocookie` embed.

The product thesis is narrow and consistently honoured in the code. Every
feature either serves "search, then watch" or was deliberately left out.

**Stack:** Next.js 15.5.23 (App Router), React 19.2.8, TypeScript 5.7 strict,
hand-written CSS with custom properties. Three runtime dependencies total
(`next`, `react`, `react-dom`). No CSS framework, no state library, no UI kit.

---

## 2. Health check (verified, not assumed)

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | Pass, exit 0 |
| Production build | `npx next build` | Pass, compiled in 13.1s, 4/4 pages generated |
| Lint | `npm run lint` | **Cannot run** - no ESLint config, no `eslint` dependency installed |
| Tests | n/a | **None exist** |
| Secrets in git | `git log --all --name-only` | Clean. `.env.local` never committed, correctly gitignored |

Build output:

```
Route (app)                        Size   First Load JS
┌ ƒ /                            2.11 kB        108 kB
├ ○ /_not-found                    123 B        103 kB
└ ƒ /watch/[id]                  1.89 kB        108 kB
+ First Load JS shared by all               103 kB
```

108 kB first load for a fully interactive page is lean. Both real routes are
dynamic (`ƒ`), which is correct - search depends on request-time params.

---

## 3. Architecture

```
app/
  layout.tsx          Shell, metadata, pre-paint theme script, header/footer
  page.tsx            Search page. Parses URL -> Query, streams <Results> in Suspense
  watch/[id]/page.tsx Watch page. Fetches meta, validates back-link, renders player
  error.tsx           Route error boundary
  not-found.tsx       404
  globals.css         988 lines, all design tokens in one :root block
components/           8 files. 5 client ("use client"), 3 server
lib/
  youtube.ts          The only module that talks to Google. Server-only by construction
  budget.ts           Process-local daily search cap
  cache.ts            Process-local TTL Map
  level.ts            Keyword heuristic for beginner/intermediate/advanced
  duration.ts         ISO 8601 parsing + display/screen-reader formatting
  mock.ts             Demo fixtures with locally drawn SVG thumbnails
  types.ts            Shared types, including a discriminated SearchResult union
```

**~1,820 lines of TS/TSX plus 988 lines of CSS.**

### Data flow

1. URL query string is the single source of truth (`?q=&sort=&length=&level=`).
2. `readQuery()` sanitises it - unknown values silently fall back to defaults,
   `q` is trimmed to 120 chars. Nothing throws on a malformed URL.
3. `searchVideos()` runs on the server: cache lookup -> budget check -> YouTube
   `search.list` -> YouTube `videos.list` for durations -> level inference.
4. Level filtering happens in `page.tsx` against the fetched page, not the API.
5. `<Results>` is wrapped in Suspense keyed on `q|sort|length`, so the skeleton
   shows during the request and a level change does **not** trigger a refetch.

### Notable design decisions, and whether they hold up

**API key never reaches the browser.** Search is a server component, not a
client fetch. `lib/youtube.ts` reads `process.env.YOUTUBE_API_KEY` directly.
This is the correct shape and the README explains why static export won't work.
Sound.

**Two quota controls, layered.** `cache.ts` holds identical searches for 10
minutes; `budget.ts` refuses past 60 searches/day (configurable via
`SEARCH_DAILY_LIMIT`) *before* any request goes out. The ordering is
deliberate and correct: cache is checked first so repeats are free and don't
count, budget is checked second so an exhausted cap costs zero quota.

`budget.ts` also gets the details right - the daily window resets on Pacific
midnight via `Intl.DateTimeFormat` with an explicit `timeZone`, matching
Google's own reset without hand-rolled DST arithmetic, and the count is
incremented *before* the request rather than after, because the quota is spent
the moment Google receives the call. Both choices are commented with their
reasoning.

**Level inference is a guess, and says so.** The YouTube API has no difficulty
field, so `level.ts` scores keyword hits, weighting title matches 3x over
description matches (a description often lists a whole "beginner to advanced"
course and would otherwise match everything). It returns the matched phrases,
which the UI surfaces in a tooltip: "Guessed from: beginner, basics". Ties and
zero-score cases default to intermediate, described in the code as "the honest
default: it claims the least". This is the strongest bit of judgement in the
codebase - an unreliable signal shipped with its uncertainty attached rather
than hidden.

**Graceful degradation on the second API call.** `search.list` doesn't return
durations, so a second `videos.list` fills them in. If that call fails, results
still render without durations rather than erroring out. Correct priority.

**Demo mode is a real mode, not a stub.** With no key set, the app serves 11
fixtures with invented titles, locally generated SVG thumbnails (no network
call, and no risk of pairing a real creator's artwork with a fake title), and
applies sort/duration filters locally so the controls visibly work. The UI
labels it as demo data in both the results list and the player area. This makes
the repo reviewable by anyone without a Google Cloud account.

**Error taxonomy.** `SearchFailure` is a discriminated union of five kinds, and
`classify()` separates a spent quota from a bad key - both of which Google
returns as HTTP 403, distinguished only by the `reason` string. Each kind gets
tailored advice in `ErrorState`, and the retry button only appears when a retry
could actually change the outcome (not for `limit` or `quota`). Well thought
through.

---

## 4. Frontend quality

**Accessibility is unusually thorough for a personal project:**

- Skip link to `#main`
- `visually-hidden` spoken duration on every card, because `1:04:07` is read as
  a time of day otherwise (`spokenDuration()` exists solely for this)
- `aria-pressed` on segmented filter buttons, `aria-labelledby` on each group
- Disambiguated labels - "Any" appears in two filter groups, so it gets
  `aria-label="Any duration"` / `"Any level"`
- `role="status" aria-live="polite"` on the result count
- `<time dateTime>` with an absolute date in `title`, so the relative label is
  never the only source
- `@media (prefers-reduced-motion: reduce)` block
- `:focus-visible` styling throughout

**Theming:** a blocking inline script in `<head>` sets `data-theme` before first
paint, so there is no flash of the wrong theme. `ThemeToggle` only keeps the
label in sync and persists the choice. Dark mode is a full swap of the same
token names - no half-themed surfaces. `localStorage` writes are wrapped in
try/catch for private browsing.

**Keyboard:** `/` focuses the search field from anywhere; `f` toggles focus mode
on the watch page; `Escape` exits it. Both handlers correctly bail when the user
is typing in an input or holding a modifier.

**Privacy:** recent topics live in `localStorage` only, with a real Clear button
that removes rather than hides. Stated in the footer.

---

## 5. Issues found

Ordered by what I'd fix first.

### 5.1 Dependency vulnerabilities (high)

`npm audit --omit=dev` reports **3 vulnerabilities (1 critical, 2 high)** in
production dependencies:

- **next 15.5.23** - critical. Unauthenticated RCE on Windows-hosted servers
  (GHSA-p293-qw3h-jr36) and RCE in the Image Optimization API with AVIF files
  (GHSA-2xp9-vwfh-vxw4).
- **postcss** - high. Multiple path-traversal / arbitrary `.map` file disclosure
  advisories via attacker-controlled `sourceMappingURL`.
- **sharp** - high. Inherited libvips and libheif CVEs.

All three are transitive through `next`. `npm audit fix` reports a fix is
available. This is the one item on the list that is genuinely urgent if the app
is deployed anywhere public.

```bash
npm audit fix
```

### 5.2 `npm run lint` is broken (medium)

`package.json` declares `"lint": "next lint"` and the README documents it, but
there is no `.eslintrc*` / `eslint.config.*` and no `eslint` package installed.
The script cannot succeed as-is. There is also an
`// eslint-disable-next-line jsx-a11y/no-autofocus` comment in
`components/SearchBar.tsx:88` referencing a plugin that isn't present.

Separately, `next lint` is deprecated in Next 15.5 in favour of the ESLint CLI
directly. Either wire up ESLint properly or drop the script and the README row -
a documented command that fails is worse than no command.

### 5.3 The daily cap does not survive a serverless deployment (medium)

`budget.ts` and `cache.ts` are both process-local by design, and both say so in
their own comments. But the README states flatly:

> **Capped at 60 searches a day**, resetting at midnight Pacific.

On Vercel - the deployment target the README recommends first - each serverless
instance carries its own counter and its own cache. The effective cap is
60 x (number of warm instances), and the cache hit rate drops accordingly. The
code is honest about this; the README is not. Either add the caveat to the
README or move both to a shared store (Vercel KV / Upstash) for the deployed
path.

### 5.4 Quota exhaustion on the watch page renders as "video not available" (medium)

`getVideoMeta()` returns `null` on any failure, and `app/watch/[id]/page.tsx:34`
turns `null` into `notFound()`. That 404 page says:

> That video is not available. The link may be wrong, or the video may have been
> removed or made private.

If the real cause was a spent quota or a bad key, that message is actively
wrong - it blames the link for a server-side problem. The search page
distinguishes these five failure kinds carefully; the watch page collapses them
all into "removed or private". Threading the existing `SearchFailure` through
`getVideoMeta` would make the two pages consistent.

### 5.5 No per-visitor rate limiting (medium, if deployed publicly)

The 60/day budget is global across all visitors. One person refreshing with
varied topics can exhaust the day's searches for everyone. Fine for a personal
or portfolio deployment; a real problem the moment the URL is shared. Worth at
least an IP-keyed sub-limit.

Related: `getVideoMeta()` deliberately doesn't call `recordSearch()` (it costs
1 quota unit against 100 for a search), so watch-page views burn quota with no
cap at all. Cheap per call, but unbounded.

### 5.6 `safeBack()` can be bypassed with a backslash (low)

`app/watch/[id]/page.tsx:20-25` guards the `?from=` parameter against
off-site redirects:

```ts
if (!value.startsWith("/") || value.startsWith("//")) return "/";
```

A value of `/\evil.com` passes both tests - it starts with `/` and not `//` -
but browsers normalise backslashes to forward slashes in URLs, so it resolves
as the protocol-relative `//evil.com`. The intent of the check is right and the
comment names the right threat; the check just needs to reject backslashes too:

```ts
if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
```

Low severity - it needs a crafted link and only moves the "Back to results"
target - but it's a two-character fix to close properly.

### 5.7 No security headers (low)

`next.config.mjs` sets only `reactStrictMode` and `poweredByHeader: false`.
There is no `headers()` block, so no CSP, `Referrer-Policy`,
`X-Content-Type-Options`, or `Permissions-Policy`. The app has a good
`referrerPolicy` on the iframe specifically, but nothing at the document level.
A CSP is slightly awkward here because of the inline theme script (it would
need a nonce or hash), which is probably why it was skipped.

### 5.8 No tests (low, but the easiest gap to close)

`lib/duration.ts`, `lib/level.ts` and `lib/budget.ts` are pure, dependency-free
functions with well-defined edge cases already documented in their comments:
`P0D` live streams parsing to 0, the title-vs-description weighting, the
tie-to-intermediate default, the Pacific-midnight rollover, malformed
`SEARCH_DAILY_LIMIT` values. These are ideal unit-test targets and would take
under an hour to cover. There is currently no test runner in `package.json` at
all.

### 5.9 Polish gaps (low)

- **No favicon or app icon.** No `public/` directory, no `app/icon.*`.
- **No Open Graph or Twitter card metadata.** The core pitch is "every search is
  a link you can share", but a shared link previews as bare text.
- **No `global-error.tsx`.** `app/error.tsx` covers route errors but not a
  failure in the root layout itself.
- **No CI.** No `.github/` directory, so nothing runs typecheck or build on push.
- **No `engines` field** in `package.json` and no `.nvmrc`, so the required Node
  version is unstated.
- **Level filter can produce near-empty pages.** Level is applied client-side to
  a fixed 24 results with no pagination, so a narrow topic plus "Advanced" can
  leave 2-3 cards. `EmptyState` handles zero results well and offers a Clear
  filters action, but the underlying constraint is structural.

---

## 6. What's genuinely good

Worth naming explicitly, because it's the unusual part:

1. **The comments explain *why*, not *what*.** `budget.ts` opens by explaining
   that Google's quota "fails late and bluntly" and that this counter exists to
   make the failure predictable and self-explaining. `cache.ts` states outright
   that it should be Redis at real traffic and that a Map is the right call now.
   `level.ts` justifies the title weighting with the concrete failure case it
   prevents. This is the documentation that usually doesn't get written.

2. **Known limitations are surfaced to the user, not buried.** Demo data is
   labelled as demo data. Inferred levels are labelled "(inferred)" with the
   matched keywords in a tooltip. The watch page states plainly that YouTube's
   ads and end-screen suggestions can't be removed without breaking the embed
   and violating the terms, rather than pretending they aren't there.

3. **Dependency discipline.** Three runtime packages. No Tailwind, no
   component library, no state manager, no date library - `duration.ts` is
   62 lines and replaces `date-fns` entirely for what this app needs.

4. **URL-as-state.** No client-side search state to desynchronise. Every search
   is bookmarkable and shareable, defaults are omitted from the query string so
   links stay readable, and the whole thing works without JavaScript for the
   initial render.

5. **The failure paths got as much attention as the happy path** - five distinct
   error kinds, tailored advice per kind, a retry button that only appears when
   retrying could help, and a degraded-but-useful render when the durations call
   fails.

---

## 7. Suggested order of work

**Before any public deployment**

1. `npm audit fix` - the critical Next.js RCE (5.1)
2. Fix or remove `npm run lint` (5.2)
3. Backslash guard in `safeBack()` (5.6)
4. Either add the multi-instance caveat to the README or move budget + cache to
   a shared store (5.3)

**Next**

5. Thread real error kinds through `getVideoMeta` so the watch page stops
   blaming the link for quota failures (5.4)
6. Per-IP rate limiting if the URL will be shared (5.5)
7. Unit tests for `duration.ts`, `level.ts`, `budget.ts` (5.8)
8. GitHub Actions running typecheck + build on push

**Polish**

9. Favicon, Open Graph image and metadata (5.9)
10. Security headers in `next.config.mjs` (5.7)
11. `global-error.tsx`, `engines` field

---

## 8. Verdict

A small, opinionated, well-built app. The code is clean, strictly typed, builds
without warning, and the reasoning behind each non-obvious decision is written
down where it happened. The accessibility work and the treatment of uncertain
data (the level heuristic) are both above what a project this size usually gets.

The gaps are the ones you'd expect from a project that was built, pushed once,
and not yet operated: no tests, no CI, no lint setup, and stale dependencies
carrying a critical advisory. None of them are design problems. All of them are
a day's work.

The one thing I'd change conceptually rather than mechanically: the daily budget
and the cache are both correct for a single long-lived process and both quietly
wrong for the serverless target the README recommends first. That mismatch
between documented behaviour and deployed behaviour is the most likely source of
a future surprise.
