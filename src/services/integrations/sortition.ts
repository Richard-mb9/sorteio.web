import { APPLICATION_STORAGE_NAMESPACE } from "../../config";
import StorageManager from "../../commons/StorageManager";
import { DEFAULT_ROWS_PER_PAGE } from "../../commons/queryParams";
import {
    DEFAULT_MAX_CONSECUTIVE_WINS,
    calculateDrawPreview,
    coerceNota,
    createLocalId,
    DEFAULT_PLAYER_NOTA,
    filterActivePlayers,
    getPlayerCounts,
    isValidNota,
    MAX_PLAYER_NOTA,
    MIN_PLAYER_NOTA,
    normalizePlayerName,
    sanitizePlayerName,
    shuffleArray,
    type AutomaticSubstitutionReason,
    type IAllocatedPlayer,
    type IAutomaticSubstitutionHistory,
    type IApplicationSnapshot,
    type IDrawConfiguration,
    type IDrawResult,
    type IDrawTeam,
    type IManualSwapHistory,
    type IManualSwapImpact,
    type IMatchHistory,
    type IPlayer,
    type IPlannedSubstitution,
    type IRotationPlayerStats,
    type IRotationSummary,
    type ISubstitutionPlayerSnapshot,
    type PlayerGender,
} from "../../commons/sortition";
import { type IPaginatedResponse, type IPaginationParams } from "./types";

export const SORTITION_ERROR_CODES = {
    storageRead: "STORAGE_READ",
    playerNameRequired: "PLAYER_NAME_REQUIRED",
    playerGenderRequired: "PLAYER_GENDER_REQUIRED",
    playerNotaInvalid: "PLAYER_NOTA_INVALID",
    playerDuplicate: "PLAYER_DUPLICATE",
    playerNotFound: "PLAYER_NOT_FOUND",
    configurationInvalid: "CONFIGURATION_INVALID",
    drawIneligible: "DRAW_INELIGIBLE",
    resultNotFound: "RESULT_NOT_FOUND",
    resultInvalid: "RESULT_INVALID",
    winnerInvalid: "WINNER_INVALID",
    swapIncompleteSelection: "SWAP_INCOMPLETE_SELECTION",
    swapSameTeam: "SWAP_SAME_TEAM",
    swapInvalidStructure: "SWAP_INVALID_STRUCTURE",
} as const;

type SortitionErrorCode = (typeof SORTITION_ERROR_CODES)[keyof typeof SORTITION_ERROR_CODES];

export class SortitionDomainError extends Error {
    public readonly code: SortitionErrorCode;
    public readonly details?: Record<string, number | string | boolean>;

    constructor(code: SortitionErrorCode, details?: Record<string, number | string | boolean>) {
        super(code);
        this.code = code;
        this.details = details;
    }
}

export interface IPlayerListParams extends IPaginationParams {
    search?: string;
    gender?: PlayerGender;
    isActive?: boolean;
}

export interface ICreatePlayerRequest {
    name: string;
    gender: PlayerGender;
    nota: number;
}

export interface IUpdatePlayerRequest {
    name: string;
    gender: PlayerGender;
    nota: number;
}

export interface ISaveDrawConfigurationRequest {
    playersPerTeam: number;
    maxConsecutiveWins: number;
    doubleExitOnMaxWins: boolean;
    rotationRandomnessEnabled: boolean;
}

export interface IGenerateDrawResponse {
    result: IDrawResult;
    replacedExistingResult: boolean;
}

export interface IClearPlayersResponse {
    removedResult: boolean;
}

export interface IConfirmManualSwapRequest {
    firstPlayerId: string;
    secondPlayerId: string;
}

export interface IConfirmMatchWinnerRequest {
    winnerTeamId: string;
}

const PLAYERS_STORAGE_KEY = `${APPLICATION_STORAGE_NAMESPACE}:players`;
const CONFIGURATION_STORAGE_KEY = `${APPLICATION_STORAGE_NAMESPACE}:configuration`;
const RESULT_STORAGE_KEY = `${APPLICATION_STORAGE_NAMESPACE}:result`;

interface ISafeStoredValue<T> {
    hasStoredValue: boolean;
    hasError: boolean;
    value: T | null;
}

function createError(
    code: SortitionErrorCode,
    details?: Record<string, number | string | boolean>
) {
    return new SortitionDomainError(code, details);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object";
}

function isGender(value: unknown): value is PlayerGender {
    return value === "M" || value === "F";
}

function safeReadStoredValue<T>(
    key: string,
    validator: (value: unknown) => T | null
): ISafeStoredValue<T> {
    const rawValue = StorageManager.getItem(key);

    if (!rawValue) {
        return {
            hasStoredValue: false,
            hasError: false,
            value: null,
        };
    }

    try {
        const parsedValue = JSON.parse(rawValue) as unknown;
        const validatedValue = validator(parsedValue);

        if (!validatedValue) {
            return {
                hasStoredValue: true,
                hasError: true,
                value: null,
            };
        }

        return {
            hasStoredValue: true,
            hasError: false,
            value: validatedValue,
        };
    } catch {
        return {
            hasStoredValue: true,
            hasError: true,
            value: null,
        };
    }
}

function validatePlayer(value: unknown): IPlayer | null {
    if (!isObject(value)) {
        return null;
    }

    const { id, name, normalizedName, gender, nota, isActive, createdAt, updatedAt } = value;

    if (
        typeof id !== "string" ||
        typeof name !== "string" ||
        typeof normalizedName !== "string" ||
        !isGender(gender) ||
        (isActive !== undefined && typeof isActive !== "boolean") ||
        typeof createdAt !== "string" ||
        typeof updatedAt !== "string"
    ) {
        return null;
    }

    return {
        id,
        name,
        normalizedName,
        gender,
        nota: nota === undefined || nota === null ? DEFAULT_PLAYER_NOTA : coerceNota(nota),
        isActive: isActive === undefined ? true : isActive,
        createdAt,
        updatedAt,
    };
}

function validatePlayers(value: unknown): IPlayer[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const parsedPlayers = value.map((player) => validatePlayer(player));

    if (parsedPlayers.some((player) => !player)) {
        return null;
    }

    return parsedPlayers as IPlayer[];
}

function validateConfiguration(value: unknown): IDrawConfiguration | null {
    if (!isObject(value)) {
        return null;
    }

    const {
        id,
        playersPerTeam,
        maxConsecutiveWins,
        doubleExitOnMaxWins,
        rotationRandomnessEnabled,
        updatedAt,
    } = value;

    if (typeof id !== "string" || typeof updatedAt !== "string") {
        return null;
    }

    if (
        playersPerTeam !== null &&
        (!Number.isInteger(playersPerTeam) || Number(playersPerTeam) <= 0)
    ) {
        return null;
    }

    return {
        id,
        playersPerTeam: playersPerTeam === null ? null : Number(playersPerTeam),
        maxConsecutiveWins:
            Number.isInteger(maxConsecutiveWins) && Number(maxConsecutiveWins) > 0
                ? Number(maxConsecutiveWins)
                : DEFAULT_MAX_CONSECUTIVE_WINS,
        doubleExitOnMaxWins: typeof doubleExitOnMaxWins === "boolean" ? doubleExitOnMaxWins : false,
        rotationRandomnessEnabled:
            typeof rotationRandomnessEnabled === "boolean" ? rotationRandomnessEnabled : false,
        updatedAt,
    };
}

function validateAllocatedPlayer(value: unknown): IAllocatedPlayer | null {
    if (!isObject(value)) {
        return null;
    }

    const { allocationId, playerId, playerName, normalizedName, gender, nota, positionInTeam } =
        value;

    if (
        typeof allocationId !== "string" ||
        typeof playerId !== "string" ||
        typeof playerName !== "string" ||
        typeof normalizedName !== "string" ||
        !isGender(gender) ||
        !Number.isInteger(positionInTeam)
    ) {
        return null;
    }

    return {
        allocationId,
        playerId,
        playerName,
        normalizedName,
        gender,
        nota: nota === undefined || nota === null ? DEFAULT_PLAYER_NOTA : coerceNota(nota),
        positionInTeam: Number(positionInTeam),
    };
}

