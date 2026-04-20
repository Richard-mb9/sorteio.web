export type PlayerGender = "M" | "F";
export type DrawStatus = "ATIVO" | "LIMPO";
export type RestorationStatus = "success" | "empty" | "read-error" | "invalid-result";

export interface IPlayer {
    id: string;
    name: string;
    normalizedName: string;
    gender: PlayerGender;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface IDrawConfiguration {
    id: string;
    playersPerTeam: number | null;
    updatedAt: string;
}

export interface IAllocatedPlayer {
    allocationId: string;
    playerId: string;
    playerName: string;
    normalizedName: string;
    gender: PlayerGender;
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
    lastSwapImpact: IManualSwapImpact | null;
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
    const totalMen = players.filter((player) => player.gender === "M").length;
    const totalWomen = players.length - totalMen;

    return {
        totalPlayers: players.length,
        totalMen,
        totalWomen,
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
        .map((player) => `${player.id}:${player.name}:${player.gender}`)
        .join("|");

    const resultSignature = result.teams
        .flatMap((team) => team.players)
        .sort((playerA, playerB) => playerA.playerId.localeCompare(playerB.playerId))
        .map((player) => `${player.playerId}:${player.playerName}:${player.gender}`)
        .join("|");

    return currentSignature !== resultSignature;
}
