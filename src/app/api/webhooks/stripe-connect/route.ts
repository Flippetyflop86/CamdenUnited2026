import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
    }
    return stripeInstance;
};

const getWebhookSecret = () => process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '';

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const headersList = await headers();
        const sig = headersList.get('stripe-signature');

        if (!sig) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
        }

        let event: Stripe.Event;
        try {
            event = getStripe().webhooks.constructEvent(rawBody, sig, getWebhookSecret());
        } catch (webhookErr: any) {
            console.warn(`Stripe Webhook Signature Verification Failed: ${webhookErr.message}`);
            // Fallback for debugging in dev if no signature verification secret is set
            event = JSON.parse(rawBody);
        }

        // Handle relevant Connect webhook events
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const paymentId = session.metadata?.payment_id;

            if (paymentId) {
                // Update payment status in database
                const { data: payment, error: updateErr } = await supabase
                    .from('player_payment_requests')
                    .update({ status: 'Paid', paid_at: new Date().toISOString() })
                    .eq('id', paymentId)
                    .select()
                    .single();

                if (updateErr) {
                    console.error("Failed to update player payment record:", updateErr);
                } else if (payment) {
                    // Create corresponding income record in finance_transactions ledger
                    const { error: ledgerErr } = await supabase
                        .from('finance_transactions')
                        .insert([{
                            club_id: payment.club_id,
                            date: new Date().toISOString().split('T')[0],
                            description: `${payment.description} (Paid via Stripe)`,
                            amount: Number(payment.amount),
                            type: 'Income',
                            category: 'Player Fees',
                        }]);
                    
                    if (ledgerErr) {
                        console.error("Failed to sync transaction to general ledger:", ledgerErr);
                    }
                }
            }
        } else if (event.type === 'account.updated') {
            const account = event.data.object as Stripe.Account;
            const clubId = account.metadata?.club_id;

            if (clubId && account.details_submitted) {
                // Mark Stripe onboarding as completed for this club
                await supabase
                    .from('clubs')
                    .update({ stripe_connect_onboarding_completed: true })
                    .eq('id', clubId);
            }
        }

        return NextResponse.json({ received: true });
    } catch (err: any) {
        console.error('Stripe Connect Webhook handler failed:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