function validateDrawTeam(value: unknown): IDrawTeam | null {
    if (!isObject(value) || !Array.isArray(value.players)) {
        return null;
    }

    const {
        id,
        resultId,
        displayNumber,
        playOrder,
        label,
        playerCount,
        isOriginalIncompleteTeam,
        totalMen,
        totalWomen,
        notaTotalMen,
        notaTotalWomen,
        notaTotal,
        currentWins,
        players,
    } = value;

    if (
        typeof id !== "string" ||
        typeof resultId !== "string" ||
        !Number.isInteger(displayNumber) ||
        !Number.isInteger(playOrder) ||
        typeof label !== "string" ||
        !Number.isInteger(playerCount) ||
        typeof isOriginalIncompleteTeam !== "boolean" ||
        !Number.isInteger(totalMen) ||
        !Number.isInteger(totalWomen)
    ) {
        return null;
    }

    const parsedPlayers = players.map((player) => validateAllocatedPlayer(player));

    if (parsedPlayers.some((player) => !player)) {
        return null;
    }

    const validatedPlayers = parsedPlayers as IAllocatedPlayer[];
    const computedNotaMen = validatedPlayers
        .filter((player) => player.gender === "M")
        .reduce((sum, player) => sum + player.nota, 0);
    const computedNotaWomen = validatedPlayers
        .filter((player) => player.gender === "F")
        .reduce((sum, player) => sum + player.nota, 0);

    return {
        id,
        resultId,
        displayNumber: Number(displayNumber),
        playOrder: Number(playOrder),
        label,
        playerCount: Number(playerCount),
        isOriginalIncompleteTeam,
        totalMen: Number(totalMen),
        totalWomen: Number(totalWomen),
        notaTotalMen: Number.isInteger(notaTotalMen) ? Number(notaTotalMen) : computedNotaMen,
        notaTotalWomen: Number.isInteger(notaTotalWomen)
            ? Number(notaTotalWomen)
            : computedNotaWomen,
        notaTotal: Number.isInteger(notaTotal)
            ? Number(notaTotal)
            : computedNotaMen + computedNotaWomen,
        currentWins:
            Number.isInteger(currentWins) && Number(currentWins) >= 0 ? Number(currentWins) : 0,
        players: validatedPlayers,
    };
}

function validateSwapImpact(value: unknown): IManualSwapImpact | null {
    if (!isObject(value)) {
        return null;
    }

    const {
        resultId,
        teamAId,
        playerLeftTeamAId,
        playerEnteredTeamAId,
        teamBId,
        playerLeftTeamBId,
        playerEnteredTeamBId,
        updatedAt,
    } = value;

    if (
        typeof resultId !== "string" ||
        typeof teamAId !== "string" ||
        typeof playerLeftTeamAId !== "string" ||
        typeof playerEnteredTeamAId !== "string" ||
        typeof teamBId !== "string" ||
        typeof playerLeftTeamBId !== "string" ||
        typeof playerEnteredTeamBId !== "string" ||
        typeof updatedAt !== "string"
    ) {
        return null;
    }

    return {
        resultId,
        teamAId,
        playerLeftTeamAId,
        playerEnteredTeamAId,
        teamBId,
        playerLeftTeamBId,
        playerEnteredTeamBId,
        updatedAt,
    };
}

function validateAllocatedPlayers(value: unknown): IAllocatedPlayer[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const parsedPlayers = value.map((player) => validateAllocatedPlayer(player));
    return parsedPlayers.filter((player): player is IAllocatedPlayer => Boolean(player));
}

function validateRotationPlayerStats(value: unknown): Record<string, IRotationPlayerStats> {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce<Record<string, IRotationPlayerStats>>(
        (stats, [playerId, rawStats]) => {
            if (!isObject(rawStats)) {
                return stats;
            }

            const {
                timesRemoved,
                removedRounds,
                lastRemovedRound,
                lastEnteredRound,
                returnedAsExcessRound,
                manualSwapRounds,
            } = rawStats;

            stats[playerId] = {
                playerId,
                timesRemoved:
                    Number.isInteger(timesRemoved) && Number(timesRemoved) >= 0
                        ? Number(timesRemoved)
                        : 0,
                removedRounds: Array.isArray(removedRounds)
                    ? removedRounds.filter((round) => Number.isInteger(round)).map(Number)
                    : [],
                lastRemovedRound:
                    Number.isInteger(lastRemovedRound) && Number(lastRemovedRound) > 0
                        ? Number(lastRemovedRound)
                        : null,
                lastEnteredRound:
                    Number.isInteger(lastEnteredRound) && Number(lastEnteredRound) > 0
                        ? Number(lastEnteredRound)
                        : null,
                returnedAsExcessRound:
                    Number.isInteger(returnedAsExcessRound) && Number(returnedAsExcessRound) > 0
                        ? Number(returnedAsExcessRound)
                        : null,
                manualSwapRounds: Array.isArray(manualSwapRounds)
                    ? manualSwapRounds.filter((round) => Number.isInteger(round)).map(Number)
                    : [],
            };

            return stats;
        },
        {}
    );
}

function validateRotationSummary(value: unknown): IRotationSummary | null {
    if (!isObject(value)) {
        return null;
    }

    const {
        roundNumber,
        winnerTeamId,
        winnerTeamLabel,
        loserTeamId,
        loserTeamLabel,
        exitedTeamLabels,
        enteredTeamLabels,
        reachedWinLimit,
        doubleExitApplied,
        createdAt,
    } = value;

    if (
        !Number.isInteger(roundNumber) ||
        typeof winnerTeamId !== "string" ||
        typeof winnerTeamLabel !== "string" ||
        typeof loserTeamId !== "string" ||
        typeof loserTeamLabel !== "string" ||
        !Array.isArray(exitedTeamLabels) ||
        !Array.isArray(enteredTeamLabels) ||
        typeof reachedWinLimit !== "boolean" ||
        typeof doubleExitApplied !== "boolean" ||
        typeof createdAt !== "string"
    ) {
        return null;
    }

    return {
        roundNumber: Number(roundNumber),
        winnerTeamId,
        winnerTeamLabel,
        loserTeamId,
        loserTeamLabel,
        exitedTeamLabels: exitedTeamLabels.filter((label) => typeof label === "string"),
        enteredTeamLabels: enteredTeamLabels.filter((label) => typeof label === "string"),
        reachedWinLimit,
        doubleExitApplied,
        createdAt,
    };
}

function isStoredResultStructurallyValid(result: IDrawResult) {
    if (
        !result.id ||
        !result.configurationId ||
        !Number.isInteger(result.totalPlayers) ||
        !Number.isInteger(result.totalMen) ||
        !Number.isInteger(result.totalWomen) ||
        !Number.isInteger(result.playersPerTeamConfigured) ||
        result.playersPerTeamConfigured <= 0 ||
        !Number.isInteger(result.totalTeams) ||
        (result.incompleteTeamIndex !== null && !Number.isInteger(result.incompleteTeamIndex)) ||
        result.status !== "ATIVO" ||
        typeof result.createdAt !== "string" ||
        typeof result.updatedAt !== "string" ||
        result.teams.length !== result.totalTeams ||
        !Array.isArray(result.excessPlayers) ||
        !Number.isInteger(result.roundNumber) ||
        result.roundNumber <= 0
    ) {
        return false;
    }

    const seenPlayerIds = new Set<string>();
    let totalMen = 0;
    let totalWomen = 0;
    let totalPlayers = 0;

    for (let index = 0; index < result.teams.length; index += 1) {
        const team = result.teams[index];

        if (
            team.playOrder !== index + 1 ||
            team.players.length !== team.playerCount ||
            team.totalMen + team.totalWomen !== team.playerCount ||
            team.playerCount !== result.playersPerTeamConfigured
        ) {
            return false;
        }

        const menInTeam = team.players.filter((player) => player.gender === "M").length;
        const womenInTeam = team.players.length - menInTeam;

        if (menInTeam !== team.totalMen || womenInTeam !== team.totalWomen) {
            return false;
        }

        if (team.isOriginalIncompleteTeam) {
            return false;
        }

        totalMen += menInTeam;
        totalWomen += womenInTeam;
        totalPlayers += team.playerCount;

        for (const player of team.players) {
            if (seenPlayerIds.has(player.playerId)) {
                return false;
            }

            seenPlayerIds.add(player.playerId);
        }
    }

    for (const player of result.excessPlayers) {
        if (seenPlayerIds.has(player.playerId)) {
            return false;
        }

        if (player.gender === "M") {
            totalMen += 1;
        } else {
            totalWomen += 1;
        }

        totalPlayers += 1;
        seenPlayerIds.add(player.playerId);
    }

    if (result.hasIncompleteTeam !== result.excessPlayers.length > 0) {
        return false;
    }

    return (
        totalPlayers === result.totalPlayers &&
        totalMen === result.totalMen &&
        totalWomen === result.totalWomen &&
        result.incompleteTeamIndex === null
    );
}

