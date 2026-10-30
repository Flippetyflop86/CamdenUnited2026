import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
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
        const { paymentId, clubId } = await request.json();

        // 1) Verify whether a club's Stripe Connect account has finished onboarding
        if (clubId && !paymentId) {
            const { data: club } = await supabase
                .from('clubs')
                .select('id, stripe_connect_account_id, stripe_connect_onboarding_completed')
                .eq('id', clubId)
                .single();

            if (!club || !club.stripe_connect_account_id) {
                return NextResponse.json({ connected: false, onboardingComplete: false });
            }

            try {
                const stripe = getStripe();
                const acct = await stripe.accounts.retrieve(club.stripe_connect_account_id);
                const isReady = Boolean(acct.charges_enabled || acct.details_submitted);
                if (isReady && !club.stripe_connect_onboarding_completed) {
                    await supabase
                        .from('clubs')
                        .update({ stripe_connect_onboarding_completed: true })
                        .eq('id', club.id);
                }
                return NextResponse.json({
                    connected: true,
                    onboardingComplete: isReady || Boolean(club.stripe_connect_onboarding_completed),
                    accountId: club.stripe_connect_account_id,
                });
            } catch {
                return NextResponse.json({
                    connected: true,
                    onboardingComplete: Boolean(club.stripe_connect_onboarding_completed),
                    accountId: club.stripe_connect_account_id,
                });
            }
        }

        // 2) Verify a specific payment request's Stripe Checkout Session status
        if (!paymentId) {
            return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
        }

        const { data: payment } = await supabase
            .from('player_payment_requests')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (!payment) {
            return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
        }

        if (payment.status === 'Paid') {
            return NextResponse.json({ status: 'Paid', paid_at: payment.paid_at });
        }

        if (!payment.stripe_checkout_session_id) {
            return NextResponse.json({ status: payment.status });
        }

        const { data: club } = await supabase
            .from('clubs')
            .select('stripe_connect_account_id')
            .eq('id', payment.club_id)
            .single();

        if (!club?.stripe_connect_account_id) {
            return NextResponse.json({ status: payment.status });
        }

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(
            payment.stripe_checkout_session_id,
            {},
            { stripeAccount: club.stripe_connect_account_id }
        );

        if (session.payment_status === 'paid') {
            const paidAt = new Date().toISOString();
            const { data: updatedPayment } = await supabase
                .from('player_payment_requests')
                .update({ status: 'Paid', paid_at: paidAt })
                .eq('id', paymentId)
                .neq('status', 'Paid')
                .select()
                .maybeSingle();

            if (updatedPayment) {
                await supabase
                    .from('finance_transactions')
                    .insert([{
                        club_id: updatedPayment.club_id,
                        date: paidAt.split('T')[0],
                        description: `${updatedPayment.description} (Paid via Stripe)`,
                        amount: Number(updatedPayment.amount),
                        type: 'Income',
                        category: 'Player Fees',
                    }]);
            }

            return NextResponse.json({ status: 'Paid', paid_at: paidAt });
        }

        return NextResponse.json({ status: payment.status, stripeStatus: session.payment_status });
    } catch (err: any) {
        console.error('Error verifying Stripe payment status:', err);
        return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
