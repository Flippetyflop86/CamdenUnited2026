import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
    }
    return stripeInstance;
};

export async function POST(request: Request) {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify user authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user's club membership
        const { data: member, error: memberError } = await supabase
            .from('club_members')
            .select('club_id, role, email')
            .eq('user_id', user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: 'Could not retrieve club membership details' }, { status: 404 });
        }

        if (member.role !== 'Admin' && member.role !== 'Manager' && member.role !== 'manager') {
            return NextResponse.json({ error: 'Only admins or managers can link a Stripe account' }, { status: 403 });
        }

        // Fetch club settings to check for existing Stripe Connect ID
        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('id, name, stripe_connect_account_id')
            .eq('id', member.club_id)
            .single();

        if (clubError || !club) {
            return NextResponse.json({ error: 'Could not retrieve club settings' }, { status: 404 });
        }

        const stripe = getStripe();
        let accountId = club.stripe_connect_account_id;

        // If no connected account exists, create a new Stripe Connect Standard Account
        if (!accountId) {
            const newAccount = await stripe.accounts.create({
                type: 'standard',
                country: 'GB',
                email: member.email || undefined,
                business_profile: {
                    name: club.name || 'Football Club',
                    url: 'https://clubflow.org.uk',
                },
                metadata: {
                    club_id: club.id,
                }
            });

            accountId = newAccount.id;

            // Update club record with the new account ID
            await supabase
                .from('clubs')
                .update({ stripe_connect_account_id: accountId })
                .eq('id', club.id);
        }

        const origin = request.headers.get('origin') || 'https://clubflow.org.uk';

        // Generate onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/finance?connect=refresh`,
            return_url: `${origin}/finance?connect=success`,
            type: 'account_onboarding',
        });

        return NextResponse.json({ url: accountLink.url });
    } catch (err: any) {
        console.error('Stripe Connect Onboarding Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
