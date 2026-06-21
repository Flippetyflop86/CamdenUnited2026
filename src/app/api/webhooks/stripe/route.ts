import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
    }
    return stripeInstance;
};

const getWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || '';

// Initialize server-side Supabase client with Service Role Key to bypass RLS policies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const getServiceSupabase = () => {
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });
};

export async function POST(request: Request) {
    try {
        const sig = request.headers.get('stripe-signature');
        if (!sig) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
        }

        const rawBody = await request.text();
        let event: Stripe.Event;

        try {
            event = getStripe().webhooks.constructEvent(rawBody, sig, getWebhookSecret());
        } catch (err: any) {
            console.error('Webhook signature verification failed:', err.message);
            return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
        }

        const supabaseAdmin = getServiceSupabase();

        // Handle relevant Stripe webhook events
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const metadata = session.metadata;

                if (metadata && metadata.user_id && metadata.club_id) {
                    const userId = metadata.user_id;
                    const clubId = metadata.club_id;
                    const amount = session.amount_total ? session.amount_total / 100 : 0;
                    
                    // Log payment into club_payments table
                    const { error: paymentError } = await supabaseAdmin
                        .from('club_payments')
                        .insert([{
                            club_id: clubId,
                            user_id: userId,
                            stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
                            stripe_session_id: session.id,
                            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
                            amount: amount,
                            status: 'paid'
                        }]);

                    if (paymentError) {
                        console.error('Error saving payment log:', paymentError.message);
                        throw paymentError;
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                
                // Set status to cancelled
                const { error: cancelError } = await supabaseAdmin
                    .from('club_payments')
                    .update({ status: 'cancelled' })
                    .eq('stripe_subscription_id', subscription.id);

                if (cancelError) {
                    console.error('Error updating cancelled subscription:', cancelError.message);
                    throw cancelError;
                }
                break;
            }

            default:
                // Event type not handled, return OK
                break;
        }

        return NextResponse.json({ received: true });
    } catch (err: any) {
        console.error('Stripe Webhook Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
