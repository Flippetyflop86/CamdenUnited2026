import { WatcherHalfStats, WatcherTeamStats } from "@/types";

export const calculateDominance = (stats: WatcherHalfStats) => {
    return (stats.deliveries * 1) +
        (stats.halfChances * 2) +
        (stats.chances * 3) +
        (stats.massiveChancesNoShot * 4) +
        (stats.massiveChancesShot * 5);
};

export const calculateTotals = (teamStats: WatcherTeamStats): WatcherHalfStats => {
    return {
        deliveries: teamStats.firstHalf.deliveries + teamStats.secondHalf.deliveries,
        halfChances: teamStats.firstHalf.halfChances + teamStats.secondHalf.halfChances,
        chances: teamStats.firstHalf.chances + teamStats.secondHalf.chances,
        massiveChancesNoShot: teamStats.firstHalf.massiveChancesNoShot + teamStats.secondHalf.massiveChancesNoShot,
        massiveChancesShot: teamStats.firstHalf.massiveChancesShot + teamStats.secondHalf.massiveChancesShot,
        goals: teamStats.firstHalf.goals + teamStats.secondHalf.goals,
    };
};
