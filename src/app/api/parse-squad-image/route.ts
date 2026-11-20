import { NextRequest, NextResponse } from "next/server";

const VISION_SYSTEM_PROMPT =
    "Extract every football player from this squad list screenshot, photo, spreadsheet, or team sheet. " +
    "Output ONLY one player per line in the format: `[ShirtNumber]. [FirstName] [LastName] ([Position])` " +
    "(use `CM` if no position is visible, and omit the number if no shirt number is shown). " +
    "Valid position codes: GK, CB, RB, LB, RWB, LWB, CDM, CM, CAM, RW, LW, ST. " +
    "Ignore UI chrome, headers, column titles, timestamps, and non-player text. Output plain lines only with no markdown fences or commentary.";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const imageFile = formData.get("image") as File | null;
        if (!imageFile) {
            return NextResponse.json({ available: false, error: "No image provided" }, { status: 400 });
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = imageFile.type || "image/png";

        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;

        // 1. Gemini 2.0 Flash Vision
        if (geminiKey) {
            try {
                const geminiRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: VISION_SYSTEM_PROMPT },
                                        {
                                            inlineData: {
                                                mimeType,
                                                data: base64Image,
                                            },
                                        },
                                    ],
                                },
                            ],
                        }),
                    }
                );
                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    const text =
                        data?.candidates?.[0]?.content?.parts
                            ?.map((p: any) => p?.text || "")
                            .join("\n")
                            .trim() || "";
                    if (text) {
                        return NextResponse.json({ available: true, engine: "Gemini Vision", text });
                    }
                }
            } catch {}
        }

        // 2. OpenAI gpt-4o-mini Vision
        if (openaiKey) {
            try {
                const oaRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${openaiKey}`,
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        temperature: 0,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: VISION_SYSTEM_PROMPT },
                                    {
                                        type: "image_url",
                                        image_url: { url: `data:${mimeType};base64,${base64Image}` },
                                    },
                                ],
                            },
                        ],
                    }),
                });
                if (oaRes.ok) {
                    const data = await oaRes.json();
                    const text = (data?.choices?.[0]?.message?.content || "").trim();
                    if (text) {
                        return NextResponse.json({ available: true, engine: "OpenAI Vision", text });
                    }
                }
            } catch {}
        }

        // 3. Groq Llama-4 Scout Vision
        if (groqKey) {
            try {
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${groqKey}`,
                    },
                    body: JSON.stringify({
                        model: "meta-llama/llama-4-scout-17b-16e-instruct",
                        temperature: 0,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: VISION_SYSTEM_PROMPT },
                                    {
                                        type: "image_url",
                                        image_url: { url: `data:${mimeType};base64,${base64Image}` },
                                    },
                                ],
                            },
                        ],
                    }),
                });
                if (groqRes.ok) {
                    const data = await groqRes.json();
                    const text = (data?.choices?.[0]?.message?.content || "").trim();
                    if (text) {
                        return NextResponse.json({ available: true, engine: "Groq Vision", text });
                    }
                }
            } catch {}
        }

        // Signal client to run built-in OCR fallback seamlessly
        return NextResponse.json({ available: false });
    } catch (err: any) {
        return NextResponse.json(
            { available: false, error: err?.message || "Image parse error" },
            { status: 500 }
        );
    }
}
