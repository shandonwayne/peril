import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const POINT_VALUES = [200, 400, 600, 800, 1000];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();

    if (!topic || typeof topic !== "string") {
      return new Response(
        JSON.stringify({ error: "topic is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a Jeopardy question writer. Generate exactly 5 trivia questions and answers on the given topic, scaled in difficulty: 200 (easiest), 400, 600, 800, 1000 (hardest).

Return ONLY valid JSON — an array of exactly 5 objects in this format:
[
  { "point_value": 200, "question_text": "...", "answer_text": "..." },
  { "point_value": 400, "question_text": "...", "answer_text": "..." },
  { "point_value": 600, "question_text": "...", "answer_text": "..." },
  { "point_value": 800, "question_text": "...", "answer_text": "..." },
  { "point_value": 1000, "question_text": "...", "answer_text": "..." }
]

Rules:
- question_text: write in classic Jeopardy clue format (a statement the contestant responds to as a question)
- answer_text: the correct response in the form "What is ..." or "Who is ..."
- No explanations, no markdown, no extra keys — only the JSON array

Topic: ${topic}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let questions;
    try {
      questions = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        questions = JSON.parse(match[0]);
      } else {
        throw new Error("Could not parse JSON from Gemini response");
      }
    }

    if (!Array.isArray(questions) || questions.length !== 5) {
      throw new Error("Expected exactly 5 questions");
    }

    const sorted = POINT_VALUES.map(pv => {
      const q = questions.find((x: { point_value: number }) => x.point_value === pv);
      if (!q) throw new Error(`Missing question for ${pv} points`);
      return { point_value: pv, question_text: q.question_text, answer_text: q.answer_text };
    });

    return new Response(
      JSON.stringify({ questions: sorted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
