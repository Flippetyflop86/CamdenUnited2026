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

// Spond-style ClubFlow Platform Service & Processing Fee:
// Passed on to the paying player so the club receives 100% of the fine/fee amount,
// and ClubFlow earns the markup via Stripe Connect's application_fee_amount.
export function calculatePlatformFeeBreakdown(baseAmountPounds: number) {
    const base = Math.max(0, Number(baseAmountPounds) || 0);
    // 3.9% + £0.25 service & processing fee (minimum £0.35 on any transaction)
    const rawFee = base * 0.039 + 0.25;
    const serviceFee = Math.round(Math.max(0.35, rawFee) * 100) / 100;
    const totalPayable = Math.round((base + serviceFee) * 100) / 100;
    return {
        baseAmount: base,
        serviceFee,
        totalPayable,
        baseAmountPence: Math.round(base * 100),
        serviceFeePence: Math.round(serviceFee * 100),
        totalPayablePence: Math.round(totalPayable * 100),
    };
}

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
        const feeBreakdown = calculatePlatformFeeBreakdown(Number(payment.amount));
        const origin = request.headers.get('origin') || 'https://clubflow.org.uk';

        // Create Stripe Checkout Session on the connected Stripe Account:
        // Line item 1: Club Fine / Fee (100% goes to the club)
        // Line item 2: ClubFlow Service & Processing Fee (routed to ClubFlow via application_fee_amount)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: payment.description || 'Club Fine / Payment Request',
                            description: `Player: ${player.first_name} ${player.last_name}`,
                        },
                        unit_amount: feeBreakdown.baseAmountPence,
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'Service & Processing Fee',
                            description: 'Instant payment processing & platform fee (Club receives 100% of fine)',
                        },
                        unit_amount: feeBreakdown.serviceFeePence,
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
                base_amount_pence: String(feeBreakdown.baseAmountPence),
                service_fee_pence: String(feeBreakdown.serviceFeePence),
            },
            payment_intent_data: {
                // Route the Spond-style service fee markup to ClubFlow's platform account
                application_fee_amount: feeBreakdown.serviceFeePence,
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
