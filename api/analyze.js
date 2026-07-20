// Vercel Serverless Function: /api/analyze
// Takes the last 3 days of incident records from the Megaworld dashboard and
// asks Gemini (free tier) for a short summary + cautious trend note.
//
// SETUP:
// 1. Get a free Gemini API key at https://aistudio.google.com/apikey
// 2. In Vercel: Project Settings → Environment Variables →
//    add GEMINI_API_KEY = <your key>
// 3. Redeploy.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Missing API key",
      details: "GEMINI_API_KEY is not set in Vercel's Environment Variables. Add it in Project Settings, then redeploy.",
    });
  }

  try {
    const { rows } = req.body;

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        summary: "No incident reports were recorded in the past 3 days.",
      });
    }

    const prompt = `You are an operations analyst for the Megaworld Township incident reporting system.
Below is JSON data for all incidents logged in the last 3 days (type, classification, alert level,
township, location, date, time, response time in minutes, resolved status).

Write a concise analysis for display on a wall-mounted TV dashboard. Structure it as:
1. A one-paragraph summary of what happened (volume, most common incident type, notable townships/locations).
2. Key trend observation (increasing/decreasing/stable, any spikes, response time patterns).
3. A short, cautious forward-looking note (1-2 sentences) — do not overstate confidence, this is a
   simple pattern observation, not a guarantee.

Keep the total response under 110 words. Plain text only, no markdown formatting, no headers.

DATA:
${JSON.stringify(rows)}`;

    // "gemini-flash-latest" is the current documented alias for Google's free-tier
    // flash model — more resilient than pinning an exact dated model name, which
    // can be renamed/retired and cause 404s from Gemini's side.
    const model = "gemini-flash-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    const rawText = await geminiRes.text();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!geminiRes.ok) {
      // Surface Gemini's actual error message so it's visible on the dashboard
      // itself, not just in Vercel's logs.
      const geminiMessage = parsed?.error?.message || rawText || "Unknown error from Gemini.";
      console.error("Gemini API error:", geminiMessage);
      return res.status(502).json({
        error: "Gemini API request failed",
        details: `[${geminiRes.status}] ${geminiMessage}`,
      });
    }

    const summary =
      parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Gemini returned no content.";

    return res.status(200).json({ summary });
  } catch (err) {
    console.error("analyze.js error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
}
