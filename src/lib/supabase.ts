import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Warn context if keys are missing (helpful for setup debugging)
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

// Create the client
const rawClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
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
    'club_payments'
];

// Helper to determine if we are in browser context
const isBrowser = typeof window !== 'undefined';

const proxiedFrom = new Proxy(rawClient.from, {
    apply(target, thisArg, argArray) {
        const relation = argArray[0] as string;
        const builder = Reflect.apply(target, thisArg, argArray);

        // Only apply proxy scoping in browser context and when activeClubId is set
        if (!isBrowser || !activeClubId) {
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
                                ? nextBuilder.eq('club_id', activeClubId) 
                                : nextBuilder.eq('id', activeClubId);
                        }

                        if (prop === 'update') {
                            const nextBuilder = value.apply(targetBuilder, args);
                            return isClustered 
                                ? nextBuilder.eq('club_id', activeClubId) 
                                : nextBuilder.eq('id', activeClubId);
                        }

                        if (prop === 'delete') {
                            const nextBuilder = value.apply(targetBuilder, args);
                            return isClustered 
                                ? nextBuilder.eq('club_id', activeClubId) 
                                : nextBuilder.eq('id', activeClubId);
                        }

                        if (prop === 'insert' || prop === 'upsert') {
                            let data = args[0];
                            if (data) {
                                const key = isClustered ? 'club_id' : 'id';
                                if (Array.isArray(data)) {
                                    data = data.map(item => ({
                                        ...item,
                                        [key]: activeClubId
                                    }));
                                } else if (typeof data === 'object') {
                                    data = {
                                        ...data,
                                        [key]: activeClubId
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
rawClient.from = proxiedFrom;

export const supabase = rawClient;
