import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Define the expected schema for validation
const TeamRowSchema = z.object({
    position: z.number().int().optional().default(0),
    team_name: z.string(),
    played: z.number().int().optional().default(0),
    won: z.number().int().optional().default(0),
    drawn: z.number().int().optional().default(0),
    lost: z.number().int().optional().default(0),
    goals_for: z.number().int().optional().default(0),
    goals_against: z.number().int().optional().default(0),
    goal_difference: z.number().int().optional().default(0),
    points: z.number().int().optional().default(0),
    is_our_club: z.boolean().optional().default(false),
});

const LeagueTableSchema = z.object({
    teams: z.array(TeamRowSchema)
});

// Basic fuzzy matching function for club names
function isFuzzyMatch(targetName: string, ocrName: string): boolean {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normTarget = normalize(targetName);
    const normOCR = normalize(ocrName);

    // Exact normalized match
    if (normTarget === normOCR) return true;

    // Common abbreviations
    const variations = [
        normTarget,
        normTarget.replace('united', 'utd'),
        normTarget.replace('footballclub', 'fc'),
        normTarget.replace('united', 'utdfc')
    ];

    return variations.some(v => normOCR.includes(v) || v.includes(normOCR));
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { image, clubName } = body;

        if (!image) {
            return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Gemini API key is not configured.' }, { status: 500 });
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Use the configured model or default to gemini-1.5-flash
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        // The image data is likely "data:image/png;base64,iVBORw0KGgo..."
        // We need to extract the mime type and the raw base64 data
        const matches = image.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
        
        if (!matches || matches.length !== 3) {
            return NextResponse.json({ success: false, error: 'Invalid image format.' }, { status: 400 });
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        // System prompt to enforce structured JSON output
        const prompt = `You are an expert OCR parser for football league tables. 
I am providing an image of a league table. Extract the data exactly as it appears.
Return a valid JSON object strictly matching this schema:
{
  "teams": [
    {
      "position": 1,
      "team_name": "Example FC",
      "played": 10,
      "won": 7,
      "drawn": 2,
      "lost": 1,
      "goals_for": 25,
      "goals_against": 10
    }
  ]
}

DO NOT wrap the response in markdown blocks (e.g. \`\`\`json). Just output the raw JSON object.
Extract all teams visible in the image.`;

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text().trim();
        
        // Sometimes the model might still return markdown code blocks despite instructions
        const cleanJsonText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        
        let parsedData;
        try {
            parsedData = JSON.parse(cleanJsonText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", cleanJsonText);
            return NextResponse.json({ success: false, error: 'Failed to parse table structure. Try a clearer screenshot.' }, { status: 500 });
        }

        // Validate schema
        const validation = LeagueTableSchema.safeParse(parsedData);
        if (!validation.success) {
            console.error("Zod Validation Error:", validation.error);
            return NextResponse.json({ success: false, error: 'Extracted data did not match expected structure.' }, { status: 500 });
        }

        let teams = validation.data.teams;

        // Normalization & Calculations
        teams = teams.map((team, index) => {
            // Ensure position is sequential if missing or 0
            if (!team.position) team.position = index + 1;
            
            // Calculate GD rather than trusting OCR
            team.goal_difference = team.goals_for - team.goals_against;
            
            // Calculate Points (Standard 3 points for win, 1 for draw)
            team.points = (team.won * 3) + team.drawn;

            // Fuzzy match club name
            if (clubName && isFuzzyMatch(clubName, team.team_name)) {
                team.is_our_club = true;
            } else {
                team.is_our_club = false;
            }

            return team;
        });

        // Optional: If no club was found via fuzzy match, try to find the absolute closest match or just leave it.
        // We'll trust the user to fix it if it misses.

        return NextResponse.json({ success: true, teams });

    } catch (error: any) {
        console.error('OCR Parsing Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'An unexpected error occurred during extraction.' 
        }, { status: 500 });
    }
}
