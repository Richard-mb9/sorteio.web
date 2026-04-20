import { toast } from "react-toastify";
import { useUtils } from "../contexts/UtilsContext";
import {
    type IApplicationSnapshot,
    type IDrawConfiguration,
    type IDrawResult,
    type IPlayer,
} from "../commons/sortition";
import {
    type IClearPlayersResponse,
    type IConfirmManualSwapRequest,
    type ICreatePlayerRequest,
    type IGenerateDrawResponse,
    type IPlayerListParams,
    type ISaveDrawConfigurationRequest,
    type IUpdatePlayerRequest,
    SORTITION_ERROR_CODES,
    SortitionDomainError,
    clearDrawResult,
    clearPlayers,
    confirmManualSwap,
    createPlayer,
    deletePlayer,
    generateDraw,
    getApplicationState,
    listPlayers,
    saveConfiguration,
    setPlayerActiveStatus,
    updatePlayer,
} from "./integrations/sortition";
import { type IPaginatedResponse } from "./integrations/types";

interface IUseSortition {
    getApplicationStateSnapshot: () => Promise<IApplicationSnapshot | undefined>;
    getPlayers: (params: IPlayerListParams) => Promise<IPaginatedResponse<IPlayer> | undefined>;
    createNewPlayer: (data: ICreatePlayerRequest) => Promise<IPlayer | undefined>;
    updateExistingPlayer: (
        playerId: string,
        data: IUpdatePlayerRequest
    ) => Promise<IPlayer | undefined>;
    setExistingPlayerActivity: (
        playerId: string,
        isActive: boolean
    ) => Promise<IPlayer | undefined>;
    deleteExistingPlayer: (playerId: string) => Promise<boolean>;
    clearExistingPlayers: () => Promise<IClearPlayersResponse | undefined>;
    saveDrawConfiguration: (
        data: ISaveDrawConfigurationRequest
    ) => Promise<IDrawConfiguration | undefined>;
    generateNewDraw: () => Promise<IGenerateDrawResponse | undefined>;
    clearExistingResult: () => Promise<boolean>;
    confirmDrawSwap: (data: IConfirmManualSwapRequest) => Promise<IDrawResult | undefined>;
}

function getStorageErrorMessage() {
    return "Nao foi possivel carregar os dados salvos.";
}

function getDrawIneligibleMessage(error: SortitionDomainError) {
    const currentPlayers = Number(error.details?.currentPlayers || 0);
    const minimumPlayers = Number(error.details?.minimumPlayers || 0);
    return `Nao ha jogadores suficientes para iniciar o sorteio. Atual: ${currentPlayers}. Minimo necessario: ${minimumPlayers}.`;
}

