import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { canAccessSubsPayments } from '@/lib/feature-flags';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
    }
    return stripeInstance;
};

export async function POST(request: Request) {
    const supabase = getServerSupabase();
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: Missing authentication token' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        if (!canAccessSubsPayments(user.email)) {
            return NextResponse.json(
                { error: 'Subs & Payments is coming soon and currently in private preview.' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        let clubId = body.clubId as string | undefined;
        let userEmail = (body.treasurerEmail as string | undefined)?.trim() || user.email;
        const treasurerFirstName = (body.treasurerFirstName as string | undefined)?.trim();
        const treasurerLastName = (body.treasurerLastName as string | undefined)?.trim();
        const accountHolderType = (body.accountHolderType as 'individual' | 'company' | 'non_profit' | undefined) || 'individual';
        const resetExisting = Boolean(body.resetAccount);
        const preferEmbedded = Boolean(body.preferEmbedded);

        const { data: member } = await supabase
            .from('club_members')
            .select('club_id, email, role')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!member) {
            return NextResponse.json({ error: 'Forbidden: Club membership not found' }, { status: 403 });
        }

        if (clubId && clubId !== member.club_id) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission for this club' }, { status: 403 });
        }

        clubId = member.club_id;
        userEmail = userEmail || member.email || undefined;

        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('id, name, stripe_connect_account_id, stripe_connect_onboarding_completed')
            .eq('id', clubId)
            .single();

        if (clubError || !club) {
            return NextResponse.json({ error: 'Could not retrieve club settings' }, { status: 404 });
        }

        const stripe = getStripe();
        const origin = request.headers.get('origin') || 'https://www.clubflow.org.uk';
        const clubPortalUrl = `${origin}/pay/club/${club.id}`;
        let accountId = resetExisting ? null : club.stripe_connect_account_id;

        if (accountId && body.action === 'dashboard') {
            try {
                const loginLink = await stripe.accounts.createLoginLink(accountId);
                return NextResponse.json({ url: loginLink.url, accountId });
            } catch {
                // Fall back to onboarding below if login link is not yet available
            }
        }

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
                    mcc: '7941', // Sports Clubs / Amateur Athletics
                    url: clubPortalUrl,
                    product_description: `Football club player subs, match fees, and club payments managed via ClubFlow for ${club.name || 'the club'}.`,
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'daily',
                        },
                        statement_descriptor:
                            (club.name || 'CLUBFLOW')
                                .replace(/[^a-zA-Z0-9 ]/g, '')
                                .slice(0, 22)
                                .toUpperCase() || 'CLUBFLOW PAY',
                    },
                },
                metadata: {
                    club_id: club.id,
                    club_name: club.name || 'Football Club',
                    account_holder_type: accountHolderType,
                },
            };

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

        if (!accountId) {
            accountId = await createPrefilledExpressAccount();
        } else {
            try {
                await stripe.accounts.update(accountId, {
                    business_profile: {
                        name: club.name || 'Football Club',
                        mcc: '7941',
                        url: clubPortalUrl,
                        product_description: `Football club player subs, match fees, and club payments managed via ClubFlow for ${club.name || 'the club'}.`,
                    },
                });
            } catch {
                // Ignore if account doesn't permit direct profile update
            }
        }

        // Try Embedded Stripe Connect Account Session first if requested and publishable key is configured
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (preferEmbedded && publishableKey && body.action !== 'dashboard') {
            try {
                const accountSession = await stripe.accountSessions.create({
                    account: accountId,
                    components: {
                        account_onboarding: {
                            enabled: true,
                            features: {
                                external_account_collection: true,
                            },
                        },
                    },
                });
                return NextResponse.json({
                    embedded: true,
                    clientSecret: accountSession.client_secret,
                    publishableKey,
                    accountId,
                });
            } catch (embedErr) {
                console.warn('Embedded Stripe session unavailable, falling back to hosted Express link:', embedErr);
            }
        }

        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/player-payments?connect=refresh`,
            return_url: `${origin}/player-payments?connect=success`,
            type: 'account_onboarding',
            collect: 'currently_due',
        });

        return NextResponse.json({ embedded: false, url: accountLink.url, accountId });
    } catch (err: any) {
        console.error('Stripe Connect Express Onboarding Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