function validateDrawResult(value: unknown): IDrawResult | null {
    if (!isObject(value) || !Array.isArray(value.teams)) {
        return null;
    }

    const {
        id,
        configurationId,
        totalPlayers,
        totalMen,
        totalWomen,
        playersPerTeamConfigured,
        totalTeams,
        hasIncompleteTeam,
        incompleteTeamIndex,
        status,
        createdAt,
        updatedAt,
        teams,
        excessPlayers,
        roundNumber,
        playerStats,
        substitutionHistory,
        manualSwapHistory,
        matchHistory,
        upcomingSubstitutions,
        lastRotationSummary,
        lastSwapImpact,
    } = value;

    if (
        typeof id !== "string" ||
        typeof configurationId !== "string" ||
        !Number.isInteger(totalPlayers) ||
        !Number.isInteger(totalMen) ||
        !Number.isInteger(totalWomen) ||
        !Number.isInteger(playersPerTeamConfigured) ||
        !Number.isInteger(totalTeams) ||
        typeof hasIncompleteTeam !== "boolean" ||
        (incompleteTeamIndex !== null && !Number.isInteger(incompleteTeamIndex)) ||
        status !== "ATIVO" ||
        typeof createdAt !== "string" ||
        typeof updatedAt !== "string"
    ) {
        return null;
    }

    const parsedTeams = teams.map((team) => validateDrawTeam(team));

    if (parsedTeams.some((team) => !team)) {
        return null;
    }

    const parsedTeamList = (parsedTeams as IDrawTeam[]).map((team, index) => ({
        ...team,
        playOrder: index + 1,
    }));
    const completeTeams = parsedTeamList
        .filter((team) => team.playerCount >= Number(playersPerTeamConfigured))
        .map((team, index) => ({
            ...team,
            playOrder: index + 1,
            isOriginalIncompleteTeam: false,
        }));
    const migratedExcessPlayers = parsedTeamList
        .filter((team) => team.playerCount < Number(playersPerTeamConfigured))
        .flatMap((team) => team.players);
    const normalizedExcessPlayers = [
        ...validateAllocatedPlayers(excessPlayers),
        ...migratedExcessPlayers,
    ].map((player, index) => ({
        ...player,
        positionInTeam: index,
    }));
    const computedTotalMen =
        completeTeams.reduce((sum, team) => sum + team.totalMen, 0) +
        normalizedExcessPlayers.filter((player) => player.gender === "M").length;
    const computedTotalWomen =
        completeTeams.reduce((sum, team) => sum + team.totalWomen, 0) +
        normalizedExcessPlayers.filter((player) => player.gender === "F").length;

    const parsedResult: IDrawResult = {
        id,
        configurationId,
        totalPlayers: computedTotalMen + computedTotalWomen,
        totalMen: computedTotalMen,
        totalWomen: computedTotalWomen,
        playersPerTeamConfigured: Number(playersPerTeamConfigured),
        totalTeams: completeTeams.length,
        hasIncompleteTeam: normalizedExcessPlayers.length > 0,
        incompleteTeamIndex: null,
        status,
        createdAt,
        updatedAt,
        teams: completeTeams,
        excessPlayers: normalizedExcessPlayers,
        roundNumber:
            Number.isInteger(roundNumber) && Number(roundNumber) > 0 ? Number(roundNumber) : 1,
        playerStats: validateRotationPlayerStats(playerStats),
        substitutionHistory: Array.isArray(substitutionHistory)
            ? (substitutionHistory as IAutomaticSubstitutionHistory[])
            : [],
        manualSwapHistory: Array.isArray(manualSwapHistory)
            ? (manualSwapHistory as IManualSwapHistory[])
            : [],
        matchHistory: Array.isArray(matchHistory) ? (matchHistory as IMatchHistory[]) : [],
        upcomingSubstitutions: Array.isArray(upcomingSubstitutions)
            ? (upcomingSubstitutions as IPlannedSubstitution[])
            : [],
        lastRotationSummary: validateRotationSummary(lastRotationSummary),
        lastSwapImpact: lastSwapImpact ? validateSwapImpact(lastSwapImpact) : null,
    };

    const parsedResultWithUpcomingSubstitutions = {
        ...parsedResult,
        upcomingSubstitutions: calculateUpcomingSubstitutions(parsedResult),
    };

    if (!isStoredResultStructurallyValid(parsedResultWithUpcomingSubstitutions)) {
        return null;
    }

    return parsedResultWithUpcomingSubstitutions;
}

function readPlayersOrThrow() {
    const storedPlayers = safeReadStoredValue(PLAYERS_STORAGE_KEY, validatePlayers);

    if (storedPlayers.hasError) {
        throw createError(SORTITION_ERROR_CODES.storageRead);
    }

    return storedPlayers.value || [];
}

function readConfigurationOrThrow() {
    const storedConfiguration = safeReadStoredValue(
        CONFIGURATION_STORAGE_KEY,
        validateConfiguration
    );

    if (storedConfiguration.hasError) {
        throw createError(SORTITION_ERROR_CODES.storageRead);
    }

    return storedConfiguration.value;
}

function readResultOrThrow() {
    const storedResult = safeReadStoredValue(RESULT_STORAGE_KEY, validateDrawResult);

    if (storedResult.hasError) {
        throw createError(SORTITION_ERROR_CODES.resultInvalid);
    }

    return storedResult.value;
}

function readValidResultSafely() {
    const storedResult = safeReadStoredValue(RESULT_STORAGE_KEY, validateDrawResult);
    return storedResult.hasError ? null : storedResult.value;
}

function persistPlayers(players: IPlayer[]) {
    StorageManager.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
}

function persistConfiguration(configuration: IDrawConfiguration) {
    StorageManager.setItem(CONFIGURATION_STORAGE_KEY, JSON.stringify(configuration));
}

function persistResult(result: IDrawResult) {
    StorageManager.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
}

function removeStoredResult() {
    StorageManager.removeItem(RESULT_STORAGE_KEY);
}

function hasStoredResultValue() {
    return Boolean(StorageManager.getItem(RESULT_STORAGE_KEY));
}

function assertValidGender(gender: PlayerGender | string) {
    if (!isGender(gender)) {
        throw createError(SORTITION_ERROR_CODES.playerGenderRequired);
    }
}

function assertValidPlayerName(name: string) {
    if (!sanitizePlayerName(name)) {
        throw createError(SORTITION_ERROR_CODES.playerNameRequired);
    }
}

function assertValidNota(nota: unknown) {
    if (!isValidNota(nota)) {
        throw createError(SORTITION_ERROR_CODES.playerNotaInvalid, {
            min: MIN_PLAYER_NOTA,
            max: MAX_PLAYER_NOTA,
        });
    }
}

function assertValidConfiguration(playersPerTeam: number, maxConsecutiveWins?: number) {
    if (
        !Number.isInteger(playersPerTeam) ||
        playersPerTeam <= 0 ||
        (maxConsecutiveWins !== undefined &&
            (!Number.isInteger(maxConsecutiveWins) || maxConsecutiveWins <= 0))
    ) {
        throw createError(SORTITION_ERROR_CODES.configurationInvalid);
    }
}

function ensureUniquePlayerName(players: IPlayer[], playerName: string, playerIdToIgnore?: string) {
    const normalizedName = normalizePlayerName(playerName);
    const hasDuplicate = players.some(
        (player) =>
            player.normalizedName === normalizedName &&
            (!playerIdToIgnore || player.id !== playerIdToIgnore)
    );

    if (hasDuplicate) {
        throw createError(SORTITION_ERROR_CODES.playerDuplicate);
    }

    return normalizedName;
}

interface IMaleDistributionTarget {
    menCount: number;
    decimalMen: number;
    tieBreaker: number;
}

const DECIMAL_COMPARISON_EPSILON = 1e-9;

function buildProportionalMaleDistribution(teamSizes: number[], totalMen: number) {
    const totalPlayers = teamSizes.reduce((sum, teamSize) => sum + teamSize, 0);
    const menProportion = totalPlayers === 0 ? 0 : totalMen / totalPlayers;
    const distributionTargets: IMaleDistributionTarget[] = teamSizes.map((teamSize) => {
        const idealMenCount = teamSize * menProportion;
        const baseMenCount = Math.floor(idealMenCount);

        return {
            menCount: baseMenCount,
            decimalMen: idealMenCount - baseMenCount,
            tieBreaker: Math.random(),
        };
    });

    let remainingMen =
        totalMen -
        distributionTargets.reduce((sum, distributionTarget) => {
            return sum + distributionTarget.menCount;
        }, 0);

    if (remainingMen <= 0) {
        return distributionTargets.map((distributionTarget) => distributionTarget.menCount);
    }

    const targetsByPriority = [...distributionTargets].sort((targetA, targetB) => {
        const decimalDifference = targetB.decimalMen - targetA.decimalMen;

        if (Math.abs(decimalDifference) > DECIMAL_COMPARISON_EPSILON) {
            return decimalDifference;
        }

        return targetA.tieBreaker - targetB.tieBreaker;
    });

    for (const distributionTarget of targetsByPriority) {
        if (remainingMen === 0) {
            break;
        }

        distributionTarget.menCount += 1;
        remainingMen -= 1;
    }

    return distributionTargets.map((distributionTarget) => distributionTarget.menCount);
}

interface IGenderDistributionSlot {
    index: number;
    remaining: number;
    notaSum: number;
    tieBreaker: number;
    players: IPlayer[];
}

function sortPlayersByNotaDescWithTieShuffle(players: IPlayer[]) {
    return [...players]
        .map((player) => ({ player, tieBreaker: Math.random() }))
        .sort((entryA, entryB) => {
            if (entryA.player.nota !== entryB.player.nota) {
                return entryB.player.nota - entryA.player.nota;
            }

            return entryA.tieBreaker - entryB.tieBreaker;
        })
        .map((entry) => entry.player);
}

