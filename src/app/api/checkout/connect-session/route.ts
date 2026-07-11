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
            .select('stripe_connect_account_id, stripe_connect_onboarding_completed')
            .eq('id', payment.club_id)
            .single();

        if (clubError || !club || !club.stripe_connect_account_id) {
            return NextResponse.json({ error: 'This club has not configured their Stripe Connect payments integration yet.' }, { status: 400 });
        }

        const stripe = getStripe();
        const amountInCents = Math.round(Number(payment.amount) * 100);
        const origin = request.headers.get('origin') || 'https://clubflow.org.uk';

        // Create Stripe Checkout Session on the connected Stripe Account
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: payment.description || 'Club Payment Request',
                            description: `Payment requested for player: ${player.first_name} ${player.last_name}`,
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/pay/${paymentId}?payment=success`,
            cancel_url: `${origin}/pay/${paymentId}?payment=cancelled`,
            metadata: {
                payment_id: paymentId,
                club_id: payment.club_id,
            },
            payment_intent_data: {
                // Take a 1.5% application fee on transaction
                application_fee_amount: Math.max(1, Math.round(amountInCents * 0.015)),
            },
        }, {
            stripeAccount: club.stripe_connect_account_id,
        });

        // Save Stripe session ID to database payment request record
        await supabase
            .from('player_payment_requests')
            .update({ stripe_checkout_session_id: session.id })
            .eq('id', paymentId);

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Connect Checkout Session creation failed:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
