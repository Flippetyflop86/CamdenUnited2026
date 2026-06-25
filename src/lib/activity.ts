import { supabase } from "@/lib/supabase";

/**
 * Logs a user action to the activity_logs table for audit tracking.
 * Automatically resolves the active user and club context.
 */
export async function logActivity(action: string, details?: string) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) return;

        // Query the club membership to resolve club scope
        const { data: member } = await supabase
            .from("club_members")
            .select("club_id, display_name")
            .eq("user_id", session.user.id)
            .maybeSingle();

        if (!member) return;

        await supabase.from("activity_logs").insert([{
            club_id: member.club_id,
            user_id: session.user.id,
            user_email: session.user.email || "unknown",
            user_name: member.display_name || session.user.user_metadata?.full_name || "Unknown User",
            action,
            details: details || ""
        }]);
    } catch (e) {
        console.warn("Failed to write to activity_logs:", e);
    }
}
