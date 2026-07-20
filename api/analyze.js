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
      error: "GEMINI_API_KEY is not set in Vercel environment variables.",
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

    const model = "gemini-2.5-flash"; // free-tier model
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

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return res.status(502).json({ error: "Gemini API request failed." });
    }

    const geminiData = await geminiRes.json();
    const summary =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Gemini returned no content.";

    return res.status(200).json({ summary });
  } catch (err) {
    console.error("analyze.js error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
