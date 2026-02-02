import { seedPlayers } from "./seed-data/players";
import { seedMatches } from "./seed-data/matches";
import { seedSettings, seedLeagueStats } from "./seed-data/settings";
import { seedFinanceUsers } from "./seed-data/finance";

export const initialData = {
    players: seedPlayers,
    "camden-united-matches-v6": seedMatches,
    "club-settings": seedSettings,
    "camden-united-league-stats": seedLeagueStats,
    "camden-finance-users": seedFinanceUsers,
    // Future keys:
    // "training-sessions": ..., 
    // "inventory-items": ...,
};
