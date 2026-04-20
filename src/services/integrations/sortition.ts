import { APPLICATION_STORAGE_NAMESPACE } from "../../config";
import StorageManager from "../../commons/StorageManager";
import { DEFAULT_ROWS_PER_PAGE } from "../../commons/queryParams";
import {
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
    type IAllocatedPlayer,
    type IApplicationSnapshot,
    type IDrawConfiguration,
    type IDrawResult,
    type IDrawTeam,
    type IManualSwapImpact,
    type IPlayer,
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

    const { id, playersPerTeam, updatedAt } = value;

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
        result.totalTeams < 2 ||
        (result.incompleteTeamIndex !== null && !Number.isInteger(result.incompleteTeamIndex)) ||
        result.status !== "ATIVO" ||
        typeof result.createdAt !== "string" ||
        typeof result.updatedAt !== "string" ||
        result.teams.length !== result.totalTeams
    ) {
        return false;
    }

    const seenPlayerIds = new Set<string>();
    let totalMen = 0;
    let totalWomen = 0;
    let totalPlayers = 0;
    const incompleteTeamIndexes: number[] = [];

    for (let index = 0; index < result.teams.length; index += 1) {
        const team = result.teams[index];

        if (
            team.displayNumber !== index + 1 ||
            team.playOrder !== index + 1 ||
            team.players.length !== team.playerCount ||
            team.totalMen + team.totalWomen !== team.playerCount
        ) {
            return false;
        }

        const menInTeam = team.players.filter((player) => player.gender === "M").length;
        const womenInTeam = team.players.length - menInTeam;

        if (menInTeam !== team.totalMen || womenInTeam !== team.totalWomen) {
            return false;
        }

        if (team.playerCount < result.playersPerTeamConfigured) {
            incompleteTeamIndexes.push(index);
        }

        if (
            team.isOriginalIncompleteTeam !==
            (team.playerCount < result.playersPerTeamConfigured &&
                index === result.teams.length - 1)
        ) {
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

    if (incompleteTeamIndexes.length > 1) {
        return false;
    }

    if (
        incompleteTeamIndexes.length === 1 &&
        incompleteTeamIndexes[0] !== result.teams.length - 1
    ) {
        return false;
    }

    if (result.hasIncompleteTeam !== (incompleteTeamIndexes.length === 1)) {
        return false;
    }

    const expectedIncompleteIndex =
        incompleteTeamIndexes.length === 1 ? result.teams.length - 1 : null;

    if (result.incompleteTeamIndex !== expectedIncompleteIndex) {
        return false;
    }

    return (
        totalPlayers === result.totalPlayers &&
        totalMen === result.totalMen &&
        totalWomen === result.totalWomen
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

    const parsedResult: IDrawResult = {
        id,
        configurationId,
        totalPlayers: Number(totalPlayers),
        totalMen: Number(totalMen),
        totalWomen: Number(totalWomen),
        playersPerTeamConfigured: Number(playersPerTeamConfigured),
        totalTeams: Number(totalTeams),
        hasIncompleteTeam,
        incompleteTeamIndex: incompleteTeamIndex === null ? null : Number(incompleteTeamIndex),
        status,
        createdAt,
        updatedAt,
        teams: parsedTeams as IDrawTeam[],
        lastSwapImpact: lastSwapImpact ? validateSwapImpact(lastSwapImpact) : null,
    };

    if (!isStoredResultStructurallyValid(parsedResult)) {
        return null;
    }

    return parsedResult;
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

function assertValidConfiguration(playersPerTeam: number) {
    if (!Number.isInteger(playersPerTeam) || playersPerTeam <= 0) {
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

function buildDrawResult(
    players: IPlayer[],
    configuration: IDrawConfiguration,
    hadPreviousResult: boolean
) {
    const now = new Date().toISOString();
    const preview = calculateDrawPreview(players.length, configuration.playersPerTeam);
    const playerCounts = getPlayerCounts(players);
    const groupedPlayers = buildTeamPlayers(players, configuration.playersPerTeam as number);
    const resultId = createLocalId("result");

    const teams = groupedPlayers.map((teamPlayers, index) => {
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
            isOriginalIncompleteTeam:
                preview.hasIncompleteTeam && index === groupedPlayers.length - 1,
            totalMen: menPlayers.length,
            totalWomen: womenPlayers.length,
            notaTotalMen,
            notaTotalWomen,
            notaTotal: notaTotalMen + notaTotalWomen,
            players: teamPlayers,
        } satisfies IDrawTeam;
    });

    return {
        replacedExistingResult: hadPreviousResult,
        result: {
            id: resultId,
            configurationId: configuration.id,
            totalPlayers: playerCounts.totalPlayers,
            totalMen: playerCounts.totalMen,
            totalWomen: playerCounts.totalWomen,
            playersPerTeamConfigured: configuration.playersPerTeam as number,
            totalTeams: teams.length,
            hasIncompleteTeam: preview.hasIncompleteTeam,
            incompleteTeamIndex: preview.hasIncompleteTeam ? teams.length - 1 : null,
            status: "ATIVO",
            createdAt: now,
            updatedAt: now,
            teams,
            lastSwapImpact: null,
        } satisfies IDrawResult,
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
                message: "Nao foi possivel restaurar os dados salvos.",
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
        result: storedResult.value,
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
    return updatedPlayers[playerIndex];
}

export async function deletePlayer(playerId: string) {
    const players = readPlayersOrThrow();
    const filteredPlayers = players.filter((player) => player.id !== playerId);

    if (filteredPlayers.length === players.length) {
        throw createError(SORTITION_ERROR_CODES.playerNotFound);
    }

    persistPlayers(filteredPlayers);
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
    assertValidConfiguration(data.playersPerTeam);
    const currentConfiguration = readConfigurationOrThrow();

    const configuration: IDrawConfiguration = {
        id: currentConfiguration?.id || "sortition-configuration",
        playersPerTeam: data.playersPerTeam,
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

    assertValidConfiguration(configuration.playersPerTeam);
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

export async function confirmManualSwap(data: IConfirmManualSwapRequest) {
    if (!data.firstPlayerId || !data.secondPlayerId) {
        throw createError(SORTITION_ERROR_CODES.swapIncompleteSelection);
    }

    const currentResult = readResultOrThrow();

    if (!currentResult) {
        throw createError(SORTITION_ERROR_CODES.resultNotFound);
    }

    const teams = currentResult.teams.map((team) => ({
        ...team,
        players: [...team.players],
    }));

    let firstPlayerTeamIndex = -1;
    let firstPlayerIndex = -1;
    let secondPlayerTeamIndex = -1;
    let secondPlayerIndex = -1;

    teams.forEach((team, teamIndex) => {
        const currentFirstPlayerIndex = team.players.findIndex(
            (player) => player.playerId === data.firstPlayerId
        );
        const currentSecondPlayerIndex = team.players.findIndex(
            (player) => player.playerId === data.secondPlayerId
        );

        if (currentFirstPlayerIndex >= 0) {
            firstPlayerTeamIndex = teamIndex;
            firstPlayerIndex = currentFirstPlayerIndex;
        }

        if (currentSecondPlayerIndex >= 0) {
            secondPlayerTeamIndex = teamIndex;
            secondPlayerIndex = currentSecondPlayerIndex;
        }
    });

    if (firstPlayerTeamIndex < 0 || secondPlayerTeamIndex < 0) {
        throw createError(SORTITION_ERROR_CODES.swapInvalidStructure);
    }

    if (firstPlayerTeamIndex === secondPlayerTeamIndex) {
        throw createError(SORTITION_ERROR_CODES.swapSameTeam);
    }

    const teamA = teams[firstPlayerTeamIndex];
    const teamB = teams[secondPlayerTeamIndex];
    const playerA = teamA.players[firstPlayerIndex];
    const playerB = teamB.players[secondPlayerIndex];

    if (!playerA || !playerB) {
        throw createError(SORTITION_ERROR_CODES.swapInvalidStructure);
    }

    teamA.players[firstPlayerIndex] = {
        ...playerB,
        allocationId: teamA.players[firstPlayerIndex].allocationId,
        positionInTeam: firstPlayerIndex,
    };
    teamB.players[secondPlayerIndex] = {
        ...playerA,
        allocationId: teamB.players[secondPlayerIndex].allocationId,
        positionInTeam: secondPlayerIndex,
    };

    const recalculatedTeams = teams.map((team) => recalculateTeam(team));
    const updatedResult: IDrawResult = {
        ...currentResult,
        teams: recalculatedTeams,
        updatedAt: new Date().toISOString(),
        lastSwapImpact: {
            resultId: currentResult.id,
            teamAId: teamA.id,
            playerLeftTeamAId: playerA.playerId,
            playerEnteredTeamAId: playerB.playerId,
            teamBId: teamB.id,
            playerLeftTeamBId: playerB.playerId,
            playerEnteredTeamBId: playerA.playerId,
            updatedAt: new Date().toISOString(),
        },
    };

    if (!isStoredResultStructurallyValid(updatedResult)) {
        throw createError(SORTITION_ERROR_CODES.swapInvalidStructure);
    }

    persistResult(updatedResult);
    return updatedResult;
}
