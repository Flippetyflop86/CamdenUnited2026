import { NextRequest, NextResponse } from "next/server";

const FOOTBALL_WHISPER_PROMPT =
    "Football touchline scouting report: 4-2-3-1, 4-3-3, 4-4-2, 3-5-2, 3-4-3, 5-3-2, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, " +
    "centre-back, full-back, wing-back, holding midfielder, pivot, striker, winger, high press, mid-block, low block, " +
    "counter-attack, transition, build-up, playing out from the back, overload, overlap, underlap, half-space, " +
    "in behind, set piece, free kick, inswinging corner, outswinging corner, near post, back post, long throw, " +
    "left-footed, right-footed, weak foot, slow to turn, 1v1, 2v1, danger man.";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File | null;

        if (!audioFile) {
            return NextResponse.json({ available: false, error: "No audio file provided" }, { status: 400 });
        }

        const groqKey = process.env.GROQ_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

        // 1. Prefer Groq Whisper (ultra-fast whisper-large-v3-turbo) or OpenAI Whisper (whisper-1)
        if (groqKey || openaiKey) {
            const isGroq = Boolean(groqKey);
            const endpoint = isGroq
                ? "https://api.groq.com/openai/v1/audio/transcriptions"
                : "https://api.openai.com/v1/audio/transcriptions";
            const apiKey = (groqKey || openaiKey) as string;
            const model = isGroq ? "whisper-large-v3-turbo" : "whisper-1";

            const upstreamForm = new FormData();
            upstreamForm.append("file", audioFile, audioFile.name || "scouting-note.webm");
            upstreamForm.append("model", model);
            upstreamForm.append("language", "en");
            upstreamForm.append("prompt", FOOTBALL_WHISPER_PROMPT);
            upstreamForm.append("response_format", "json");

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`
                },
                body: upstreamForm
            });

            if (response.ok) {
                const data = await response.json();
                const text = (data?.text || "").trim();
                if (text) {
                    return NextResponse.json({
                        available: true,
                        engine: isGroq ? "Groq Whisper v3" : "OpenAI Whisper",
                        text
                    });
                }
            }
        }

        // 2. Fallback to Google Gemini Flash Audio Transcription if GEMINI_API_KEY is present
        if (geminiKey) {
            const arrayBuffer = await audioFile.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = audioFile.type || "audio/webm";

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text:
                                            "Transcribe this football scouting voice note accurately into clean British English sentences. " +
                                            "Format formations with hyphens (e.g. 4-2-3-1, 4-3-3) and shirt numbers with # (e.g. #9, #10). " +
                                            "Output ONLY the transcribed text with no extra commentary."
                                    },
                                    {
                                        inlineData: {
                                            mimeType,
                                            data: base64Audio
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                }
            );

            if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const text = (
                    geminiData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join(" ") || ""
                ).trim();
                if (text) {
                    return NextResponse.json({
                        available: true,
                        engine: "Gemini Flash Audio",
                        text
                    });
                }
            }
        }

        // No external AI key configured — client will use its built-in Football Phonetic Normalizer
        return NextResponse.json({ available: false });
    } catch (err: any) {
        return NextResponse.json({ available: false, error: err?.message || "Transcription failed" });
    }
}
