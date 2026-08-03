import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fixtures, clubName } = body;

        if (!fixtures || !clubName) {
            return NextResponse.json({ success: false, error: 'Missing fixtures or clubName' }, { status: 400 });
        }

        // Get club ID - using ilike for case insensitivity and fuzzy matching
        const { data: clubs, error: clubError } = await supabase
            .from('clubs')
            .select('id')
            .ilike('name', `%${clubName}%`)
            .limit(1);

        if (clubError || !clubs || clubs.length === 0) {
            return NextResponse.json({ success: false, error: 'Club not found' }, { status: 400 });
        }
        
        const clubId = clubs[0].id;

        // Map parsed UI format to database format
        const matchesToInsert = fixtures.map((f: any) => ({
            club_id: clubId,
            date: f.date,
            time: f.time,
            opponent: f.opponent,
            is_home: f.is_home,
            competition: f.competition,
            venue_name: f.venue,
            result: 'Pending',
            status: 'Upcoming'
        }));

        const { data, error } = await supabase
            .from('matches')
            .insert(matchesToInsert)
            .select();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, importedCount: data.length });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