function distributePlayersByMinimumSum(sortedPlayers: IPlayer[], slots: IGenderDistributionSlot[]) {
    for (const player of sortedPlayers) {
        const eligibleSlots = slots.filter((slot) => slot.remaining > 0);

        if (eligibleSlots.length === 0) {
            break;
        }

        const minimumSum = eligibleSlots.reduce(
            (lowest, slot) => (slot.notaSum < lowest ? slot.notaSum : lowest),
            eligibleSlots[0].notaSum
        );
        const tiedSlots = eligibleSlots.filter((slot) => slot.notaSum === minimumSum);
        const chosenSlot =
            tiedSlots.length === 1
                ? tiedSlots[0]
                : tiedSlots[Math.floor(Math.random() * tiedSlots.length)];

        chosenSlot.players.push(player);
        chosenSlot.notaSum += player.nota;
        chosenSlot.remaining -= 1;
    }
}

function buildTeamPlayers(players: IPlayer[], playersPerTeam: number) {
    const preview = calculateDrawPreview(players.length, playersPerTeam);

    if (!preview.isEligible) {
        throw createError(SORTITION_ERROR_CODES.drawIneligible, {
            currentPlayers: players.length,
            minimumPlayers: preview.minimumPlayersNeeded,
        });
    }

    const menPlayers = players.filter((player) => player.gender === "M");
    const womenPlayers = players.filter((player) => player.gender === "F");
    const maleDistribution = buildProportionalMaleDistribution(
        preview.teamSizes,
        menPlayers.length
    );

    const menSlots: IGenderDistributionSlot[] = preview.teamSizes.map((_, index) => ({
        index,
        remaining: maleDistribution[index],
        notaSum: 0,
        tieBreaker: Math.random(),
        players: [],
    }));
    const womenSlots: IGenderDistributionSlot[] = preview.teamSizes.map((teamSize, index) => ({
        index,
        remaining: teamSize - maleDistribution[index],
        notaSum: 0,
        tieBreaker: Math.random(),
        players: [],
    }));

    distributePlayersByMinimumSum(sortPlayersByNotaDescWithTieShuffle(menPlayers), menSlots);
    distributePlayersByMinimumSum(sortPlayersByNotaDescWithTieShuffle(womenPlayers), womenSlots);

    return preview.teamSizes.map((_, index) => {
        const allocatedPlayers = shuffleArray([
            ...menSlots[index].players,
            ...womenSlots[index].players,
        ]).map((player, playerIndex) => ({
            allocationId: createLocalId("allocation"),
            playerId: player.id,
            playerName: player.name,
            normalizedName: player.normalizedName,
            gender: player.gender,
            nota: player.nota,
            positionInTeam: playerIndex,
        }));

        return allocatedPlayers;
    });
}

function recalculateTeam(team: IDrawTeam) {
    const menPlayers = team.players.filter((player) => player.gender === "M");
    const womenPlayers = team.players.filter((player) => player.gender === "F");
    const notaTotalMen = menPlayers.reduce((sum, player) => sum + player.nota, 0);
    const notaTotalWomen = womenPlayers.reduce((sum, player) => sum + player.nota, 0);

    return {
        ...team,
        playerCount: team.players.length,
        totalMen: menPlayers.length,
        totalWomen: womenPlayers.length,
        notaTotalMen,
        notaTotalWomen,
        notaTotal: notaTotalMen + notaTotalWomen,
        players: team.players.map((player, index) => ({
            ...player,
            positionInTeam: index,
        })),
    };
}

function toAllocatedPlayer(player: IPlayer, positionInTeam: number): IAllocatedPlayer {
    return {
        allocationId: createLocalId("allocation"),
        playerId: player.id,
        playerName: player.name,
        normalizedName: player.normalizedName,
        gender: player.gender,
        nota: player.nota,
        positionInTeam,
    };
}

function toPlayerSnapshot(player: IAllocatedPlayer): ISubstitutionPlayerSnapshot {
    return {
        playerId: player.playerId,
        playerName: player.playerName,
        gender: player.gender,
        nota: player.nota,
    };
}

function normalizeTeamOrder(teams: IDrawTeam[]) {
    return teams.map((team, index) =>
        recalculateTeam({
            ...team,
            playOrder: index + 1,
            isOriginalIncompleteTeam: false,
        })
    );
}

function ensurePlayerStats(playerStats: Record<string, IRotationPlayerStats>, playerId: string) {
    if (!playerStats[playerId]) {
        playerStats[playerId] = {
            playerId,
            timesRemoved: 0,
            removedRounds: [],
            lastRemovedRound: null,
            lastEnteredRound: null,
            returnedAsExcessRound: null,
            manualSwapRounds: [],
        };
    }

    return playerStats[playerId];
}

function clonePlayerStats(playerStats: Record<string, IRotationPlayerStats>) {
    return Object.entries(playerStats).reduce<Record<string, IRotationPlayerStats>>(
        (stats, [playerId, value]) => {
            stats[playerId] = {
                ...value,
                removedRounds: [...value.removedRounds],
                manualSwapRounds: [...value.manualSwapRounds],
            };

            return stats;
        },
        {}
    );
}

function markPlayersEntered(
    playerStats: Record<string, IRotationPlayerStats>,
    players: IAllocatedPlayer[],
    roundNumber: number
) {
    for (const player of players) {
        ensurePlayerStats(playerStats, player.playerId).lastEnteredRound = roundNumber;
    }
}

function markPlayersRemoved(
    playerStats: Record<string, IRotationPlayerStats>,
    players: IAllocatedPlayer[],
    roundNumber: number
) {
    for (const player of players) {
        const stats = ensurePlayerStats(playerStats, player.playerId);
        stats.timesRemoved += 1;
        stats.removedRounds.push(roundNumber);
        stats.lastRemovedRound = roundNumber;
        stats.returnedAsExcessRound = roundNumber;
    }
}

function rebuildResultTotals(result: IDrawResult, updatedAt = new Date().toISOString()) {
    const teams = normalizeTeamOrder(result.teams);
    const excessPlayers = result.excessPlayers.map((player, index) => ({
        ...player,
        positionInTeam: index,
    }));
    const totalMen =
        teams.reduce((sum, team) => sum + team.totalMen, 0) +
        excessPlayers.filter((player) => player.gender === "M").length;
    const totalWomen =
        teams.reduce((sum, team) => sum + team.totalWomen, 0) +
        excessPlayers.filter((player) => player.gender === "F").length;

    return {
        ...result,
        totalPlayers: totalMen + totalWomen,
        totalMen,
        totalWomen,
        totalTeams: teams.length,
        hasIncompleteTeam: excessPlayers.length > 0,
        incompleteTeamIndex: null,
        updatedAt,
        teams,
        excessPlayers,
    } satisfies IDrawResult;
}

function calculateTeamSpread(teams: IDrawTeam[]) {
    if (teams.length <= 1) {
        return 0;
    }

    const totals = teams.map((team) => team.notaTotal);
    return Math.max(...totals) - Math.min(...totals);
}

function buildCombinations<T>(items: T[], size: number) {
    const combinations: T[][] = [];

    function run(startIndex: number, current: T[]) {
        if (current.length === size) {
            combinations.push(current);
            return;
        }

        for (let index = startIndex; index < items.length; index += 1) {
            run(index + 1, [...current, items[index]]);
        }
    }

    run(0, []);
    return combinations;
}

function compareNumberTuples(tupleA: number[], tupleB: number[]) {
    for (let index = 0; index < Math.min(tupleA.length, tupleB.length); index += 1) {
        if (tupleA[index] !== tupleB[index]) {
            return tupleA[index] - tupleB[index];
        }
    }

    return tupleA.length - tupleB.length;
}

function calculateRemovalFairnessPenalty(
    players: IAllocatedPlayer[],
    playerStats: Record<string, IRotationPlayerStats>,
    roundNumber: number
) {
    return players.reduce((penalty, player) => {
        const stats = playerStats[player.playerId];
        const roundsSinceLastRemoval = stats?.lastRemovedRound
            ? roundNumber - stats.lastRemovedRound
            : Number.POSITIVE_INFINITY;
        const recencyPenalty = Number.isFinite(roundsSinceLastRemoval)
            ? Math.max(0, 4 - roundsSinceLastRemoval)
            : 0;

        return penalty + (stats?.timesRemoved || 0) * 3 + recencyPenalty * 2;
    }, 0);
}

