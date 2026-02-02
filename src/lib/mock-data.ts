import { Player, TrainingSession, Match } from "@/types";
import { initialData } from "./initial-data";

export const mockTrainingSessions: TrainingSession[] = [
    {
        id: "session-1",
        date: "2024-03-25",
        time: "19:00",
        location: "Training Ground Pitch 1",
        topic: "Defensive Shape & Pressing",
        squad: "firstTeam",
        attendance: []
    },
    {
        id: "session-2",
        date: "2024-03-27",
        time: "19:00",
        location: "Training Ground Pitch 1",
        topic: "Attacking Transitions",
        squad: "firstTeam",
        attendance: []
    }
];

export const mockMatches = (initialData["camden-united-matches-v6"] as unknown as Match[]) || [];

export const mockPlayers = (initialData.players as unknown as Player[]) || [];
