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
        const body = await request.json().catch(() => ({}));
        let clubId = body.clubId as string | undefined;
        let userEmail: string | undefined;

        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                userEmail = user.email;
                if (!clubId) {
                    const { data: member } = await supabase
                        .from('club_members')
                        .select('club_id, email')
                        .eq('user_id', user.id)
                        .single();
                    if (member) {
                        clubId = member.club_id;
                        userEmail = userEmail || member.email || undefined;
                    }
                }
            }
        }

        if (!clubId) {
            return NextResponse.json({ error: 'Missing clubId parameter' }, { status: 400 });
        }

        // Fetch club settings to check for existing Stripe Connect ID
        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('id, name, stripe_connect_account_id')
            .eq('id', clubId)
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
                email: userEmail || undefined,
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

        // Generate onboarding link returning straight back to ClubFlow Pay (/player-payments)
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/player-payments?connect=refresh`,
            return_url: `${origin}/player-payments?connect=success`,
            type: 'account_onboarding',
        });

        return NextResponse.json({ url: accountLink.url, accountId });
    } catch (err: any) {
        console.error('Stripe Connect Onboarding Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