export default function useSortition(): IUseSortition {
    const { setIsLoading } = useUtils();

    const getApplicationStateSnapshot = async () => {
        try {
            setIsLoading(true);
            return await getApplicationState();
        } catch {
            toast.error(getStorageErrorMessage());
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const getPlayers = async (params: IPlayerListParams) => {
        try {
            setIsLoading(true);
            return await listPlayers(params);
        } catch {
            toast.error(getStorageErrorMessage());
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const createNewPlayer = async (data: ICreatePlayerRequest) => {
        try {
            setIsLoading(true);
            const player = await createPlayer(data);
            toast.success("Jogador adicionado com sucesso.");
            return player;
        } catch (error) {
            if (error instanceof SortitionDomainError) {
                if (error.code === SORTITION_ERROR_CODES.playerDuplicate) {
                    toast.error("Ja existe um jogador com esse nome.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.playerNameRequired) {
                    toast.error("Informe o nome do jogador.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.playerGenderRequired) {
                    toast.error("Selecione o genero do jogador.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.storageRead) {
                    toast.error(getStorageErrorMessage());
                    return;
                }
            }

            toast.error("Nao foi possivel salvar o jogador.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const updateExistingPlayer = async (playerId: string, data: IUpdatePlayerRequest) => {
        try {
            setIsLoading(true);
            const player = await updatePlayer(playerId, data);
            toast.success("Jogador atualizado com sucesso.");
            return player;
        } catch (error) {
            if (error instanceof SortitionDomainError) {
                if (error.code === SORTITION_ERROR_CODES.playerDuplicate) {
                    toast.error("Ja existe um jogador com esse nome.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.playerNameRequired) {
                    toast.error("Informe o nome do jogador.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.playerGenderRequired) {
                    toast.error("Selecione o genero do jogador.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.storageRead) {
                    toast.error(getStorageErrorMessage());
                    return;
                }
            }

            toast.error("Nao foi possivel atualizar o jogador.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteExistingPlayer = async (playerId: string) => {
        try {
            setIsLoading(true);
            await deletePlayer(playerId);
            toast.success("Jogador removido com sucesso.");
            return true;
        } catch (error) {
            if (
                error instanceof SortitionDomainError &&
                error.code === SORTITION_ERROR_CODES.storageRead
            ) {
                toast.error(getStorageErrorMessage());
                return false;
            }

            toast.error("Nao foi possivel remover o jogador.");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const setExistingPlayerActivity = async (playerId: string, isActive: boolean) => {
        try {
            setIsLoading(true);
            const player = await setPlayerActiveStatus(playerId, isActive);
            toast.success(
                isActive ? "Jogador ativado com sucesso." : "Jogador inativado com sucesso."
            );
            return player;
        } catch (error) {
            if (
                error instanceof SortitionDomainError &&
                error.code === SORTITION_ERROR_CODES.storageRead
            ) {
                toast.error(getStorageErrorMessage());
                return;
            }

            toast.error(
                isActive
                    ? "Nao foi possivel ativar o jogador."
                    : "Nao foi possivel inativar o jogador."
            );
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const clearExistingPlayers = async () => {
        try {
            setIsLoading(true);
            const response = await clearPlayers();
            toast.success("Todos os jogadores foram removidos com sucesso.");

            if (response.removedResult) {
                toast.success(
                    "O resultado existente foi limpo porque dependia dos jogadores removidos."
                );
            }

            return response;
        } catch {
            toast.error("Nao foi possivel limpar a lista de jogadores.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const saveDrawConfiguration = async (data: ISaveDrawConfigurationRequest) => {
        try {
            setIsLoading(true);
            const configuration = await saveConfiguration(data);
            toast.success("Configuracao salva com sucesso.");
            return configuration;
        } catch (error) {
            if (
                error instanceof SortitionDomainError &&
                error.code === SORTITION_ERROR_CODES.configurationInvalid
            ) {
                toast.error("Informe uma quantidade valida de jogadores por time.");
                return;
            }

            toast.error("Nao foi possivel salvar a configuracao.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const generateNewDraw = async () => {
        try {
            setIsLoading(true);
            const response = await generateDraw();
            toast.success(
                response.replacedExistingResult
                    ? "Novo sorteio gerado com sucesso."
                    : "Sorteio gerado com sucesso."
            );
            return response;
        } catch (error) {
            if (error instanceof SortitionDomainError) {
                if (error.code === SORTITION_ERROR_CODES.configurationInvalid) {
                    toast.error("Informe uma quantidade valida de jogadores por time.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.drawIneligible) {
                    toast.error(getDrawIneligibleMessage(error));
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.storageRead) {
                    toast.error(getStorageErrorMessage());
                    return;
                }
            }

            toast.error("Nao foi possivel gerar o sorteio.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const clearExistingResult = async () => {
        try {
            setIsLoading(true);
            await clearDrawResult();
            toast.success("Resultado limpo com sucesso.");
            return true;
        } catch (error) {
            if (
                error instanceof SortitionDomainError &&
                error.code === SORTITION_ERROR_CODES.resultNotFound
            ) {
                toast.error("Nao existe resultado salvo para limpar.");
                return false;
            }

            toast.error("Nao foi possivel limpar o resultado.");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDrawSwap = async (data: IConfirmManualSwapRequest) => {
        try {
            setIsLoading(true);
            const result = await confirmManualSwap(data);
            toast.success("Troca realizada com sucesso.");
            return result;
        } catch (error) {
            if (error instanceof SortitionDomainError) {
                if (error.code === SORTITION_ERROR_CODES.resultNotFound) {
                    toast.error("Nao existe resultado salvo para editar.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.swapIncompleteSelection) {
                    toast.error("Selecione um jogador de cada time para trocar.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.swapSameTeam) {
                    toast.error("Nao e permitido trocar jogadores do mesmo time.");
                    return;
                }

                if (
                    error.code === SORTITION_ERROR_CODES.swapInvalidStructure ||
                    error.code === SORTITION_ERROR_CODES.resultInvalid
                ) {
                    toast.error("A troca selecionada gera inconsistencias na estrutura dos times.");
                    return;
                }
            }

            toast.error("Nao foi possivel confirmar a troca.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        getApplicationStateSnapshot,
        getPlayers,
        createNewPlayer,
        updateExistingPlayer,
        setExistingPlayerActivity,
        deleteExistingPlayer,
        clearExistingPlayers,
        saveDrawConfiguration,
        generateNewDraw,
        clearExistingResult,
        confirmDrawSwap,
    };
}