function planSubstitution(
    team: IDrawTeam,
    enteringPlayers: IAllocatedPlayer[],
    opponentTeam: IDrawTeam | null,
    allTeams: IDrawTeam[],
    playerStats: Record<string, IRotationPlayerStats>,
    roundNumber: number,
    rotationRandomnessEnabled = false
): IPlannedSubstitution | null {
    if (enteringPlayers.length === 0 || team.players.length < enteringPlayers.length) {
        return null;
    }

    const enteringMen = enteringPlayers.filter((player) => player.gender === "M").length;
    const enteringNota = enteringPlayers.reduce((sum, player) => sum + player.nota, 0);
    const combinations = buildCombinations(team.players, enteringPlayers.length);
    const rankedOptions = combinations
        .map((leavingPlayers) => {
            const leavingMen = leavingPlayers.filter((player) => player.gender === "M").length;
            const leavingNota = leavingPlayers.reduce((sum, player) => sum + player.nota, 0);
            const leavingIds = new Set(leavingPlayers.map((player) => player.playerId));
            const resultingPlayers = [
                ...team.players.filter((player) => !leavingIds.has(player.playerId)),
                ...enteringPlayers,
            ].map((player, index) => ({ ...player, positionInTeam: index }));
            const resultingTeam = recalculateTeam({
                ...team,
                players: resultingPlayers,
            });
            const teamsAfterSubstitution = allTeams.map((currentTeam) =>
                currentTeam.id === team.id ? resultingTeam : currentTeam
            );
            const genderScore =
                Math.abs(enteringMen - leavingMen) * 100 +
                Math.abs(resultingTeam.totalMen - team.totalMen) * 20 +
                (opponentTeam ? Math.abs(resultingTeam.totalMen - opponentTeam.totalMen) : 0);
            const technicalScore = Math.abs(enteringNota - leavingNota);
            const strengthScore =
                Math.abs(resultingTeam.notaTotal - team.notaTotal) +
                (opponentTeam ? Math.abs(resultingTeam.notaTotal - opponentTeam.notaTotal) : 0) +
                calculateTeamSpread(teamsAfterSubstitution);
            const fairnessScore = calculateRemovalFairnessPenalty(
                leavingPlayers,
                playerStats,
                roundNumber
            );
            const randomRotationScore = [
                Math.abs(enteringMen - leavingMen),
                fairnessScore,
                leavingPlayers.reduce(
                    (sum, player) => sum + (playerStats[player.playerId]?.timesRemoved || 0),
                    0
                ),
                Math.random(),
            ];

            return {
                leavingPlayers,
                resultingPlayers,
                score: rotationRandomnessEnabled
                    ? randomRotationScore
                    : [genderScore, technicalScore, strengthScore, fairnessScore, Math.random()],
            };
        })
        .sort((optionA, optionB) => compareNumberTuples(optionA.score, optionB.score));

    const chosenOption = rankedOptions[0];

    if (!chosenOption) {
        return null;
    }

    return {
        teamId: team.id,
        teamLabel: team.label,
        enteringPlayers,
        leavingPlayers: chosenOption.leavingPlayers,
        resultingPlayers: chosenOption.resultingPlayers,
    };
}

function calculateUpcomingSubstitutions(result: IDrawResult, rotationRandomnessEnabled = false) {
    if (result.excessPlayers.length === 0 || result.teams.length < 2) {
        return [];
    }

    return result.teams
        .slice(0, 2)
        .map((team) => {
            const enteringPlayers = result.excessPlayers.slice(
                0,
                Math.min(result.excessPlayers.length, team.players.length)
            );
            const opponentTeam = result.teams.find((currentTeam) => currentTeam.id !== team.id);

            return planSubstitution(
                team,
                enteringPlayers,
                opponentTeam || null,
                result.teams,
                result.playerStats,
                result.roundNumber,
                rotationRandomnessEnabled
            );
        })
        .filter((plan): plan is IPlannedSubstitution => Boolean(plan));
}

function withUpcomingSubstitutions(result: IDrawResult, rotationRandomnessEnabled = false) {
    return {
        ...result,
        upcomingSubstitutions: calculateUpcomingSubstitutions(result, rotationRandomnessEnabled),
    } satisfies IDrawResult;
}

function applyAutomaticSubstitutions(
    teams: IDrawTeam[],
    excessPlayers: IAllocatedPlayer[],
    targetTeamIds: string[],
    playerStats: Record<string, IRotationPlayerStats>,
    roundNumber: number,
    reason: AutomaticSubstitutionReason,
    rotationRandomnessEnabled = false
) {
    const updatedTeams = normalizeTeamOrder(teams);
    let updatedExcessPlayers = [...excessPlayers];
    const substitutionHistory: IAutomaticSubstitutionHistory[] = [];

    for (const teamId of targetTeamIds) {
        if (updatedExcessPlayers.length === 0) {
            break;
        }

        const teamIndex = updatedTeams.findIndex((team) => team.id === teamId);

        if (teamIndex < 0) {
            continue;
        }

        const team = updatedTeams[teamIndex];
        const enteringPlayers = updatedExcessPlayers.slice(
            0,
            Math.min(updatedExcessPlayers.length, team.players.length)
        );
        const opponentTeam = updatedTeams.find(
            (currentTeam, index) => index < 2 && currentTeam.id !== team.id
        );
        const plan = planSubstitution(
            team,
            enteringPlayers,
            opponentTeam || null,
            updatedTeams,
            playerStats,
            roundNumber,
            rotationRandomnessEnabled && reason === "EXCESS_ROTATION"
        );

        if (!plan) {
            continue;
        }

        updatedTeams[teamIndex] = recalculateTeam({
            ...team,
            players: plan.resultingPlayers,
        });
        updatedExcessPlayers = [
            ...updatedExcessPlayers.slice(enteringPlayers.length),
            ...plan.leavingPlayers,
        ].map((player, index) => ({
            ...player,
            positionInTeam: index,
        }));
        markPlayersEntered(playerStats, enteringPlayers, roundNumber);
        markPlayersRemoved(playerStats, plan.leavingPlayers, roundNumber);
        substitutionHistory.push({
            id: createLocalId("substitution"),
            roundNumber,
            teamId: team.id,
            teamLabel: team.label,
            reason,
            enteringPlayers: enteringPlayers.map(toPlayerSnapshot),
            leavingPlayers: plan.leavingPlayers.map(toPlayerSnapshot),
            createdAt: new Date().toISOString(),
        });
    }

    return {
        teams: normalizeTeamOrder(updatedTeams),
        excessPlayers: updatedExcessPlayers,
        substitutionHistory,
    };
}

function createTeamFromPlayers(
    resultId: string,
    players: IAllocatedPlayer[],
    displayNumber: number,
    playOrder: number
) {
    return recalculateTeam({
        id: createLocalId("team"),
        resultId,
        displayNumber,
        playOrder,
        label: `Time ${displayNumber}`,
        playerCount: players.length,
        isOriginalIncompleteTeam: false,
        totalMen: 0,
        totalWomen: 0,
        notaTotalMen: 0,
        notaTotalWomen: 0,
        notaTotal: 0,
        currentWins: 0,
        players,
    });
}

function getNextTeamDisplayNumber(teams: IDrawTeam[]) {
    return teams.reduce((max, team) => Math.max(max, team.displayNumber), 0) + 1;
}

function promoteCompleteExcessGroups(result: IDrawResult) {
    const teams = [...result.teams];
    let excessPlayers = [...result.excessPlayers];
    let nextDisplayNumber = getNextTeamDisplayNumber(teams);

    while (excessPlayers.length >= result.playersPerTeamConfigured) {
        const teamPlayers = excessPlayers
            .slice(0, result.playersPerTeamConfigured)
            .map((player, index) => ({ ...player, positionInTeam: index }));
        teams.push(
            createTeamFromPlayers(result.id, teamPlayers, nextDisplayNumber, teams.length + 1)
        );
        excessPlayers = excessPlayers.slice(result.playersPerTeamConfigured);
        nextDisplayNumber += 1;
    }

    return rebuildResultTotals({
        ...result,
        teams,
        excessPlayers,
    });
}

function resultHasPlayer(result: IDrawResult, playerId: string) {
    return (
        result.teams.some((team) => team.players.some((player) => player.playerId === playerId)) ||
        result.excessPlayers.some((player) => player.playerId === playerId)
    );
}

function updateAllocatedPlayerFromPlayer(player: IAllocatedPlayer, updatedPlayer: IPlayer) {
    if (player.playerId !== updatedPlayer.id) {
        return player;
    }

    return {
        ...player,
        playerName: updatedPlayer.name,
        normalizedName: updatedPlayer.normalizedName,
        gender: updatedPlayer.gender,
        nota: updatedPlayer.nota,
    };
}

function updatePlayerInRotation(result: IDrawResult, updatedPlayer: IPlayer) {
    const updatedResult = rebuildResultTotals({
        ...result,
        teams: result.teams.map((team) => ({
            ...team,
            players: team.players.map((player) =>
                updateAllocatedPlayerFromPlayer(player, updatedPlayer)
            ),
        })),
        excessPlayers: result.excessPlayers.map((player) =>
            updateAllocatedPlayerFromPlayer(player, updatedPlayer)
        ),
    });

    return withUpcomingSubstitutions(updatedResult);
}

function addActivePlayerToRotation(result: IDrawResult, player: IPlayer) {
    if (resultHasPlayer(result, player.id)) {
        return updatePlayerInRotation(result, player);
    }

    const updatedResult = promoteCompleteExcessGroups({
        ...result,
        excessPlayers: [
            ...result.excessPlayers,
            toAllocatedPlayer(player, result.excessPlayers.length),
        ],
    });

    return withUpcomingSubstitutions(updatedResult);
}

interface IReplacementCandidate {
    player: IAllocatedPlayer;
    sourceType: "team" | "excess";
    teamIndex: number | null;
    playerIndex: number;
    score: number[];
}

