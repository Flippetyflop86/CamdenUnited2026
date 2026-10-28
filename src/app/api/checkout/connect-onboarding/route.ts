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
        let userEmail = (body.treasurerEmail as string | undefined)?.trim();
        const treasurerFirstName = (body.treasurerFirstName as string | undefined)?.trim();
        const treasurerLastName = (body.treasurerLastName as string | undefined)?.trim();
        const accountHolderType = (body.accountHolderType as 'individual' | 'company' | 'non_profit' | undefined) || 'individual';
        const resetExisting = Boolean(body.resetAccount);

        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                userEmail = userEmail || user.email;
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
            .select('id, name, stripe_connect_account_id, stripe_connect_onboarding_completed')
            .eq('id', clubId)
            .single();

        if (clubError || !club) {
            return NextResponse.json({ error: 'Could not retrieve club settings' }, { status: 404 });
        }

        const stripe = getStripe();
        const origin = request.headers.get('origin') || 'https://clubflow.org.uk';
        const clubPortalUrl = `${origin}/pay/club/${club.id}`;
        let accountId = resetExisting ? null : club.stripe_connect_account_id;

        // If an account already exists and onboarding is complete, try creating an Express Dashboard Login Link
        // if requested by the client
        if (accountId && body.action === 'dashboard') {
            try {
                const loginLink = await stripe.accounts.createLoginLink(accountId);
                return NextResponse.json({ url: loginLink.url, accountId });
            } catch {
                // Fall back to account_onboarding if login link is not available (e.g. incomplete Express or Standard account)
            }
        }

        // Helper to create a pre-filled Stripe Express Account tailored for UK Grassroots Football Clubs
        const createPrefilledExpressAccount = async () => {
            const createParams: Stripe.AccountCreateParams = {
                type: 'express',
                country: 'GB',
                email: userEmail || undefined,
                business_type: accountHolderType,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_profile: {
                    name: club.name || 'Football Club',
                    mcc: '7941', // Sports Clubs / Amateur Athletics — prevents Stripe asking what industry the club is in
                    url: clubPortalUrl, // Pre-fills the club's ClubFlow Pay portal so no separate website is required
                    product_description: `Grassroots football club member payments, match fees, and squad fines managed via ClubFlow for ${club.name || 'the club'}.`,
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'daily',
                        },
                        statement_descriptor: (club.name || 'CLUBFLOW').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 22).toUpperCase() || 'CLUBFLOW PAY',
                    },
                },
                metadata: {
                    club_id: club.id,
                    club_name: club.name || 'Football Club',
                    account_holder_type: accountHolderType,
                },
            };

            // Pre-fill treasurer name & email for Individual / Unincorporated Club Treasurer accounts
            if (accountHolderType === 'individual' && (treasurerFirstName || treasurerLastName || userEmail)) {
                createParams.individual = {
                    ...(treasurerFirstName ? { first_name: treasurerFirstName } : {}),
                    ...(treasurerLastName ? { last_name: treasurerLastName } : {}),
                    ...(userEmail ? { email: userEmail } : {}),
                };
            }

            if (accountHolderType === 'company' || accountHolderType === 'non_profit') {
                createParams.company = {
                    name: club.name || 'Football Club',
                };
            }

            const newAccount = await stripe.accounts.create(createParams);

            await supabase
                .from('clubs')
                .update({
                    stripe_connect_account_id: newAccount.id,
                    stripe_connect_onboarding_completed: false,
                })
                .eq('id', club.id);

            return newAccount.id;
        };

        // If no connected account exists, create a new pre-filled Stripe Connect Express Account
        if (!accountId) {
            accountId = await createPrefilledExpressAccount();
        } else {
            // Also update the existing account's business_profile so MCC 7941 & ClubFlow URL are pre-filled
            try {
                await stripe.accounts.update(accountId, {
                    business_profile: {
                        name: club.name || 'Football Club',
                        mcc: '7941',
                        url: clubPortalUrl,
                        product_description: `Grassroots football club member payments, match fees, and squad fines managed via ClubFlow for ${club.name || 'the club'}.`,
                    },
                });
            } catch {
                // Ignore if standard account doesn't allow direct profile update
            }
        }

        // Generate the pre-filled Express onboarding link (collect='currently_due' keeps the form as short as possible)
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/player-payments?connect=refresh`,
            return_url: `${origin}/player-payments?connect=success`,
            type: 'account_onboarding',
            collect: 'currently_due',
        });

        return NextResponse.json({ url: accountLink.url, accountId });
    } catch (err: any) {
        console.error('Stripe Connect Express Onboarding Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
