export type Position = "GK" | "DEF" | "MID" | "FWD" | "CB" | "RB" | "LB" | "CM" | "CDM" | "CAM" | "RW" | "LW" | "CF";

export type SquadType = string;

export type MedicalStatus = "Available" | "Unavailable" | "Holiday" | "Injured" | "Doubtful" | "Suspended";

export interface Player {
    id: string;
    firstName: string;
    lastName: string;
    position: Position;
    squadNumber: number;

    age: number;
    dateOfBirth?: string; // YYYY-MM-DD
    nationality: string;
    squad: SquadType;
    medicalStatus: MedicalStatus;
    medicalNotes?: string;
    contractExpiry: string; // YYYY-MM-DD
    availability: boolean; // General availability flag
    // Stats summary for cards
    appearances: number;
    goals: number;
    assists: number;
    yellow_cards?: number;
    red_cards?: number;
    imageUrl?: string;
    notes?: string;
    isInTrainingSquad?: boolean;

    // Contract Info
    isContracted?: boolean;
    contractAmount?: number;
    contractFrequency?: "Weekly" | "Monthly";
    contractStartDate?: string;
    contractEndDate?: string;
}

export interface Staff {
    id: string;
    name: string;
    role: "Coach" | "Physio" | "Admin";
    email: string;

    // Contract Info
    isContracted?: boolean;
    contractAmount?: number;
    contractFrequency?: "Weekly" | "Monthly";
    contractStartDate?: string;
    contractEndDate?: string;
}

export type AttendanceStatus = "Present" | "Late" | "Absent" | "Injured" | "Excuse";

export interface AttendanceRecord {
    playerId: string;
    status: AttendanceStatus;
    notes?: string;
}

export interface TrainingSession {
    id: string;
    date: string; // ISO Date string
    time: string;
    location: string;
    topic?: string;
    squad: string;
    attendance: AttendanceRecord[];
    notes?: string;
}

export interface Match {
    id: string;
    date: string;
    time: string;
    opponent: string;
    isHome: boolean;
    competition: string;
    scoreline?: string;
    goalscorers?: string;
    assists?: string;
    yellow_cards?: string;
    red_cards?: string;
    result?: "Win" | "Loss" | "Draw" | "Pending";
    notes?: string;
    surface?: "4G" | "Grass";
    location?: string;
}

export interface OppositionTeam {
    id: string;
    name: string;
    formation: string;
    notes: string;
    lineup?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface MatchdayXI {
    id: string;
    formation: string;
    starters: {
        [key: string]: string; // position index -> playerId
    };
    substitutes: string[]; // array of playerIds
    createdAt: string;
    updatedAt: string;
}

export interface Recruit {
    id: string;
    name: string;
    primaryPosition: string;
    secondaryPosition: string;
    age: number;
    location: string;
    status: 'Attached' | 'Unattached';
    currentClub?: string;
    onTrial: boolean;
    scoutedRole: 'Star Player' | '1st Team Player' | 'Rotation Player' | 'Back-up' | 'Prospect';
    notes: string;
    clubConnection?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BrandingSettings {
    name: string;
    logo: string | null;
    primaryColor: string;
}

export interface WatcherHalfStats {
    deliveries: number;
    halfChances: number;
    chances: number;
    massiveChancesNoShot: number;
    massiveChancesShot: number;
    goals: number;
}

export interface WatcherTeamStats {
    firstHalf: WatcherHalfStats;
    secondHalf: WatcherHalfStats;
}

export interface WatcherMatchStats {
    id: string;
    matchId: string; // Links to Match.id
    us: WatcherTeamStats;
    opposition: WatcherTeamStats;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Sponsor {
    id: string;
    name: string;
    amount: number;
    frequency: 'One-off' | 'Monthly' | 'Yearly';
    description?: string;
    website?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string; // Stored as a newline-separated string or JSON string
    status?: 'Secured' | 'Lead' | 'Contacted' | 'Proposal' | 'Review';
    contractUrl?: string;
    contractName?: string;
    exposureStats?: { impressions: number; matches: number; clicks: number };
}

export interface Subscription {
    id: string;
    name: string;
    cost: number;
    frequency: 'Monthly' | 'Yearly';
    nextPaymentDate?: string;
    category: 'Software' | 'League' | 'Insurance' | 'Other';
}

export interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'Income' | 'Expense';
    category: 'Match Fee' | 'Sponsorship' | 'Market Road Pitch Hire' | 'MCFL Pitch Hire' | 'Officials' | 'Yellow Card Fine' | 'Red Card Fine' | 'Misconduct Fine' | 'Admin Fine' | 'Kit' | 'Public Liability Insurance' | 'Food' | 'Training Pitch Fees' | 'Loans' | 'Government Grants' | 'College Programme' | 'Other';
    isRecurring: boolean;
    frequency?: 'Weekly' | 'Monthly' | 'Yearly';
}

export interface ClubDocument {
    id: string;
    name: string;
    type: 'Link' | 'File' | 'PDF' | 'Word';
    url: string; // URL or File path (simulated)
    category: 'General' | 'League' | 'Insurance' | 'Training' | 'Matchday' | 'Registration Form';
    createdAt: string;
}

export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    category: 'Kit' | 'Equipment' | 'Medical' | 'Technology' | 'Other';
    status: 'Good' | 'Damaged' | 'Lost' | 'In Use';
    assignedTo?: string; // Name of person holding the item
    notes?: string;
    lastUpdated: string;
}