function selectReplacementCandidate(
    teams: IDrawTeam[],
    excessPlayers: IAllocatedPlayer[],
    targetTeam: IDrawTeam,
    removedPlayer: IAllocatedPlayer,
    playerStats: Record<string, IRotationPlayerStats>,
    roundNumber: number
) {
    const candidates: IReplacementCandidate[] = [];

    teams.forEach((team, teamIndex) => {
        if (teamIndex < 2) {
            return;
        }

        team.players.forEach((player, playerIndex) => {
            const resultingTargetTeam = recalculateTeam({
                ...targetTeam,
                players: [...targetTeam.players, player],
            });
            const sourcePriorityPenalty = Math.max(0, teamIndex - 2);
            const genderMismatch = player.gender === removedPlayer.gender ? 0 : 1;
            const notaDifference = Math.abs(player.nota - removedPlayer.nota);
            const teamBalanceScore = Math.abs(resultingTargetTeam.notaTotal - targetTeam.notaTotal);
            const stats = playerStats[player.playerId];
            const fairnessScore = stats?.lastEnteredRound
                ? Math.max(0, 3 - (roundNumber - stats.lastEnteredRound))
                : 0;

            candidates.push({
                player,
                sourceType: "team",
                teamIndex,
                playerIndex,
                score: [
                    genderMismatch * 30 + notaDifference + sourcePriorityPenalty * 4,
                    sourcePriorityPenalty,
                    teamBalanceScore,
                    fairnessScore,
                    Math.random(),
                ],
            });
        });
    });

    excessPlayers.forEach((player, playerIndex) => {
        const resultingTargetTeam = recalculateTeam({
            ...targetTeam,
            players: [...targetTeam.players, player],
        });
        const genderMismatch = player.gender === removedPlayer.gender ? 0 : 1;
        const notaDifference = Math.abs(player.nota - removedPlayer.nota);
        const teamBalanceScore = Math.abs(resultingTargetTeam.notaTotal - targetTeam.notaTotal);
        const stats = playerStats[player.playerId];
        const fairnessScore = stats?.lastEnteredRound
            ? Math.max(0, 3 - (roundNumber - stats.lastEnteredRound))
            : 0;

        candidates.push({
            player,
            sourceType: "excess",
            teamIndex: null,
            playerIndex,
            score: [
                genderMismatch * 30 + notaDifference + 6,
                1,
                teamBalanceScore,
                fairnessScore,
                Math.random(),
            ],
        });
    });

    return candidates.sort((candidateA, candidateB) =>
        compareNumberTuples(candidateA.score, candidateB.score)
    )[0];
}

function fillCurrentTeamVacancies(
    teams: IDrawTeam[],
    excessPlayers: IAllocatedPlayer[],
    targetTeamIndex: number,
    removedPlayer: IAllocatedPlayer,
    playerStats: Record<string, IRotationPlayerStats>,
    roundNumber: number,
    playersPerTeam: number
) {
    let updatedTeams = normalizeTeamOrder(teams);
    let updatedExcessPlayers = [...excessPlayers];

    while (
        updatedTeams[targetTeamIndex] &&
        updatedTeams[targetTeamIndex].players.length < playersPerTeam
    ) {
        const targetTeam = updatedTeams[targetTeamIndex];
        const candidate = selectReplacementCandidate(
            updatedTeams,
            updatedExcessPlayers,
            targetTeam,
            removedPlayer,
            playerStats,
            roundNumber
        );

        if (!candidate) {
            break;
        }

        updatedTeams[targetTeamIndex] = recalculateTeam({
            ...targetTeam,
            players: [...targetTeam.players, candidate.player],
        });
        markPlayersEntered(playerStats, [candidate.player], roundNumber);

        if (candidate.sourceType === "excess") {
            updatedExcessPlayers = updatedExcessPlayers
                .filter((_, index) => index !== candidate.playerIndex)
                .map((player, index) => ({ ...player, positionInTeam: index }));
            continue;
        }

        if (candidate.teamIndex === null) {
            continue;
        }

        const sourceTeam = updatedTeams[candidate.teamIndex];
        const sourcePlayers = sourceTeam.players.filter(
            (player) => player.playerId !== candidate.player.playerId
        );

        if (sourcePlayers.length < playersPerTeam) {
            updatedExcessPlayers = [...updatedExcessPlayers, ...sourcePlayers].map(
                (player, index) => ({
                    ...player,
                    positionInTeam: index,
                })
            );
            updatedTeams = updatedTeams.filter((_, index) => index !== candidate.teamIndex);
        } else {
            updatedTeams[candidate.teamIndex] = recalculateTeam({
                ...sourceTeam,
                players: sourcePlayers,
            });
        }

        updatedTeams = normalizeTeamOrder(updatedTeams);
    }

    return {
        teams: normalizeTeamOrder(updatedTeams),
        excessPlayers: updatedExcessPlayers,
    };
}

function removePlayerFromRotation(result: IDrawResult, playerId: string) {
    const playerStats = clonePlayerStats(result.playerStats);
    let teams = result.teams.map((team) => ({
        ...team,
        players: [...team.players],
    }));
    let excessPlayers = result.excessPlayers.filter((player) => player.playerId !== playerId);
    let removedFromTeamIndex = -1;
    let removedPlayer: IAllocatedPlayer | null = null;

    teams = teams
        .map((team, teamIndex) => {
            const playerIndex = team.players.findIndex((player) => player.playerId === playerId);

            if (playerIndex < 0) {
                return team;
            }

            removedFromTeamIndex = teamIndex;
            removedPlayer = team.players[playerIndex];

            return {
                ...team,
                players: team.players.filter((player) => player.playerId !== playerId),
            };
        })
        .filter((team, teamIndex) => {
            if (teamIndex < 2 || team.players.length === team.playerCount) {
                return true;
            }

            excessPlayers = [...excessPlayers, ...team.players].map((player, index) => ({
                ...player,
                positionInTeam: index,
            }));
            return false;
        });

    if (removedPlayer && removedFromTeamIndex >= 0 && removedFromTeamIndex < 2) {
        const filledState = fillCurrentTeamVacancies(
            teams,
            excessPlayers,
            removedFromTeamIndex,
            removedPlayer,
            playerStats,
            result.roundNumber,
            result.playersPerTeamConfigured
        );
        teams = filledState.teams;
        excessPlayers = filledState.excessPlayers;
    }

    const rebuiltResult = promoteCompleteExcessGroups({
        ...result,
        teams,
        excessPlayers,
        playerStats,
    });

    return withUpcomingSubstitutions(rebuiltResult);
}

function buildDrawResult(
    players: IPlayer[],
    configuration: IDrawConfiguration,
    hadPreviousResult: boolean
) {
    const now = new Date().toISOString();
    const playerCounts = getPlayerCounts(players);
    const groupedPlayers = buildTeamPlayers(players, configuration.playersPerTeam as number);
    const resultId = createLocalId("result");
    const completeGroupedPlayers = groupedPlayers.filter(
        (teamPlayers) => teamPlayers.length === configuration.playersPerTeam
    );
    const excessPlayers = groupedPlayers
        .filter((teamPlayers) => teamPlayers.length < (configuration.playersPerTeam as number))
        .flatMap((teamPlayers) => teamPlayers)
        .map((player, index) => ({
            ...player,
            positionInTeam: index,
        }));

    const teams = completeGroupedPlayers.map((teamPlayers, index) => {
        const menPlayers = teamPlayers.filter((player) => player.gender === "M");
        const womenPlayers = teamPlayers.filter((player) => player.gender === "F");
        const notaTotalMen = menPlayers.reduce((sum, player) => sum + player.nota, 0);
        const notaTotalWomen = womenPlayers.reduce((sum, player) => sum + player.nota, 0);

        return {
            id: createLocalId("team"),
            resultId,
            displayNumber: index + 1,
            playOrder: index + 1,
            label: `Time ${index + 1}`,
            playerCount: teamPlayers.length,
            isOriginalIncompleteTeam: false,
            totalMen: menPlayers.length,
            totalWomen: womenPlayers.length,
            notaTotalMen,
            notaTotalWomen,
            notaTotal: notaTotalMen + notaTotalWomen,
            currentWins: 0,
            players: teamPlayers,
        } satisfies IDrawTeam;
    });

    const result = withUpcomingSubstitutions(
        rebuildResultTotals({
            id: resultId,
            configurationId: configuration.id,
            totalPlayers: playerCounts.totalPlayers,
            totalMen: playerCounts.totalMen,
            totalWomen: playerCounts.totalWomen,
            playersPerTeamConfigured: configuration.playersPerTeam as number,
            totalTeams: teams.length,
            hasIncompleteTeam: excessPlayers.length > 0,
            incompleteTeamIndex: null,
            status: "ATIVO",
            createdAt: now,
            updatedAt: now,
            teams,
            excessPlayers,
            roundNumber: 1,
            playerStats: {},
            substitutionHistory: [],
            manualSwapHistory: [],
            matchHistory: [],
            upcomingSubstitutions: [],
            lastRotationSummary: null,
            lastSwapImpact: null,
        }),
        configuration.rotationRandomnessEnabled
    );

    return {
        replacedExistingResult: hadPreviousResult,
        result,
    } satisfies IGenerateDrawResponse;
}

