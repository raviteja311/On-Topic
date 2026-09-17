# Ontopic

[![CI](https://github.com/raviteja311/On-Topic/actions/workflows/ci.yml/badge.svg)](https://github.com/raviteja311/On-Topic/actions/workflows/ci.yml)

Enter a topic, get videos on that topic. No feed, no recommendations, no
comments, nothing queued up next.

Next.js 16 App Router, React 19, TypeScript.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Works with no API key. Without one it serves local demo fixtures and labels
them as demo data.

## Adding an API key

1. Create a project in the [Google Cloud console](https://console.cloud.google.com/apis/credentials)
2. Enable **YouTube Data API v3**
3. Create an API key
4. Put it in `.env.local`:

```bash
YOUTUBE_API_KEY=your-key-here
```

Do not add an HTTP referrer restriction. Ontopic calls the API from the server,
so a referrer-restricted key is rejected.

## Environment variables

| Variable | Effect |
|---|---|
| `YOUTUBE_API_KEY` | Real search. Omit for demo fixtures. |
| `YOUTUBE_RELEVANCE_LANGUAGE` | Optional. Biases results toward one language, e.g. `en`. |
| `SEARCH_DAILY_LIMIT` | Optional. Daily search cap for the whole deployment, default `60`. |
| `SEARCH_VISITOR_LIMIT` | Optional. Daily cap per visitor, default `15`. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Lint |
| `npm run typecheck` | Type check |
| `npm test` | Unit tests |

Tests run on Node's built-in runner, with no test framework to install. They are
TypeScript, executed directly through Node's type stripping, which needs Node
22.18 or newer. The app itself runs on 20.9.

## Deploying

Needs a server, because the API key must never reach the browser. A static
export will not work.

- **Vercel:** import the repo, add `YOUTUBE_API_KEY`
- **Anything else:** `npm run build && npm start` with `YOUTUBE_API_KEY` set

## Notes

- **Searches are links.** The topic and all filters live in the URL, so any
  search can be bookmarked or shared.
- **Search runs on the server.** The API key never reaches the browser.
- **Capped at 60 searches a day**, resetting at midnight Pacific. Repeating a
  search is served from cache for 10 minutes and does not count. The counter and
  the cache both live in process memory, so the cap is per instance, not per
  deployment: a restart clears the count, and on serverless the real ceiling is
  60 multiplied by however many instances happen to be warm. Good enough to stop
  ordinary runaway usage, not a guarantee against a determined caller. Making it
  one shared number means moving both to a shared store such as Vercel KV.
- **Each visitor gets 15 of those searches.** Without a per-visitor share the
  daily cap is first come first served, so one person refreshing could spend the
  day and everyone arriving after them would get the refusal. A visitor is
  whoever the platform's proxy reports, so this is a fairness mechanism rather
  than a security control: anyone able to vary that address can have another
  share, and the deployment cap is what actually bounds the spend. Addresses are
  hashed with a salt generated at startup and are never stored. With no proxy in
  front of the app, as in local development, there is no address to act on and
  only the deployment cap applies.
- **Level is inferred** from keywords in the title, not an API field, so it is
  a guess and labelled as one.
- **24 results per search**, no pagination.
- **Search history stays in the browser** via `localStorage` and is never sent
  anywhere.

The player is YouTube's official embed, so YouTube's own ads and end-screen
suggestions remain. Ontopic is not affiliated with YouTube or Google.
