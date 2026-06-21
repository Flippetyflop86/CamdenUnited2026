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
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify the user token with Supabase
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch the user's club membership and their email
        const { data: member, error: memberError } = await supabase
            .from('club_members')
            .select('club_id, display_name, email')
            .eq('user_id', user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: 'Could not retrieve club membership details' }, { status: 404 });
        }

        // Get the monthly subscription price from the clubs table
        const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('name, monthly_subs')
            .eq('id', member.club_id)
            .single();

        if (clubError || !club) {
            return NextResponse.json({ error: 'Could not retrieve club settings' }, { status: 404 });
        }

        // Convert monthly subscription to cents (Stripe expects unit amount in cents)
        const amountInCents = Math.round((club.monthly_subs || 0) * 100);
        if (amountInCents <= 0) {
            return NextResponse.json({ error: 'Monthly subscription fee is not configured or is £0' }, { status: 400 });
        }

        // Create Stripe Checkout Session for subscription
        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: `${club.name} Monthly Membership`,
                            description: `Monthly subscription fee for ${member.display_name || user.email || 'Club Member'}`,
                        },
                        unit_amount: amountInCents,
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${request.headers.get('origin')}/dashboard/billing?payment=success`,
            cancel_url: `${request.headers.get('origin')}/dashboard/billing?payment=cancelled`,
            metadata: {
                user_id: user.id,
                club_id: member.club_id,
            },
            customer_email: member.email || user.email || undefined,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
