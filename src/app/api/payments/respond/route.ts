import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { parsePaymentDescription, updatePaymentDescriptionTags } from "@/lib/clubflow-pay";

export async function POST(request: Request) {
    const supabase = getServerSupabase();
    try {
        const body = await request.json();
        const { paymentId, action } = body as {
            paymentId?: string;
            action?: "decline" | "reopen";
        };

        if (!paymentId || (action !== "decline" && action !== "reopen")) {
            return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
        }

        const { data: payment, error: payErr } = await supabase
            .from("player_payment_requests")
            .select("*")
            .eq("id", paymentId)
            .single();

        if (payErr || !payment) {
            return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
        }

        if (payment.status === "Paid") {
            return NextResponse.json({ error: "Payment has already been paid" }, { status: 400 });
        }

        const meta = parsePaymentDescription(payment.description);
        if (meta.requirement !== "optional") {
            return NextResponse.json(
                { error: "Only optional payments can be declined." },
                { status: 400 }
            );
        }

        if (action === "decline") {
            const nextDescription = updatePaymentDescriptionTags(payment.description, {
                declined: true,
            });
            const { data: updated, error: updateErr } = await supabase
                .from("player_payment_requests")
                .update({
                    status: "Void",
                    description: nextDescription,
                })
                .eq("id", paymentId)
                .select()
                .single();

            if (updateErr) throw updateErr;
            return NextResponse.json({ success: true, payment: updated });
        } else {
            const nextDescription = updatePaymentDescriptionTags(payment.description, {
                declined: false,
            });
            const { data: updated, error: updateErr } = await supabase
                .from("player_payment_requests")
                .update({
                    status: "Unpaid",
                    description: nextDescription,
                })
                .eq("id", paymentId)
                .select()
                .single();

            if (updateErr) throw updateErr;
            return NextResponse.json({ success: true, payment: updated });
        }
    } catch (err: any) {
        console.error("Failed to update optional payment response:", err);
        return NextResponse.json(
            { error: err.message || "Could not update payment status" },
            { status: 500 }
        );
    }
}
