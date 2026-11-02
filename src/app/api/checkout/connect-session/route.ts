import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { calculateClubFlowFee, encodePaymentDescription, parsePaymentDescription } from '@/lib/clubflow-pay';
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
        const body = await request.json();
        const { paymentId, paymentIds, quickPay } = body;

        const origin = request.headers.get('origin') || 'https://clubflow.org.uk';
        const stripe = getStripe();

        // =========================================================================
        // MODE A: QUICK PAY INTO CLUB (Player initiates ad-hoc payment via portal)
        // =========================================================================
        if (quickPay && quickPay.clubId && quickPay.playerId && Number(quickPay.amount) > 0) {
            const clubId = String(quickPay.clubId);
            const playerId = String(quickPay.playerId);
            const baseAmount = Number(quickPay.amount);
            const rawReason = String(quickPay.description || '💳 Club Payment').trim();
            const feeCoverage: 'player' | 'club' = quickPay.feeCoverage === 'club' ? 'club' : 'player';

            const { data: club, error: clubError } = await supabase
                .from('clubs')
                .select('id, name, stripe_connect_account_id')
                .eq('id', clubId)
                .single();

            if (clubError || !club || !club.stripe_connect_account_id) {
                return NextResponse.json(
                    { error: 'This club has not linked their payout bank account with Stripe yet.' },
                    { status: 400 }
                );
            }

            const { data: player } = await supabase
                .from('players')
                .select('first_name, last_name, email')
                .eq('id', playerId)
                .maybeSingle();

            const encodedDesc = encodePaymentDescription(rawReason, {
                feeCoverage,
                payoutAccountLabel: `${club.name || 'Club'} Bank Account`,
            });

            const { data: createdPayment, error: insertError } = await supabase
                .from('player_payment_requests')
                .insert([
                    {
                        club_id: clubId,
                        player_id: playerId,
                        amount: baseAmount,
                        description: encodedDesc,
                        status: 'Unpaid',
                    },
                ])
                .select()
                .single();

            if (insertError || !createdPayment) {
                return NextResponse.json(
                    { error: insertError?.message || 'Could not create quick payment record' },
                    { status: 500 }
                );
            }

            const feeBreakdown = calculateClubFlowFee(baseAmount, feeCoverage);
            const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: rawReason,
                            description: `${club.name || 'Club'} Direct Payment${
                                player ? ` • ${player.first_name} ${player.last_name}` : ''
                            }`,
                        },
                        unit_amount: feeBreakdown.basePricePence,
                    },
                    quantity: 1,
                },
            ];

            if (feeCoverage === 'player') {
                lineItems.push({
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'ClubFlow Transaction Fee',
                            description: `Payment processing fee (100% of £${feeBreakdown.basePrice.toFixed(2)} goes to ${
                                club.name || 'Club'
                            })`,
                        },
                        unit_amount: feeBreakdown.transactionFeePence,
                    },
                    quantity: 1,
                });
            }

            const session = await stripe.checkout.sessions.create(
                {
                    line_items: lineItems,
                    mode: 'payment',
                    success_url: `${origin}/pay/club/${clubId}?player=${playerId}&payment=success&ids=${createdPayment.id}`,
                    cancel_url: `${origin}/pay/club/${clubId}?player=${playerId}&payment=cancelled`,
                    metadata: {
                        payment_id: createdPayment.id,
                        payment_ids: createdPayment.id,
                        club_id: clubId,
                        player_id: playerId,
                        base_price_pence: String(feeBreakdown.basePricePence),
                        transaction_fee_pence: String(feeBreakdown.transactionFeePence),
                        fee_coverage: feeCoverage,
                    },
                    payment_intent_data: {
                        application_fee_amount: feeBreakdown.applicationFeePence,
                    },
                },
                {
                    stripeAccount: club.stripe_connect_account_id,
                }
            );

            await supabase
                .from('player_payment_requests')
                .update({ stripe_checkout_session_id: session.id })
                .eq('id', createdPayment.id);

            return NextResponse.json({ url: session.url, breakdown: feeBreakdown, paymentId: createdPayment.id });
        }

        // =========================================================================
        // MODE B: PAY ALL (BASKET OF MULTIPLE UNPAID FINES IN 1 TAP)
        // =========================================================================
        if (Array.isArray(paymentIds) && paymentIds.length > 1) {
            const cleanIds = paymentIds.map((id: any) => String(id)).filter(Boolean);
            const { data: payments, error: paymentsError } = await supabase
                .from('player_payment_requests')
                .select('*')
                .in('id', cleanIds)
                .neq('status', 'Paid');

            if (paymentsError || !payments || payments.length === 0) {
                return NextResponse.json({ error: 'No unpaid payment requests found' }, { status: 404 });
            }

            const firstPayment = payments[0];
            const { data: player } = await supabase
                .from('players')
                .select('first_name, last_name, email')
                .eq('id', firstPayment.player_id)
                .maybeSingle();

            const { data: club, error: clubError } = await supabase
                .from('clubs')
                .select('id, name, stripe_connect_account_id')
                .eq('id', firstPayment.club_id)
                .single();

            if (clubError || !club || !club.stripe_connect_account_id) {
                return NextResponse.json(
                    { error: 'This club has not linked their payout bank account with Stripe yet.' },
                    { status: 400 }
                );
            }

            const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
            let totalBasePence = 0;
            let totalPlayerFeePence = 0;
            let totalAppFeePence = 0;

            for (const pay of payments) {
                const meta = parsePaymentDescription(pay.description);
                const fb = calculateClubFlowFee(Number(pay.amount), meta.feeCoverage);
                totalBasePence += fb.basePricePence;
                totalAppFeePence += fb.applicationFeePence;
                if (meta.feeCoverage === 'player') {
                    totalPlayerFeePence += fb.transactionFeePence;
                }

                lineItems.push({
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: meta.cleanDescription,
                            description: `${club.name || 'Club'} Fine / Request${
                                player ? ` • ${player.first_name} ${player.last_name}` : ''
                            }`,
                        },
                        unit_amount: fb.basePricePence,
                    },
                    quantity: 1,
                });
            }

            if (totalPlayerFeePence > 0) {
                lineItems.push({
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'ClubFlow Transaction Fee',
                            description: `Combined processing fee across ${payments.length} items`,
                        },
                        unit_amount: totalPlayerFeePence,
                    },
                    quantity: 1,
                });
            }

            const activeIds = payments.map(p => p.id);
            const session = await stripe.checkout.sessions.create(
                {
                    line_items: lineItems,
                    mode: 'payment',
                    success_url: `${origin}/pay/club/${club.id}?player=${firstPayment.player_id}&payment=success&ids=${activeIds.join(',')}`,
                    cancel_url: `${origin}/pay/club/${club.id}?player=${firstPayment.player_id}&payment=cancelled`,
                    metadata: {
                        payment_id: activeIds[0],
                        payment_ids: activeIds.join(','),
                        club_id: club.id,
                        player_id: firstPayment.player_id,
                        base_price_pence: String(totalBasePence),
                        transaction_fee_pence: String(totalPlayerFeePence),
                    },
                    payment_intent_data: {
                        application_fee_amount: totalAppFeePence,
                    },
                },
                {
                    stripeAccount: club.stripe_connect_account_id,
                }
            );

            await supabase
                .from('player_payment_requests')
                .update({ stripe_checkout_session_id: session.id })
                .in('id', activeIds);

            return NextResponse.json({ url: session.url });
        }

        // =========================================================================
        // MODE C: SINGLE PAYMENT REQUEST CHECKOUT
        // =========================================================================
        const singleId = paymentId || (Array.isArray(paymentIds) ? paymentIds[0] : null);
        if (!singleId) {
            return NextResponse.json({ error: 'Missing paymentId parameter' }, { status: 400 });
        }

        const { data: payment, error: paymentError } = await supabase
            .from('player_payment_requests')
            .select('*')
            .eq('id', singleId)
            .single();

        if (paymentError || !payment) {
            return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
        }

        if (payment.status === 'Paid') {
            return NextResponse.json({ error: 'Payment request has already been paid' }, { status: 400 });
        }

        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('first_name, last_name, email')
            .eq('id', payment.player_id)
            .single();

        if (playerError || !player) {
            return NextResponse.json({ error: 'Player record not found' }, { status: 404 });
        }

        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('name, stripe_connect_account_id, stripe_connect_onboarding_completed')
            .eq('id', payment.club_id)
            .single();

        if (clubError || !club || !club.stripe_connect_account_id) {
            return NextResponse.json(
                { error: 'This club has not linked their payout bank account with Stripe yet.' },
                { status: 400 }
            );
        }

        const meta = parsePaymentDescription(payment.description);
        const feeBreakdown = calculateClubFlowFee(Number(payment.amount), meta.feeCoverage);

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            {
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: meta.cleanDescription,
                        description: `${club.name || 'Club'} Payment Request • Player: ${player.first_name} ${player.last_name}`,
                    },
                    unit_amount: feeBreakdown.basePricePence,
                },
                quantity: 1,
            },
        ];

        if (meta.feeCoverage === 'player') {
            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'ClubFlow Transaction Fee',
                        description: `Payment processing fee (100% of £${feeBreakdown.basePrice.toFixed(2)} base price goes to ${
                            club.name || 'Club'
                        })`,
                    },
                    unit_amount: feeBreakdown.transactionFeePence,
                },
                quantity: 1,
            });
        }

        // Omit restrictive payment_method_types so Apple Pay, Google Pay, Link, and Card are all enabled automatically
        const session = await stripe.checkout.sessions.create(
            {
                line_items: lineItems,
                mode: 'payment',
                success_url: `${origin}/pay/${singleId}?payment=success`,
                cancel_url: `${origin}/pay/${singleId}?payment=cancelled`,
                metadata: {
                    payment_id: singleId,
                    payment_ids: singleId,
                    club_id: payment.club_id,
                    player_id: payment.player_id,
                    base_price_pence: String(feeBreakdown.basePricePence),
                    transaction_fee_pence: String(feeBreakdown.transactionFeePence),
                    fee_coverage: meta.feeCoverage,
                },
                payment_intent_data: {
                    application_fee_amount: feeBreakdown.applicationFeePence,
                },
            },
            {
                stripeAccount: club.stripe_connect_account_id,
            }
        );

        await supabase
            .from('player_payment_requests')
            .update({ stripe_checkout_session_id: session.id })
            .eq('id', singleId);

        return NextResponse.json({ url: session.url, breakdown: feeBreakdown });
    } catch (err: any) {
        console.error('Stripe Connect Checkout Session creation failed:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
