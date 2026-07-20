# Megaworld Township Incident Dashboard — What Changed

## Files
```
index.html        → your dashboard, enhanced (see below)
api/analyze.js     → new Vercel serverless function powering the AI panel
```

## What was enhanced

### 1. TV / Wall Display Mode now guarantees no scrolling
Previously, TV Mode hid the filter bar and scaled everything up — but nothing
actually forced the content to fit one screen. Now the whole layout uses a
flexible height system where every section (header, filters, KPI cards, charts,
AI panel) takes an exact share of the screen, so the total can never exceed 100%
of the TV's height. No scrollbar will ever appear in TV Mode.

### 2. Filter dropdowns stay visible, compressed to one line
The Month / Groupings / Township dropdowns and buttons used to disappear
entirely in TV Mode. They're now visible and locked to a single horizontal row.

### 3. Charts and map auto-shrink to fit
Whichever view is active (MAIN, VEHICULAR, TIME, ALERT, TOWNSHIP, TYPE) — including
views with two rows of panels like MAIN — every chart and the map now resize to
split the remaining screen height evenly. Nothing is fixed-height anymore, so it
adapts automatically to any screen size.

### 4. New: AI Analytics panel
A new panel at the bottom reads the last 3 days of incident data already loaded
from your Google Sheet and asks Google's **free Gemini API** for a short summary:
what happened, the trend, and a cautious forward-looking note. It appears in both
normal and TV mode, and refreshes automatically every time the dashboard reloads
data (plus a manual Refresh button).

## Setup required: Gemini API key

Your dashboard already pulls live data from Google Sheets — nothing to change there.
You only need to add one thing for the AI panel to work:

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with a Google account (no credit card needed)
3. Click **Create API key** and copy it (starts with `AIza...`)
4. In Vercel: **Project Settings → Environment Variables** →
   add `GEMINI_API_KEY` = *your key*
5. Redeploy

Free tier is roughly 10 requests/minute — comfortably enough for a dashboard
that refreshes every few minutes.

## Deploying
Push both `index.html` and the `api/` folder to your GitHub repo exactly as
they are (same structure) — Vercel will automatically detect `api/analyze.js`
as a serverless function, no extra config needed.
