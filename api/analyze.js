// Vercel Serverless Function: /api/analyze
// Takes the last 3 days of incident records from the Megaworld dashboard and
// asks a free OpenRouter model for a short summary + cautious trend note.
//
// SETUP:
// 1. Sign up (free, no credit card) at https://openrouter.ai
// 2. Go to https://openrouter.ai/keys → Create Key → copy it (starts with sk-or-...)
// 3. In Vercel: Project Settings → Environment Variables →
//    add OPENROUTER_API_KEY = <your key>
// 4. Redeploy.
//
// Free tier: ~50 requests/day per key (1,000/day if you ever add $10 lifetime
// credit — not required). Plenty for a dashboard that refreshes periodically.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Missing API key",
      details: "OPENROUTER_API_KEY is not set in Vercel's Environment Variables. Add it in Project Settings, then redeploy.",
    });
  }

  try {
    const { rows, focus } = req.body;

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        summary: "No incident reports were recorded in the past 3 days.",
      });
    }

    const prompt = `You are an operations analyst for the Megaworld Township incident reporting system.
Below is JSON data for all incidents logged in the last 3 days (type, classification, alert level,
township, location, date, time, response time in minutes, resolved status).

${focus ? `For this particular analysis: ${focus}` : ""}

Write a concise analysis for display on a wall-mounted TV dashboard. Structure it as:
1. A one-paragraph summary of what happened (volume, most common incident type, notable townships/locations).
2. Key trend observation (increasing/decreasing/stable, any spikes, response time patterns).
3. A short, cautious forward-looking note (1-2 sentences) — do not overstate confidence, this is a
   simple pattern observation, not a guarantee.

Keep the total response under 110 words. Plain text only, no markdown formatting, no headers.

DATA:
${JSON.stringify(rows)}`;

    // Using OpenRouter's auto-router for free models instead of a hardcoded
    // model name. The free-model catalog rotates frequently (models get added
    // and pulled without notice) — "openrouter/free" always picks from
    // whatever's currently available, so this won't break again when a
    // specific model gets retired from the free tier.
    const model = "openrouter/free";

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const rawText = await orRes.text();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!orRes.ok) {
      // Surface the real error so it's visible on the dashboard itself.
      const orMessage = parsed?.error?.message || rawText || "Unknown error from OpenRouter.";
      console.error("OpenRouter API error:", orMessage);
      return res.status(502).json({
        error: "OpenRouter API request failed",
        details: `[${orRes.status}] ${orMessage}`,
      });
    }

    const summary = parsed?.choices?.[0]?.message?.content?.trim() || "OpenRouter returned no content.";

    return res.status(200).json({ summary });
  } catch (err) {
    console.error("analyze.js error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
}
