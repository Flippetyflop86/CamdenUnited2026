import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { parsePaymentDescription } from '@/lib/clubflow-pay';
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
        const { paymentId, paymentIds, clubId } = body;

        // 1) Verify whether a club's Stripe Connect account has finished onboarding
        if (clubId && !paymentId && !paymentIds) {
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

        // 2) Verify one or multiple payment requests' Stripe Checkout Session status
        const targetIds: string[] = Array.isArray(paymentIds)
            ? paymentIds.map((x: any) => String(x)).filter(Boolean)
            : typeof paymentIds === 'string'
            ? paymentIds.split(',').map((x: string) => x.trim()).filter(Boolean)
            : paymentId
            ? [String(paymentId)]
            : [];

        if (targetIds.length === 0) {
            return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
        }

        const { data: payments } = await supabase
            .from('player_payment_requests')
            .select('*')
            .in('id', targetIds);

        if (!payments || payments.length === 0) {
            return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
        }

        const primaryPayment = payments[0];
        if (payments.every(p => p.status === 'Paid')) {
            return NextResponse.json({ status: 'Paid', paid_at: primaryPayment.paid_at });
        }

        const sessionId = payments.find(p => p.stripe_checkout_session_id)?.stripe_checkout_session_id;
        if (!sessionId) {
            return NextResponse.json({ status: primaryPayment.status });
        }

        const { data: club } = await supabase
            .from('clubs')
            .select('stripe_connect_account_id')
            .eq('id', primaryPayment.club_id)
            .single();

        if (!club?.stripe_connect_account_id) {
            return NextResponse.json({ status: primaryPayment.status });
        }

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(
            sessionId,
            {},
            { stripeAccount: club.stripe_connect_account_id }
        );

        if (session.payment_status === 'paid') {
            const paidAt = new Date().toISOString();
            const { data: updatedPayments } = await supabase
                .from('player_payment_requests')
                .update({ status: 'Paid', paid_at: paidAt })
                .in('id', targetIds)
                .neq('status', 'Paid')
                .select();

            if (updatedPayments && updatedPayments.length > 0) {
                const txRows = updatedPayments.map(up => {
                    const meta = parsePaymentDescription(up.description);
                    return {
                        club_id: up.club_id,
                        date: paidAt.split('T')[0],
                        description: `${meta.cleanDescription} (Paid via Stripe)`,
                        amount: Number(up.amount),
                        type: 'Income',
                        category: 'Player Fees',
                    };
                });
                await supabase.from('finance_transactions').insert(txRows);
            }

            return NextResponse.json({ status: 'Paid', paid_at: paidAt, count: targetIds.length });
        }

        return NextResponse.json({ status: primaryPayment.status, stripeStatus: session.payment_status });
    } catch (err: any) {
        console.error('Error verifying Stripe payment status:', err);
        return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
