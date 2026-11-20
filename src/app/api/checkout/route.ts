import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import Stripe from "stripe";

type BillingTier = "Low" | "Medium" | "High";

const TIER_PRICE_PENCE: Record<BillingTier, number> = {
    Low: 499,
    Medium: 999,
    High: 1999,
};

const TIER_LABELS: Record<BillingTier, string> = {
    Low: "ClubFlow Grassroots Plan",
    Medium: "ClubFlow Pro Club Plan",
    High: "ClubFlow Elite Academy Plan",
};

function inferTierFromAmount(amountGbp: number): BillingTier {
    if (amountGbp >= 19) return "High";
    if (amountGbp >= 9) return "Medium";
    return "Low";
}

function isRealStripeKeyConfigured(): boolean {
    const k = process.env.STRIPE_SECRET_KEY || "";
    return Boolean(k && !k.includes("placeholder"));
}

let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
    }
    return stripeInstance;
};

async function resolveAuthenticatedClubMember(request: Request, supabase: ReturnType<typeof getServerSupabase>) {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) return { error: "Unauthorized", status: 401 as const };

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return { error: "Unauthorized", status: 401 as const };

    const { data: member } = await supabase
        .from("club_members")
        .select("club_id, role, display_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!member?.club_id) {
        return { error: "Club membership not found", status: 404 as const };
    }

    return { user, member };
}

export async function GET(request: Request) {
    const supabase = getServerSupabase();
    try {
        const auth = await resolveAuthenticatedClubMember(request, supabase);
        if ("error" in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { user, member } = auth;
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("session_id");

        // Verify returned Stripe Checkout session immediately if provided
        if (sessionId && isRealStripeKeyConfigured()) {
            try {
                const session = await getStripe().checkout.sessions.retrieve(sessionId);
                if (
                    session.payment_status === "paid" &&
                    session.metadata?.club_id === member.club_id
                ) {
                    const { data: existing } = await supabase
                        .from("club_payments")
                        .select("id")
                        .eq("stripe_session_id", session.id)
                        .maybeSingle();

                    if (!existing) {
                        const amountGbp = session.amount_total ? session.amount_total / 100 : 9.99;
                        await supabase.from("club_payments").insert([
                            {
                                club_id: member.club_id,
                                user_id: user.id,
                                stripe_customer_id:
                                    typeof session.customer === "string" ? session.customer : null,
                                stripe_session_id: session.id,
                                stripe_subscription_id:
                                    typeof session.subscription === "string"
                                        ? session.subscription
                                        : null,
                                amount: amountGbp,
                                status: "paid",
                            },
                        ]);
                    }
                }
            } catch (verifyErr) {
                console.warn("Could not verify Stripe billing session:", verifyErr);
            }
        }

        const [{ data: club }, { data: payments }] = await Promise.all([
            supabase
                .from("clubs")
                .select("id, name, created_at")
                .eq("id", member.club_id)
                .maybeSingle(),
            supabase
                .from("club_payments")
                .select("id, amount, status, created_at, stripe_subscription_id, stripe_session_id")
                .eq("club_id", member.club_id)
                .order("created_at", { ascending: false })
                .limit(25),
        ]);

        const clubCreatedMs = club?.created_at ? new Date(club.created_at).getTime() : Date.now();
        const trialEndsAt = new Date(clubCreatedMs + 30 * 24 * 60 * 60 * 1000).toISOString();

        const historyRows = (payments || []).map((p: any) => ({
            id: p.stripe_session_id
                ? String(p.stripe_session_id).slice(-10).toUpperCase()
                : String(p.id).slice(0, 8).toUpperCase(),
            amount: Number(p.amount || 0),
            status: p.status || "paid",
            created_at: p.created_at,
            tier: inferTierFromAmount(Number(p.amount || 0)),
        }));

        const latestPayment = (payments || [])[0];
        const isPaidActive = Boolean(latestPayment && latestPayment.status === "paid");
        const activeTier: BillingTier = isPaidActive
            ? inferTierFromAmount(Number(latestPayment.amount || 9.99))
            : "Medium";

        return NextResponse.json({
            isPaymentConfigured: isPaidActive,
            tier: activeTier,
            trialEndsAt,
            history: historyRows,
            stripeConfigured: isRealStripeKeyConfigured(),
        });
    } catch (err: any) {
        console.error("Billing status error:", err);
        return NextResponse.json(
            { error: err.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const supabase = getServerSupabase();
    try {
        const auth = await resolveAuthenticatedClubMember(request, supabase);
        if ("error" in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (!isRealStripeKeyConfigured()) {
            return NextResponse.json(
                {
                    error: "Stripe subscription billing is not yet configured on the server (STRIPE_SECRET_KEY missing).",
                },
                { status: 400 }
            );
        }

        const { user, member } = auth;
        const body = await request.json().catch(() => ({}));
        const requestedTier = (body?.tier as BillingTier) || "Medium";
        const validTier: BillingTier =
            requestedTier === "Low" || requestedTier === "Medium" || requestedTier === "High"
                ? requestedTier
                : "Medium";

        const { data: club } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", member.club_id)
            .maybeSingle();

        const origin =
            request.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "https://www.clubflow.org.uk";

        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "gbp",
                        product_data: {
                            name: TIER_LABELS[validTier],
                            description: `${club?.name || "Football Club"} — Monthly ClubFlow SaaS Subscription`,
                        },
                        unit_amount: TIER_PRICE_PENCE[validTier],
                        recurring: {
                            interval: "month",
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${origin}/dashboard/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/dashboard/billing?payment=cancelled`,
            metadata: {
                user_id: user.id,
                club_id: member.club_id,
                tier: validTier,
            },
            customer_email: member.email || user.email || undefined,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("Stripe Checkout Error:", err);
        return NextResponse.json(
            { error: err.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    const supabase = getServerSupabase();
    try {
        const auth = await resolveAuthenticatedClubMember(request, supabase);
        if ("error" in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { member } = auth;
        const roleClean = (member.role || "").toLowerCase();
        if (roleClean !== "manager" && roleClean !== "super admin" && roleClean !== "treasurer") {
            return NextResponse.json(
                { error: "Forbidden: Only a Club Manager or Treasurer can cancel billing" },
                { status: 403 }
            );
        }

        const { data: activeRows } = await supabase
            .from("club_payments")
            .select("id, stripe_subscription_id")
            .eq("club_id", member.club_id)
            .eq("status", "paid")
            .order("created_at", { ascending: false });

        if (activeRows && activeRows.length > 0) {
            for (const row of activeRows) {
                if (row.stripe_subscription_id && isRealStripeKeyConfigured()) {
                    try {
                        await getStripe().subscriptions.cancel(row.stripe_subscription_id);
                    } catch (stripeErr) {
                        console.warn("Stripe subscription cancel warning:", stripeErr);
                    }
                }
            }

            await supabase
                .from("club_payments")
                .update({ status: "cancelled" })
                .eq("club_id", member.club_id)
                .eq("status", "paid");
        }

        return NextResponse.json({ cancelled: true });
    } catch (err: any) {
        console.error("Cancel subscription error:", err);
        return NextResponse.json(
            { error: err.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
