import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Warn context if keys are missing (helpful for setup debugging)
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

const isBrowserEnv = typeof window !== 'undefined';

// Create a stateless server-side Supabase admin client for API routes
export function getServerSupabase() {
    const key = (!isBrowserEnv && process.env.SUPABASE_SERVICE_ROLE_KEY) || supabaseAnonKey || 'placeholder';
    return createClient(
        supabaseUrl || 'https://placeholder.supabase.co',
        key,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        }
    );
}

// Create the client with a non-blocking lock implementation in the browser, or stateless Service Role key on the server
const rawClient = isBrowserEnv
    ? createClient(
          supabaseUrl || 'https://placeholder.supabase.co',
          supabaseAnonKey || 'placeholder',
          {
              auth: {
                  lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
                      return await fn();
                  }
              }
          }
      )
    : getServerSupabase();

let activeClubId: string | null = null;

export function setGlobalClubId(clubId: string | null) {
    activeClubId = clubId;
}

const CLUSTERED_TABLES = [
    'players',
    'matches',
    'fixtures',
    'league_teams',
    'squad_depths',
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
    'player_payment_requests',
    'activity_logs',
    'email_history',
    'email_templates'
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

/**
 * Fetches `match_player_stats` safely for large multi-team clubs (e.g. 20 teams / 400+ players)
 * and 3,000+ user databases by:
 * 1. Chunking `playerIds` into batches of 80 UUIDs so HTTP GET URLs never exceed Cloudflare's 8KB header limit.
 * 2. Auto-paginating each chunk in 1,000-row pages (`.range(offset, offset + 999)`) so a club with
 *    thousands of historical stat rows across 20 teams never gets silently truncated at row 1,000.
 */
export async function fetchScopedMatchPlayerStats<T = any>(options?: {
    playerIds?: string[];
    columns?: string;
}): Promise<T[]> {
    const columns = options?.columns || "*";
    let targetPlayerIds = (options?.playerIds || []).filter(Boolean);

    if (!options?.playerIds) {
        const { data: clubPlayers } = await supabase.from("players").select("id").range(0, 4999);
        targetPlayerIds = (clubPlayers || []).map((p: any) => p.id).filter(Boolean);
    }

    if (targetPlayerIds.length === 0) {
        return [];
    }

    const CHUNK_SIZE = 80;
    const PAGE_SIZE = 1000;
    const chunks: string[][] = [];
    for (let i = 0; i < targetPlayerIds.length; i += CHUNK_SIZE) {
        chunks.push(targetPlayerIds.slice(i, i + CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
        chunks.map(async (chunkIds) => {
            const collected: T[] = [];
            let offset = 0;
            while (true) {
                const { data, error } = await supabase
                    .from("match_player_stats")
                    .select(columns)
                    .in("player_id", chunkIds)
                    .range(offset, offset + PAGE_SIZE - 1);

                if (error || !data || data.length === 0) {
                    break;
                }
                collected.push(...(data as T[]));
                if (data.length < PAGE_SIZE) {
                    break;
                }
                offset += PAGE_SIZE;
            }
            return collected;
        })
    );

    return chunkResults.flat();
}

