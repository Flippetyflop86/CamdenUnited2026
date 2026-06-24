export type SubscriptionTier = "Low" | "Medium" | "High";

export interface UserSubscription {
    tier: SubscriptionTier;
    trialEndsAt: string;
    isActive: boolean;
    isPaymentConfigured: boolean;
}

const STORAGE_KEY = "clubflow_subscription_v1";

export function getSubscription(): UserSubscription {
    if (typeof window === "undefined") {
        return {
            tier: "Medium",
            trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            isActive: true,
            isPaymentConfigured: false,
        };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        // Initialize 7-day trial starting now
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        
        const defaultSub: UserSubscription = {
            tier: "Medium",
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
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        
        return {
            tier: "Medium",
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
