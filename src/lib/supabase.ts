import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Warn context if keys are missing (helpful for setup debugging)
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

// Create the client with a non-blocking lock implementation to prevent browser navigator.locks AbortErrors and deadlocks
const rawClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        auth: {
            lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
                return await fn();
            }
        }
    }
);

let activeClubId: string | null = null;

export function setGlobalClubId(clubId: string | null) {
    activeClubId = clubId;
}

const CLUSTERED_TABLES = [
    'players',
    'matches',
    'training_sessions',
    'finance_transactions',
    'sponsors',
    'subscriptions',
    'inventory_items',
    'documents',
    'watcher_stats',
    'opposition_teams',
    'matchday_xis',
    'recruits',
    'staff',
    'club_members',
    'club_invitations',
    'app_users',
    'club_payments',
    'player_payment_requests'
];

// Helper to determine if we are in browser context
const isBrowser = typeof window !== 'undefined';

function getEffectiveClubId(): string | null {
    if (activeClubId) return activeClubId;
    if (isBrowser) {
        try {
            const cached = localStorage.getItem('clubflow_cache_clubId');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) {
                    activeClubId = parsed;
                    return parsed;
                }
            }
        } catch {}
    }
    return null;
}

const proxiedFrom = new Proxy(rawClient.from, {
    apply(target, thisArg, argArray) {
        const relation = argArray[0] as string;
        const builder = Reflect.apply(target, thisArg, argArray);
        const currentClubId = getEffectiveClubId();

        // Only apply proxy scoping in browser context and when currentClubId is set
        if (!isBrowser || !currentClubId) {
            return builder;
        }

        const isClustered = CLUSTERED_TABLES.includes(relation);
        const isClubs = relation === 'clubs';

        if (!isClustered && !isClubs) {
            return builder;
        }

        return new Proxy(builder, {
            get(targetBuilder, prop) {
                const value = Reflect.get(targetBuilder, prop);

                if (typeof value === 'function') {
                    return function (...args: any[]) {
                        if (prop === 'select') {
                            const nextBuilder = value.apply(targetBuilder, args);
                            return isClustered 
                                ? nextBuilder.eq('club_id', currentClubId) 
                                : nextBuilder.eq('id', currentClubId);
                        }

                        if (prop === 'update') {
                            const nextBuilder = value.apply(targetBuilder, args);
                            return isClustered 
                                ? nextBuilder.eq('club_id', currentClubId) 
                                : nextBuilder.eq('id', currentClubId);
                        }

                        if (prop === 'delete') {
                            const nextBuilder = value.apply(targetBuilder, args);
                            return isClustered 
                                ? nextBuilder.eq('club_id', currentClubId) 
                                : nextBuilder.eq('id', currentClubId);
                        }

                        if (prop === 'insert' || prop === 'upsert') {
                            let data = args[0];
                            if (data) {
                                const key = isClustered ? 'club_id' : 'id';
                                if (Array.isArray(data)) {
                                    data = data.map(item => ({
                                        ...item,
                                        [key]: currentClubId
                                    }));
                                } else if (typeof data === 'object') {
                                    data = {
                                        ...data,
                                        [key]: currentClubId
                                    };
                                }
                                args[0] = data;
                            }
                            return value.apply(targetBuilder, args);
                        }

                        return value.apply(targetBuilder, args);
                    };
                }

                return value;
            }
        });
    }
});

// Overwrite the client's from method with our proxy wrapper
const originalFrom = rawClient.from.bind(rawClient);
rawClient.from = proxiedFrom as any;

export const supabase = rawClient;
export const unproxiedSupabase = {
    ...rawClient,
    from: originalFrom
} as typeof rawClient;