export async function getApplicationState() {
    const storedPlayers = safeReadStoredValue(PLAYERS_STORAGE_KEY, validatePlayers);
    const storedConfiguration = safeReadStoredValue(
        CONFIGURATION_STORAGE_KEY,
        validateConfiguration
    );
    const storedResult = safeReadStoredValue(RESULT_STORAGE_KEY, validateDrawResult);
    const hasStoredData =
        storedPlayers.hasStoredValue ||
        storedConfiguration.hasStoredValue ||
        storedResult.hasStoredValue;

    if (storedPlayers.hasError || storedConfiguration.hasError) {
        return {
            players: storedPlayers.value || [],
            configuration: storedConfiguration.value,
            result: null,
            restoration: {
                status: "read-error",
                message: "Não foi possível restaurar os dados salvos.",
                hasStoredData,
                hasInvalidStoredResult: storedResult.hasStoredValue,
            },
        } satisfies IApplicationSnapshot;
    }

    if (storedResult.hasError) {
        return {
            players: storedPlayers.value || [],
            configuration: storedConfiguration.value,
            result: null,
            restoration: {
                status: "invalid-result",
                message: "O resultado salvo apresenta inconsistencias e precisa ser limpo.",
                hasStoredData,
                hasInvalidStoredResult: true,
            },
        } satisfies IApplicationSnapshot;
    }

    if (!hasStoredData) {
        return {
            players: [],
            configuration: null,
            result: null,
            restoration: {
                status: "empty",
                hasStoredData: false,
                hasInvalidStoredResult: false,
            },
        } satisfies IApplicationSnapshot;
    }

    return {
        players: storedPlayers.value || [],
        configuration: storedConfiguration.value,
        result: storedResult.value
            ? withUpcomingSubstitutions(
                  storedResult.value,
                  storedConfiguration.value?.rotationRandomnessEnabled
              )
            : null,
        restoration: {
            status: "success",
            message: "Dados restaurados com sucesso.",
            hasStoredData: true,
            hasInvalidStoredResult: false,
        },
    } satisfies IApplicationSnapshot;
}

export async function listPlayers(params: IPlayerListParams) {
    const players = readPlayersOrThrow();
    const normalizedSearch = normalizePlayerName(params.search || "");
    const filteredPlayers = players
        .filter((player) => {
            const matchesSearch =
                !normalizedSearch || player.normalizedName.includes(normalizedSearch);
            const matchesGender = !params.gender || player.gender === params.gender;
            const matchesStatus =
                params.isActive === undefined || player.isActive === params.isActive;
            return matchesSearch && matchesGender && matchesStatus;
        })
        .sort((playerA, playerB) => playerA.name.localeCompare(playerB.name, "pt-BR"));

    const currentPage = params.page || 0;
    const itemsPerPage = params.perPage || DEFAULT_ROWS_PER_PAGE;
    const startIndex = currentPage * itemsPerPage;

    return {
        data: filteredPlayers.slice(startIndex, startIndex + itemsPerPage),
        count: filteredPlayers.length,
        page: currentPage,
    } satisfies IPaginatedResponse<IPlayer>;
}

export async function createPlayer(data: ICreatePlayerRequest) {
    const players = readPlayersOrThrow();
    assertValidPlayerName(data.name);
    assertValidGender(data.gender);
    assertValidNota(data.nota);
    const normalizedName = ensureUniquePlayerName(players, data.name);
    const now = new Date().toISOString();

    const newPlayer: IPlayer = {
        id: createLocalId("player"),
        name: sanitizePlayerName(data.name),
        normalizedName,
        gender: data.gender,
        nota: data.nota,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };

    persistPlayers([...players, newPlayer]);
    const currentResult = readValidResultSafely();

    if (currentResult) {
        persistResult(addActivePlayerToRotation(currentResult, newPlayer));
    }

    return newPlayer;
}

export async function updatePlayer(playerId: string, data: IUpdatePlayerRequest) {
    const players = readPlayersOrThrow();
    const playerIndex = players.findIndex((player) => player.id === playerId);

    if (playerIndex < 0) {
        throw createError(SORTITION_ERROR_CODES.playerNotFound);
    }

    assertValidPlayerName(data.name);
    assertValidGender(data.gender);
    assertValidNota(data.nota);
    const normalizedName = ensureUniquePlayerName(players, data.name, playerId);
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        name: sanitizePlayerName(data.name),
        normalizedName,
        gender: data.gender,
        nota: data.nota,
        updatedAt: new Date().toISOString(),
    };

    persistPlayers(updatedPlayers);
    const currentResult = readValidResultSafely();

    if (currentResult) {
        persistResult(
            updatedPlayers[playerIndex].isActive
                ? updatePlayerInRotation(currentResult, updatedPlayers[playerIndex])
                : removePlayerFromRotation(currentResult, updatedPlayers[playerIndex].id)
        );
    }

    return updatedPlayers[playerIndex];
}

export async function deletePlayer(playerId: string) {
    const players = readPlayersOrThrow();
    const filteredPlayers = players.filter((player) => player.id !== playerId);

    if (filteredPlayers.length === players.length) {
        throw createError(SORTITION_ERROR_CODES.playerNotFound);
    }

    persistPlayers(filteredPlayers);
    const currentResult = readValidResultSafely();

    if (currentResult) {
        persistResult(removePlayerFromRotation(currentResult, playerId));
    }

    return true;
}

export async function setPlayerActiveStatus(playerId: string, isActive: boolean) {
    const players = readPlayersOrThrow();
    const playerIndex = players.findIndex((player) => player.id === playerId);

    if (playerIndex < 0) {
        throw createError(SORTITION_ERROR_CODES.playerNotFound);
    }

    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        isActive,
        updatedAt: new Date().toISOString(),
    };

    persistPlayers(updatedPlayers);
    const currentResult = readValidResultSafely();

    if (currentResult) {
        persistResult(
            isActive
                ? addActivePlayerToRotation(currentResult, updatedPlayers[playerIndex])
                : removePlayerFromRotation(currentResult, playerId)
        );
    }

    return updatedPlayers[playerIndex];
}

export async function clearPlayers() {
    const hadResult = Boolean(StorageManager.getItem(RESULT_STORAGE_KEY));
    persistPlayers([]);

    if (hadResult) {
        removeStoredResult();
    }

    return {
        removedResult: hadResult,
    } satisfies IClearPlayersResponse;
}

export async function saveConfiguration(data: ISaveDrawConfigurationRequest) {
    assertValidConfiguration(data.playersPerTeam, data.maxConsecutiveWins);
    const currentConfiguration = readConfigurationOrThrow();

    const configuration: IDrawConfiguration = {
        id: currentConfiguration?.id || "sortition-configuration",
        playersPerTeam: data.playersPerTeam,
        maxConsecutiveWins: data.maxConsecutiveWins,
        doubleExitOnMaxWins: data.doubleExitOnMaxWins,
        rotationRandomnessEnabled: data.rotationRandomnessEnabled,
        updatedAt: new Date().toISOString(),
    };

    persistConfiguration(configuration);
    return configuration;
}

export async function generateDraw() {
    const players = filterActivePlayers(readPlayersOrThrow());
    const configuration = readConfigurationOrThrow();
    const currentStoredResult = safeReadStoredValue(RESULT_STORAGE_KEY, validateDrawResult);

    if (!configuration || !configuration.playersPerTeam) {
        throw createError(SORTITION_ERROR_CODES.configurationInvalid);
    }

    assertValidConfiguration(configuration.playersPerTeam, configuration.maxConsecutiveWins);
    const drawResponse = buildDrawResult(
        players,
        configuration,
        currentStoredResult.hasStoredValue
    );
    persistResult(drawResponse.result);
    return drawResponse;
}

export async function clearDrawResult() {
    if (!hasStoredResultValue()) {
        throw createError(SORTITION_ERROR_CODES.resultNotFound);
    }

    removeStoredResult();
    return true;
}

