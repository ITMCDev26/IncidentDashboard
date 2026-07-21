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
    const { monthlyStats, recentRows, focus } = req.body;

    if (!monthlyStats && (!recentRows || recentRows.length === 0)) {
      return res.status(200).json({
        summary: "No incident data available yet for this view.",
      });
    }

    const prompt = `You are an operations analyst briefing decision-makers for the Megaworld Township
incident reporting system. You have two inputs:

1. MONTHLY_STATS — aggregated statistics for ${monthlyStats?.month || "the current period"} (the whole month, not just recent days).
2. RECENT_INCIDENTS — the individual, detailed incident records from the last 3 days only.

${focus ? `For this particular analysis: ${focus}` : ""}

Write a decision-oriented briefing for display on a wall-mounted TV dashboard, aimed at helping
management decide where to act. Structure it as:
1. Monthly context (1-2 sentences): the overall pattern this month — volume, resolution rate, average
   response time, and which incident type/township stands out most.
2. Last 3 days (1-2 sentences): what's happening right now, and how it compares to the monthly norm
   (higher/lower/in line, any spike or lull).
3. Recommended action (1-2 sentences): a specific, concrete suggestion for what management should
   consider doing next based on this data (e.g. where to allocate patrols/staff, what to monitor,
   what's working well enough to leave alone). Be direct and actionable, not vague. Do not overstate
   confidence — this is a pattern-based suggestion, not a guarantee.

Keep the total response under 130 words. Plain text only, no markdown formatting, no headers, no
bullet symbols — write it as flowing prose paragraphs.

MONTHLY_STATS:
${JSON.stringify(monthlyStats)}

RECENT_INCIDENTS (last 3 days):
${JSON.stringify(recentRows)}`;

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
