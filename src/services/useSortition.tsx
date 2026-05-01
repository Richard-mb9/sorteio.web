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
    type IConfirmMatchWinnerRequest,
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
    confirmMatchWinner,
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
    confirmWinner: (data: IConfirmMatchWinnerRequest) => Promise<IDrawResult | undefined>;
}

function getStorageErrorMessage() {
    return "Não foi possível carregar os dados salvos.";
}

function getDrawIneligibleMessage(error: SortitionDomainError) {
    const currentPlayers = Number(error.details?.currentPlayers || 0);
    const minimumPlayers = Number(error.details?.minimumPlayers || 0);
    return `Não há jogadores suficientes para iniciar o sorteio. Atual: ${currentPlayers}. Mínimo necessário: ${minimumPlayers}.`;
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
                    toast.error("Selecione o gênero do jogador.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.playerNotaInvalid) {
                    toast.error("Informe uma nota inteira entre 0 e 10.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.storageRead) {
                    toast.error(getStorageErrorMessage());
                    return;
                }
            }

            toast.error("Não foi possível salvar o jogador.");
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
                    toast.error("Selecione o gênero do jogador.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.playerNotaInvalid) {
                    toast.error("Informe uma nota inteira entre 0 e 10.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.storageRead) {
                    toast.error(getStorageErrorMessage());
                    return;
                }
            }

            toast.error("Não foi possível atualizar o jogador.");
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

            toast.error("Não foi possível remover o jogador.");
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
                    ? "Não foi possível ativar o jogador."
                    : "Não foi possível inativar o jogador."
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
            toast.error("Não foi possível limpar a lista de jogadores.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const saveDrawConfiguration = async (data: ISaveDrawConfigurationRequest) => {
        try {
            setIsLoading(true);
            const configuration = await saveConfiguration(data);
            toast.success("Configuração salva com sucesso.");
            return configuration;
        } catch (error) {
            if (
                error instanceof SortitionDomainError &&
                error.code === SORTITION_ERROR_CODES.configurationInvalid
            ) {
                toast.error("Informe uma quantidade valida de jogadores por time.");
                return;
            }

            toast.error("Não foi possível salvar a configuração.");
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

            toast.error("Não foi possível gerar o sorteio.");
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
                toast.error("Não existe resultado salvo para limpar.");
                return false;
            }

            toast.error("Não foi possível limpar o resultado.");
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
                    toast.error("Não existe resultado salvo para editar.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.swapIncompleteSelection) {
                    toast.error("Selecione um jogador de cada time para trocar.");
                    return;
                }

                if (error.code === SORTITION_ERROR_CODES.swapSameTeam) {
                    toast.error("Não é permitido trocar jogadores do mesmo time.");
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

            toast.error("Não foi possível confirmar a troca.");
            return;
        } finally {
            setIsLoading(false);
        }
    };

    const confirmWinner = async (data: IConfirmMatchWinnerRequest) => {
        try {
            setIsLoading(true);
            const result = await confirmMatchWinner(data);
            toast.success("Resultado da partida confirmado.");
            return result;
        } catch (error) {
            if (error instanceof SortitionDomainError) {
                if (error.code === SORTITION_ERROR_CODES.resultNotFound) {
                    toast.error("Não existe rotação salva para atualizar.");
                    return;
                }

                if (
                    error.code === SORTITION_ERROR_CODES.winnerInvalid ||
                    error.code === SORTITION_ERROR_CODES.resultInvalid
                ) {
                    toast.error("Selecione um time em partida para confirmar a vitória.");
                    return;
                }
            }

            toast.error("Não foi possível confirmar o vencedor.");
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
        confirmWinner,
    };
}
