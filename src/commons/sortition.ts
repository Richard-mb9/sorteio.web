export type PlayerGender = "M" | "F";
export type DrawStatus = "ATIVO" | "LIMPO";
export type RestorationStatus = "success" | "empty" | "read-error" | "invalid-result";

export const MIN_PLAYER_NOTA = 0;
export const MAX_PLAYER_NOTA = 10;
export const DEFAULT_PLAYER_NOTA = 0;
export const DEFAULT_MAX_CONSECUTIVE_WINS = 2;

export interface IPlayer {
    id: string;
    name: string;
    normalizedName: string;
    gender: PlayerGender;
    nota: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface IDrawConfiguration {
    id: string;
    playersPerTeam: number | null;
    maxConsecutiveWins: number;
    doubleExitOnMaxWins: boolean;
    rotationRandomnessEnabled: boolean;
    updatedAt: string;
}

export interface IAllocatedPlayer {
    allocationId: string;
    playerId: string;
    playerName: string;
    normalizedName: string;
    gender: PlayerGender;
    nota: number;
    positionInTeam: number;
}

export interface IManualSwapImpact {
    resultId: string;
    teamAId: string;
    playerLeftTeamAId: string;
    playerEnteredTeamAId: string;
    teamBId: string;
    playerLeftTeamBId: string;
    playerEnteredTeamBId: string;
    updatedAt: string;
}

export type AutomaticSubstitutionReason = "EXCESS_ROTATION" | "PLAYER_INACTIVATION";

export interface ISubstitutionPlayerSnapshot {
    playerId: string;
    playerName: string;
    gender: PlayerGender;
    nota: number;
}

export interface IRotationPlayerStats {
    playerId: string;
    timesRemoved: number;
    removedRounds: number[];
    lastRemovedRound: number | null;
    lastEnteredRound: number | null;
    returnedAsExcessRound: number | null;
    manualSwapRounds: number[];
}

export interface IAutomaticSubstitutionHistory {
    id: string;
    roundNumber: number;
    teamId: string;
    teamLabel: string;
    reason: AutomaticSubstitutionReason;
    enteringPlayers: ISubstitutionPlayerSnapshot[];
    leavingPlayers: ISubstitutionPlayerSnapshot[];
    createdAt: string;
}

export interface IManualSwapHistory {
    id: string;
    roundNumber: number;
    firstGroupId: string;
    firstGroupLabel: string;
    firstPlayerId: string;
    firstPlayerName: string;
    secondGroupId: string;
    secondGroupLabel: string;
    secondPlayerId: string;
    secondPlayerName: string;
    createdAt: string;
}

export interface IMatchHistory {
    id: string;
    roundNumber: number;
    winnerTeamId: string;
    winnerTeamLabel: string;
    loserTeamId: string;
    loserTeamLabel: string;
    winnerPlayerIds: string[];
    loserPlayerIds: string[];
    winnerPlayers: string[];
    loserPlayers: string[];
    winnerWinsBefore: number;
    winnerWinsAfter: number;
    maxConsecutiveWins: number;
    reachedWinLimit: boolean;
    doubleExitApplied: boolean;
    exitedTeamIds: string[];
    createdAt: string;
}

export interface IMatchUndoSnapshot {
    id: string;
    matchHistoryId: string;
    resultBeforeMatch: IDrawResult;
    createdAt: string;
}

export interface IPlannedSubstitution {
    teamId: string;
    teamLabel: string;
    enteringPlayers: IAllocatedPlayer[];
    leavingPlayers: IAllocatedPlayer[];
    resultingPlayers: IAllocatedPlayer[];
}

export interface IRotationSummary {
    roundNumber: number;
    winnerTeamId: string;
    winnerTeamLabel: string;
    loserTeamId: string;
    loserTeamLabel: string;
    exitedTeamLabels: string[];
    enteredTeamLabels: string[];
    reachedWinLimit: boolean;
    doubleExitApplied: boolean;
    createdAt: string;
}

export interface IDrawTeam {
    id: string;
    resultId: string;
    displayNumber: number;
    playOrder: number;
    label: string;
    playerCount: number;
    isOriginalIncompleteTeam: boolean;
    totalMen: number;
    totalWomen: number;
    notaTotalMen: number;
    notaTotalWomen: number;
    notaTotal: number;
    currentWins: number;
    players: IAllocatedPlayer[];
}

export interface IDrawResult {
    id: string;
    configurationId: string;
    totalPlayers: number;
    totalMen: number;
    totalWomen: number;
    playersPerTeamConfigured: number;
    totalTeams: number;
    hasIncompleteTeam: boolean;
    incompleteTeamIndex: number | null;
    status: DrawStatus;
    createdAt: string;
    updatedAt: string;
    teams: IDrawTeam[];
    excessPlayers: IAllocatedPlayer[];
    roundNumber: number;
    playerStats: Record<string, IRotationPlayerStats>;
    substitutionHistory: IAutomaticSubstitutionHistory[];
    manualSwapHistory: IManualSwapHistory[];
    matchHistory: IMatchHistory[];
    upcomingSubstitutions: IPlannedSubstitution[];
    lastRotationSummary: IRotationSummary | null;
    lastSwapImpact: IManualSwapImpact | null;
    lastMatchUndoSnapshot: IMatchUndoSnapshot | null;
}

export interface IApplicationRestoration {
    status: RestorationStatus;
    message?: string;
    hasStoredData: boolean;
    hasInvalidStoredResult: boolean;
}

export interface IApplicationSnapshot {
    players: IPlayer[];
    configuration: IDrawConfiguration | null;
    result: IDrawResult | null;
    restoration: IApplicationRestoration;
}

export interface ITeamStructurePreview {
    totalTeams: number;
    minimumPlayersNeeded: number;
    exactDivision: boolean;
    hasIncompleteTeam: boolean;
    lastTeamPlayerCount: number | null;
    teamSizes: number[];
    isEligible: boolean;
}

export interface IPlayerCounts {
    totalPlayers: number;
    totalMen: number;
    totalWomen: number;
    notaTotalMen: number;
    notaTotalWomen: number;
    notaTotal: number;
}

export function isValidNota(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= MIN_PLAYER_NOTA &&
        value <= MAX_PLAYER_NOTA
    );
}

