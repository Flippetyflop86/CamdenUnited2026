import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateClubFlowFee, parsePaymentDescription } from '@/lib/clubflow-pay';
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
        const { paymentId } = await request.json();
        if (!paymentId) {
            return NextResponse.json({ error: 'Missing paymentId parameter' }, { status: 400 });
        }

        // Fetch payment request details
        const { data: payment, error: paymentError } = await supabase
            .from('player_payment_requests')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (paymentError || !payment) {
            return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
        }

        if (payment.status === 'Paid') {
            return NextResponse.json({ error: 'Payment request has already been paid' }, { status: 400 });
        }

        // Fetch player details
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('first_name, last_name, email')
            .eq('id', payment.player_id)
            .single();

        if (playerError || !player) {
            return NextResponse.json({ error: 'Player record not found' }, { status: 404 });
        }

        // Fetch club details to retrieve connected Stripe account
        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('name, stripe_connect_account_id, stripe_connect_onboarding_completed')
            .eq('id', payment.club_id)
            .single();

        if (clubError || !club || !club.stripe_connect_account_id) {
            return NextResponse.json({ error: 'This club has not linked their payout bank account with Stripe yet.' }, { status: 400 });
        }

        const stripe = getStripe();
        const meta = parsePaymentDescription(payment.description);
        const feeBreakdown = calculateClubFlowFee(Number(payment.amount), meta.feeCoverage);
        const origin = request.headers.get('origin') || 'https://clubflow.org.uk';

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

        // If player covers the transaction fee (standard setting), include it as a line item
        if (meta.feeCoverage === 'player') {
            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'ClubFlow Transaction Fee',
                        description: `Payment processing fee (100% of £${feeBreakdown.basePrice.toFixed(2)} base price goes to ${club.name || 'Club'})`,
                    },
                    unit_amount: feeBreakdown.transactionFeePence,
                },
                quantity: 1,
            });
        }

        // Create Stripe Checkout Session on the connected Club Stripe Account
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${origin}/pay/${paymentId}?payment=success`,
            cancel_url: `${origin}/pay/${paymentId}?payment=cancelled`,
            metadata: {
                payment_id: paymentId,
                club_id: payment.club_id,
                player_id: payment.player_id,
                base_price_pence: String(feeBreakdown.basePricePence),
                transaction_fee_pence: String(feeBreakdown.transactionFeePence),
                fee_coverage: meta.feeCoverage,
            },
            payment_intent_data: {
                // ClubFlow collects the transaction fee automatically via Stripe Connect application_fee_amount
                application_fee_amount: feeBreakdown.applicationFeePence,
            },
        }, {
            stripeAccount: club.stripe_connect_account_id,
        });

        // Save Stripe session ID to database payment request record
        await supabase
            .from('player_payment_requests')
            .update({ stripe_checkout_session_id: session.id })
            .eq('id', paymentId);

        return NextResponse.json({ url: session.url, breakdown: feeBreakdown });
    } catch (err: any) {
        console.error('Stripe Connect Checkout Session creation failed:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
