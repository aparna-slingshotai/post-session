import { NextResponse } from "next/server";
import { z } from "zod";

import { summarize } from "@/lib/anthropic";

const schema = z.object({
  content: z.string().min(1).max(100000),
});

const ANALYZE_PROMPT = `You are analyzing a piece of text that a user has uploaded as context for a therapy reflection session. Based on the content, provide a short title, a brief summary, and bullet points about why this matters.

Return your response as JSON with exactly three keys. No markdown, no code fences, no extra text. Just the raw JSON object.

{
  "whatIsThis": "...",
  "summary": "...",
  "whyImportant": ["...", "...", "..."]
}

"whatIsThis" — A short, clear title for this document (3-8 words max). Examples: "Session 4 with Dr. Soto" or "Journal entry on conflict with mom" or "Couples therapy notes, March 12"

"summary" — A 1-2 sentence plain-language summary of the content. Keep it under 30 words. Be specific. Example: "Mara explores feelings of loneliness around close friends and a pattern of performing happiness to avoid burdening others."

"whyImportant" — An array of 2-4 short bullet points (each 5-15 words) identifying the key themes or moments worth exploring. Be specific to the actual content. Examples: ["Breakthrough moment around avoidant patterns", "First time naming anger toward partner", "Therapist identified a repeating cycle"]

Be specific to the actual content. Do not be generic.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);

    const raw = await summarize(ANALYZE_PROMPT, parsed.content);

    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      const result = JSON.parse(cleaned);
      const bullets = Array.isArray(result.whyImportant)
        ? result.whyImportant
        : typeof result.whyImportant === "string"
          ? [result.whyImportant]
          : [];
      return NextResponse.json({
        whatIsThis: result.whatIsThis || "",
        summary: result.summary || "",
        whyImportant: bullets,
      });
    } catch {
      return NextResponse.json({ whatIsThis: "", whyImportant: [] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
