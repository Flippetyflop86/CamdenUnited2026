import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        if (!token) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Missing authentication token' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const body = await request.json();
        const { fixtures, clubId } = body;

        if (!fixtures || !Array.isArray(fixtures) || !clubId) {
            return NextResponse.json({ success: false, error: 'Missing fixtures or clubId' }, { status: 400 });
        }

        const { data: member } = await supabase
            .from('club_members')
            .select('club_id, role')
            .eq('user_id', user.id)
            .eq('club_id', clubId)
            .maybeSingle();

        if (!member) {
            return NextResponse.json({ success: false, error: 'Forbidden: You do not belong to this club' }, { status: 403 });
        }

        // Map parsed UI format to database format
        const matchesToInsert = fixtures.map((f: any) => ({
            club_id: clubId,
            date: f.date,
            time: f.time,
            opponent: f.opponent,
            is_home: f.is_home,
            competition: f.competition,
            result: 'Pending',
            notes: f.venue ? `[Location: ${f.venue}]\n` : ''
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
