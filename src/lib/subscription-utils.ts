export type SubscriptionTier = "Low" | "Medium" | "High";

export interface UserSubscription {
    tier: SubscriptionTier;
    trialEndsAt: string;
    isActive: boolean;
    isPaymentConfigured: boolean;
}

export const TRIAL_DURATION_DAYS = 30;
const STORAGE_KEY = "clubflow_subscription_v2";

export function getSubscription(): UserSubscription {
    if (typeof window === "undefined") {
        return {
            tier: "High",
            trialEndsAt: new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            isActive: true,
            isPaymentConfigured: false,
        };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        // Initialize 30-day full-access free trial starting now (no card required upfront)
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
        
        const defaultSub: UserSubscription = {
            tier: "High",
            trialEndsAt: trialEndDate.toISOString(),
            isActive: true,
            isPaymentConfigured: false,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSub));
        return defaultSub;
    }

    try {
        const sub: UserSubscription = JSON.parse(stored);
        
        // Calculate if trial is still active
        const trialEndDate = new Date(sub.trialEndsAt);
        const now = new Date();
        const isTrialActive = now < trialEndDate;

        // Active if payment details configured OR trial is still active
        const isActive = sub.isPaymentConfigured || isTrialActive;

        return {
            ...sub,
            isActive
        };
    } catch {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
        
        return {
            tier: "High",
            trialEndsAt: trialEndDate.toISOString(),
            isActive: true,
            isPaymentConfigured: false,
        };
    }
}

export function saveSubscription(sub: UserSubscription) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sub));
    // Trigger custom event so sidebar updates instantly
    window.dispatchEvent(new Event("subscription-changed"));
}