export async function confirmMatchWinner(data: IConfirmMatchWinnerRequest) {
    const currentResult = readResultOrThrow();
    const configuration = readConfigurationOrThrow();

    if (!currentResult) {
        throw createError(SORTITION_ERROR_CODES.resultNotFound);
    }

    if (currentResult.teams.length < 2) {
        throw createError(SORTITION_ERROR_CODES.resultInvalid);
    }

    const currentTeams = currentResult.teams.slice(0, 2);
    const winnerIndex = currentTeams.findIndex((team) => team.id === data.winnerTeamId);

    if (winnerIndex < 0) {
        throw createError(SORTITION_ERROR_CODES.winnerInvalid);
    }

    const loserIndex = winnerIndex === 0 ? 1 : 0;
    const winnerTeamBefore = currentTeams[winnerIndex];
    const loserTeamBefore = currentTeams[loserIndex];
    const maxConsecutiveWins = configuration?.maxConsecutiveWins || DEFAULT_MAX_CONSECUTIVE_WINS;
    const winnerWinsAfter = winnerTeamBefore.currentWins + 1;
    const reachedWinLimit = winnerWinsAfter >= maxConsecutiveWins;
    const doubleExitApplied = Boolean(
        reachedWinLimit && configuration?.doubleExitOnMaxWins && currentResult.teams.length >= 4
    );
    const playerStats = clonePlayerStats(currentResult.playerStats);
    const updatedCurrentTeams = currentTeams.map((team) => {
        if (team.id === winnerTeamBefore.id) {
            return {
                ...team,
                currentWins: winnerWinsAfter,
            };
        }

        return {
            ...team,
            currentWins: 0,
        };
    });
    const exitingTeamIds = reachedWinLimit
        ? doubleExitApplied
            ? [winnerTeamBefore.id, loserTeamBefore.id]
            : [winnerTeamBefore.id]
        : [loserTeamBefore.id];
    const exitingTeams = exitingTeamIds
        .map((teamId) => updatedCurrentTeams.find((team) => team.id === teamId))
        .filter((team): team is IDrawTeam => Boolean(team))
        .map((team) => ({
            ...team,
            currentWins: 0,
        }));
    const exitingTeamIdSet = new Set(exitingTeamIds);
    const stayingTeams = updatedCurrentTeams.filter((team) => !exitingTeamIdSet.has(team.id));
    const waitingTeams = currentResult.teams.slice(2);
    const rotationQueue = [...waitingTeams, ...exitingTeams];
    const nextCurrentTeams = [...stayingTeams];
    const incomingTeamIds: string[] = [];

    while (nextCurrentTeams.length < 2 && rotationQueue.length > 0) {
        const incomingTeam = rotationQueue.shift();

        if (!incomingTeam) {
            break;
        }

        nextCurrentTeams.push(incomingTeam);
        incomingTeamIds.push(incomingTeam.id);
    }

    const rotatedTeams = normalizeTeamOrder([...nextCurrentTeams, ...rotationQueue]);
    const substitutionState = applyAutomaticSubstitutions(
        rotatedTeams,
        currentResult.excessPlayers,
        exitingTeamIds,
        playerStats,
        currentResult.roundNumber,
        "EXCESS_ROTATION",
        Boolean(configuration?.rotationRandomnessEnabled)
    );
    const now = new Date().toISOString();
    const matchHistory: IMatchHistory = {
        id: createLocalId("match"),
        roundNumber: currentResult.roundNumber,
        winnerTeamId: winnerTeamBefore.id,
        winnerTeamLabel: winnerTeamBefore.label,
        loserTeamId: loserTeamBefore.id,
        loserTeamLabel: loserTeamBefore.label,
        winnerPlayerIds: winnerTeamBefore.players.map((player) => player.playerId),
        loserPlayerIds: loserTeamBefore.players.map((player) => player.playerId),
        winnerPlayers: winnerTeamBefore.players.map((player) => player.playerName),
        loserPlayers: loserTeamBefore.players.map((player) => player.playerName),
        winnerWinsBefore: winnerTeamBefore.currentWins,
        winnerWinsAfter,
        maxConsecutiveWins,
        reachedWinLimit,
        doubleExitApplied,
        exitedTeamIds: exitingTeamIds,
        createdAt: now,
    };
    const lastRotationSummary: IRotationSummary = {
        roundNumber: currentResult.roundNumber,
        winnerTeamId: winnerTeamBefore.id,
        winnerTeamLabel: winnerTeamBefore.label,
        loserTeamId: loserTeamBefore.id,
        loserTeamLabel: loserTeamBefore.label,
        exitedTeamLabels: exitingTeams.map((team) => team.label),
        enteredTeamLabels: incomingTeamIds
            .map((teamId) => rotatedTeams.find((team) => team.id === teamId)?.label)
            .filter((label): label is string => Boolean(label)),
        reachedWinLimit,
        doubleExitApplied,
        createdAt: now,
    };
    const updatedResult = withUpcomingSubstitutions(
        rebuildResultTotals(
            {
                ...currentResult,
                teams: substitutionState.teams,
                excessPlayers: substitutionState.excessPlayers,
                roundNumber: currentResult.roundNumber + 1,
                playerStats,
                substitutionHistory: [
                    ...currentResult.substitutionHistory,
                    ...substitutionState.substitutionHistory,
                ],
                matchHistory: [...currentResult.matchHistory, matchHistory],
                lastRotationSummary,
                lastSwapImpact: null,
            },
            now
        ),
        Boolean(configuration?.rotationRandomnessEnabled)
    );

    persistResult(updatedResult);
    return updatedResult;
}

export async function confirmManualSwap(data: IConfirmManualSwapRequest) {
    if (!data.firstPlayerId || !data.secondPlayerId) {
        throw createError(SORTITION_ERROR_CODES.swapIncompleteSelection);
    }

    const currentResult = readResultOrThrow();
    const configuration = readConfigurationOrThrow();

    if (!currentResult) {
        throw createError(SORTITION_ERROR_CODES.resultNotFound);
    }

    const teams = currentResult.teams.map((team) => ({
        ...team,
        players: [...team.players],
    }));
    const excessPlayers = [...currentResult.excessPlayers];

    const findPlayerLocation = (playerId: string) => {
        for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
            const playerIndex = teams[teamIndex].players.findIndex(
                (player) => player.playerId === playerId
            );

            if (playerIndex >= 0) {
                return {
                    groupId: teams[teamIndex].id,
                    groupLabel: teams[teamIndex].label,
                    groupType: "team" as const,
                    teamIndex,
                    playerIndex,
                    player: teams[teamIndex].players[playerIndex],
                };
            }
        }

        const excessPlayerIndex = excessPlayers.findIndex((player) => player.playerId === playerId);

        if (excessPlayerIndex >= 0) {
            return {
                groupId: "excess",
                groupLabel: "Excedentes",
                groupType: "excess" as const,
                teamIndex: -1,
                playerIndex: excessPlayerIndex,
                player: excessPlayers[excessPlayerIndex],
            };
        }

        return null;
    };

    const firstLocation = findPlayerLocation(data.firstPlayerId);
    const secondLocation = findPlayerLocation(data.secondPlayerId);

    if (!firstLocation || !secondLocation || !firstLocation.player || !secondLocation.player) {
        throw createError(SORTITION_ERROR_CODES.swapInvalidStructure);
    }

    if (firstLocation.groupId === secondLocation.groupId) {
        throw createError(SORTITION_ERROR_CODES.swapSameTeam);
    }

    const playerA = firstLocation.player;
    const playerB = secondLocation.player;

    if (firstLocation.groupType === "team") {
        teams[firstLocation.teamIndex].players[firstLocation.playerIndex] = {
            ...playerB,
            allocationId:
                teams[firstLocation.teamIndex].players[firstLocation.playerIndex].allocationId,
            positionInTeam: firstLocation.playerIndex,
        };
    } else {
        excessPlayers[firstLocation.playerIndex] = {
            ...playerB,
            allocationId: excessPlayers[firstLocation.playerIndex].allocationId,
            positionInTeam: firstLocation.playerIndex,
        };
    }

    if (secondLocation.groupType === "team") {
        teams[secondLocation.teamIndex].players[secondLocation.playerIndex] = {
            ...playerA,
            allocationId:
                teams[secondLocation.teamIndex].players[secondLocation.playerIndex].allocationId,
            positionInTeam: secondLocation.playerIndex,
        };
    } else {
        excessPlayers[secondLocation.playerIndex] = {
            ...playerA,
            allocationId: excessPlayers[secondLocation.playerIndex].allocationId,
            positionInTeam: secondLocation.playerIndex,
        };
    }

    const now = new Date().toISOString();
    const playerStats = clonePlayerStats(currentResult.playerStats);
    ensurePlayerStats(playerStats, playerA.playerId).manualSwapRounds.push(
        currentResult.roundNumber
    );
    ensurePlayerStats(playerStats, playerB.playerId).manualSwapRounds.push(
        currentResult.roundNumber
    );

    const manualSwapHistory: IManualSwapHistory = {
        id: createLocalId("manual-swap"),
        roundNumber: currentResult.roundNumber,
        firstGroupId: firstLocation.groupId,
        firstGroupLabel: firstLocation.groupLabel,
        firstPlayerId: playerA.playerId,
        firstPlayerName: playerA.playerName,
        secondGroupId: secondLocation.groupId,
        secondGroupLabel: secondLocation.groupLabel,
        secondPlayerId: playerB.playerId,
        secondPlayerName: playerB.playerName,
        createdAt: now,
    };
    const updatedResult = withUpcomingSubstitutions(
        rebuildResultTotals(
            {
                ...currentResult,
                teams: teams.map((team) => recalculateTeam(team)),
                excessPlayers: excessPlayers.map((player, index) => ({
                    ...player,
                    positionInTeam: index,
                })),
                playerStats,
                manualSwapHistory: [...currentResult.manualSwapHistory, manualSwapHistory],
                lastSwapImpact: {
                    resultId: currentResult.id,
                    teamAId: firstLocation.groupId,
                    playerLeftTeamAId: playerA.playerId,
                    playerEnteredTeamAId: playerB.playerId,
                    teamBId: secondLocation.groupId,
                    playerLeftTeamBId: playerB.playerId,
                    playerEnteredTeamBId: playerA.playerId,
                    updatedAt: now,
                },
            },
            now
        ),
        Boolean(configuration?.rotationRandomnessEnabled)
    );

    if (!isStoredResultStructurallyValid(updatedResult)) {
        throw createError(SORTITION_ERROR_CODES.swapInvalidStructure);
    }

    persistResult(updatedResult);
    return updatedResult;
}
