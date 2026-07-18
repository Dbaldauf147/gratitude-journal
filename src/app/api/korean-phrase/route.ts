import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Generates a Korean translation + per-word pronunciation breakdown for a typed
// English phrase. Runs server-side so the API key never reaches the client.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Shape Claude is constrained to return (structured outputs).
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    hangul: {
      type: "string",
      description:
        "The whole phrase in the POLITE/FORMAL register (Hangul). This is the version the word-by-word breakdown below describes — keep it identical to formal.hangul.",
    },
    romanization: { type: "string", description: "Revised Romanization of the polite/formal phrase." },
    formal: {
      type: "object",
      additionalProperties: false,
      description:
        "The polite/formal register (존댓말, typically -요 / -습니다 endings) — used with strangers, elders, in public, or anyone you'd show respect to.",
      properties: {
        hangul: { type: "string" },
        romanization: { type: "string", description: "Revised Romanization." },
        note: {
          type: "string",
          description: "One short line on when to use this version (the social context).",
        },
      },
      required: ["hangul", "romanization", "note"],
    },
    informal: {
      type: "object",
      additionalProperties: false,
      description:
        "The casual/informal register (반말) — used with close friends, family, or people younger than you. If the phrase has no meaningful casual form, give the closest natural casual phrasing anyway.",
      properties: {
        hangul: { type: "string" },
        romanization: { type: "string", description: "Revised Romanization." },
        note: {
          type: "string",
          description: "One short line on when to use this version (the social context).",
        },
      },
      required: ["hangul", "romanization", "note"],
    },
    slang: {
      type: "object",
      additionalProperties: false,
      description:
        "How a young native speaker would actually say this casually today — current slang, abbreviations, or texting style (e.g. ㅋㅋ, internet/Gen-Z phrasing). If there's no natural slang form, give the most casual everyday phrasing and say so in the note.",
      properties: {
        hangul: { type: "string" },
        romanization: { type: "string", description: "Revised Romanization." },
        note: {
          type: "string",
          description:
            "One short line on the vibe / when you'd hear it (e.g. texting friends, social media), and what any slang term literally means.",
        },
      },
      required: ["hangul", "romanization", "note"],
    },
    words: {
      type: "array",
      description: "One entry per word in the Korean phrase, in order.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          hangul: { type: "string" },
          romanization: { type: "string" },
          meaning: { type: "string", description: "Short English meaning of this word." },
          sound: {
            type: "string",
            description:
              "Plain-English 'sound it out' guide for an American speaker, e.g. \"CHEK (like 'check')\". Hyphens split syllables; CAPS marks the syllable to stress.",
          },
        },
        required: ["hangul", "romanization", "meaning", "sound"],
      },
    },
    wholeTip: {
      type: "string",
      description: "One tip on saying the whole phrase at natural speed (linking, intonation).",
    },
    example: {
      type: "object",
      additionalProperties: false,
      properties: {
        korean: { type: "string" },
        english: { type: "string" },
      },
      required: ["korean", "english"],
    },
  },
  required: ["hangul", "romanization", "formal", "informal", "slang", "words", "wholeTip", "example"],
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Translation isn't configured yet (missing ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  let phrase: string;
  try {
    const body = await req.json();
    phrase = typeof body?.phrase === "string" ? body.phrase.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!phrase) {
    return NextResponse.json({ error: "Please enter a phrase." }, { status: 400 });
  }
  if (phrase.length > 200) {
    return NextResponse.json({ error: "That phrase is too long — keep it under 200 characters." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system:
        "You are a friendly Korean tutor. Translate the user's English phrase into natural, commonly-spoken Korean in THREE registers: a polite/formal version (존댓말, for strangers/elders/public), a casual/informal version (반말, for close friends/family), and a slang version (how a young native speaker would actually say it today — current slang, abbreviations, or texting style). For each register give Hangul, Revised Romanization, and one short line on when to use it. Then break the phrase down word by word using the POLITE/FORMAL version, with pronunciation tips for an American English speaker — sound out each word phonetically (hyphens between syllables, CAPS for the stressed syllable) and note tricky sounds like aspirated vs. tense consonants. Set the top-level hangul/romanization to the polite/formal version (identical to the formal object). Keep meanings short.",
      messages: [{ role: "user", content: phrase }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Could not generate a breakdown. Try again." }, { status: 502 });
    }

    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Translation failed: ${msg}` }, { status: 502 });
  }
}