export function coerceNota(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        const rounded = Math.round(value);
        if (rounded < MIN_PLAYER_NOTA) {
            return MIN_PLAYER_NOTA;
        }
        if (rounded > MAX_PLAYER_NOTA) {
            return MAX_PLAYER_NOTA;
        }
        return rounded;
    }

    return DEFAULT_PLAYER_NOTA;
}

export function createLocalId(prefix: string) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizePlayerName(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

export function normalizePlayerName(value: string) {
    return sanitizePlayerName(value).toLocaleLowerCase("pt-BR");
}

export function formatGenderLabel(gender: PlayerGender) {
    return gender === "M" ? "Masculino" : "Feminino";
}

export function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleString("pt-BR");
}

export function getPlayerCounts(players: IPlayer[]): IPlayerCounts {
    let totalMen = 0;
    let notaTotalMen = 0;
    let notaTotalWomen = 0;

    for (const player of players) {
        if (player.gender === "M") {
            totalMen += 1;
            notaTotalMen += player.nota;
        } else {
            notaTotalWomen += player.nota;
        }
    }

    return {
        totalPlayers: players.length,
        totalMen,
        totalWomen: players.length - totalMen,
        notaTotalMen,
        notaTotalWomen,
        notaTotal: notaTotalMen + notaTotalWomen,
    };
}

export function filterActivePlayers(players: IPlayer[]) {
    return players.filter((player) => player.isActive);
}

export function calculateDrawPreview(
    totalPlayers: number,
    playersPerTeam: number | null | undefined
) {
    const minimumPlayersNeeded = (playersPerTeam || 0) * 2;

    if (!playersPerTeam || !Number.isInteger(playersPerTeam) || playersPerTeam <= 0) {
        return {
            totalTeams: 0,
            minimumPlayersNeeded,
            exactDivision: false,
            hasIncompleteTeam: false,
            lastTeamPlayerCount: null,
            teamSizes: [],
            isEligible: false,
        } satisfies ITeamStructurePreview;
    }

    const completeTeams = Math.floor(totalPlayers / playersPerTeam);
    const remainingPlayers = totalPlayers % playersPerTeam;
    const teamSizes = Array.from({ length: completeTeams }, () => playersPerTeam);

    if (remainingPlayers > 0) {
        teamSizes.push(remainingPlayers);
    }

    return {
        totalTeams: teamSizes.length,
        minimumPlayersNeeded,
        exactDivision: totalPlayers > 0 && remainingPlayers === 0,
        hasIncompleteTeam: remainingPlayers > 0,
        lastTeamPlayerCount: teamSizes.length > 0 ? teamSizes[teamSizes.length - 1] : null,
        teamSizes,
        isEligible: totalPlayers >= minimumPlayersNeeded,
    } satisfies ITeamStructurePreview;
}

export function shuffleArray<T>(items: T[]) {
    const nextItems = [...items];

    for (let index = nextItems.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const currentItem = nextItems[index];
        nextItems[index] = nextItems[randomIndex];
        nextItems[randomIndex] = currentItem;
    }

    return nextItems;
}

export function isDrawResultOutdated(
    result: IDrawResult | null,
    players: IPlayer[],
    configuration: IDrawConfiguration | null
) {
    if (!result) {
        return false;
    }

    if (!configuration || configuration.playersPerTeam !== result.playersPerTeamConfigured) {
        return true;
    }

    const currentSignature = [...filterActivePlayers(players)]
        .sort((playerA, playerB) => playerA.id.localeCompare(playerB.id))
        .map((player) => `${player.id}:${player.name}:${player.gender}:${player.nota}`)
        .join("|");

    const resultSignature = [
        ...result.teams.flatMap((team) => team.players),
        ...result.excessPlayers,
    ]
        .sort((playerA, playerB) => playerA.playerId.localeCompare(playerB.playerId))
        .map((player) => `${player.playerId}:${player.playerName}:${player.gender}:${player.nota}`)
        .join("|");

    return currentSignature !== resultSignature;
}

export function getCurrentMatchTeams(result: IDrawResult | null) {
    return result?.teams.slice(0, 2) || [];
}

export function getNextRotationTeams(result: IDrawResult | null) {
    return result?.teams.slice(2) || [];
}

export function formatAllocatedPlayerList(players: IAllocatedPlayer[]) {
    if (players.length === 0) {
        return "-";
    }

    return players.map((player) => player.playerName).join(", ");
}
