import CachedIcon from "@mui/icons-material/Cached";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import UndoIcon from "@mui/icons-material/Undo";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
    DEFAULT_MAX_CONSECUTIVE_WINS,
    formatAllocatedPlayerList,
    getCurrentMatchTeams,
    getNextRotationTeams,
    isDrawResultOutdated,
    type IAllocatedPlayer,
    type IApplicationSnapshot,
    type IDrawTeam,
    type IPlayer,
} from "../../../../commons/sortition";
import usePermissions from "../../../../hooks/usePermissions";
import useSortition from "../../../../services/useSortition";
import BackButton from "../../../components/BackButton";
import { CompactInfoRow, CompactSection } from "../../../components/CompactInfo";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ViewActionsMenu from "../../../components/ViewActionsMenu";
import AccessDenied from "../../../components/AccessDenied";
import SwapPlayersDialog, { type ISwapSelection } from "./SwapPlayersDialog";

interface IRotationGroup {
    id: string;
    label: string;
    players: IAllocatedPlayer[];
    team?: IDrawTeam;
}

function getWinChipColor(team: IDrawTeam, maxWins: number) {
    if (team.currentWins >= maxWins) {
        return "error" as const;
    }

    if (team.currentWins + 1 >= maxWins) {
        return "warning" as const;
    }

    return "success" as const;
}

function buildGroupAfterSwap(
    group: IRotationGroup | null,
    leavingPlayerId: string | undefined,
    enteringPlayerName: string | undefined
) {
    if (!group || !leavingPlayerId || !enteringPlayerName) {
        return [];
    }

    return group.players.map((player) =>
        player.playerId === leavingPlayerId ? enteringPlayerName : player.playerName
    );
}

export default function ResultPage() {
    const navigate = useNavigate();
    const { hasAnyPermission } = usePermissions();
    const {
        getApplicationStateSnapshot,
        clearExistingResult,
        generateNewDraw,
        confirmDrawSwap,
        confirmWinner,
        setExistingPlayerActivity,
        undoLastWinner,
    } = useSortition();

    const canRead = hasAnyPermission(["sortition:read", "sortition:*"]);
    const canManage = hasAnyPermission(["sortition:update", "sortition:*"]);

    const [snapshot, setSnapshot] = useState<IApplicationSnapshot | null>(null);
    const [swapSelections, setSwapSelections] = useState<ISwapSelection[]>([]);
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [winnerDialogTeamId, setWinnerDialogTeamId] = useState<string | null>(null);
    const [newDrawDialogOpen, setNewDrawDialogOpen] = useState(false);
    const [clearResultDialogOpen, setClearResultDialogOpen] = useState(false);
    const [undoWinnerDialogOpen, setUndoWinnerDialogOpen] = useState(false);
    const [activatePlayersDialogOpen, setActivatePlayersDialogOpen] = useState(false);
    const [activationPlayer, setActivationPlayer] = useState<IPlayer | null>(null);
    const [playerMenuAnchorEl, setPlayerMenuAnchorEl] = useState<HTMLElement | null>(null);
    const [playerMenuSelection, setPlayerMenuSelection] = useState<ISwapSelection | null>(null);

    const result = snapshot?.result || null;
    const configuration = snapshot?.configuration || null;
    const maxConsecutiveWins = configuration?.maxConsecutiveWins || DEFAULT_MAX_CONSECUTIVE_WINS;
    const currentMatchTeams = getCurrentMatchTeams(result);
    const nextTeams = getNextRotationTeams(result);
    const selectedWinnerTeam =
        currentMatchTeams.find((team) => team.id === winnerDialogTeamId) || null;
    const isOutdated = isDrawResultOutdated(result, snapshot?.players || [], configuration);
    const canUndoLastWinner = Boolean(result?.lastMatchUndoSnapshot);
    const inactivePlayers = [...(snapshot?.players || [])]
        .filter((player) => !player.isActive)
        .sort((playerA, playerB) => playerA.name.localeCompare(playerB.name, "pt-BR"));

    const rotationGroups = useMemo<IRotationGroup[]>(() => {
        if (!result) {
            return [];
        }

        const teamGroups = result.teams.map((team) => ({
            id: team.id,
            label: team.label,
            players: team.players,
            team,
        }));

        if (result.excessPlayers.length === 0) {
            return teamGroups;
        }

        return [
            ...teamGroups,
            {
                id: "excess",
                label: "Excedentes",
                players: result.excessPlayers,
            },
        ];
    }, [result]);

    const firstSelection = swapSelections[0] || null;
    const secondSelection = swapSelections[1] || null;
    const firstSelectionGroup =
        rotationGroups.find((group) => group.id === firstSelection?.teamId) || null;
    const secondSelectionGroup =
        rotationGroups.find((group) => group.id === secondSelection?.teamId) || null;
    const swapSelectionByPlayerId = useMemo(() => {
        return new Set(swapSelections.map((selection) => selection.playerId));
    }, [swapSelections]);
    const firstGroupAfterSwap = buildGroupAfterSwap(
        firstSelectionGroup,
        firstSelection?.playerId,
        secondSelection?.playerName
    );
    const secondGroupAfterSwap = buildGroupAfterSwap(
        secondSelectionGroup,
        secondSelection?.playerId,
        firstSelection?.playerName
    );

    async function refreshSnapshot() {
        const currentSnapshot = await getApplicationStateSnapshot();

        if (currentSnapshot) {
            setSnapshot(currentSnapshot);
        }
    }

    useEffect(() => {
        if (!canRead) {
            return;
        }

        async function run() {
            await refreshSnapshot();
        }

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canRead]);

    const getTeamImpact = (team: IDrawTeam) => {
        const impact = result?.lastSwapImpact;

        if (!impact) {
            return null;
        }

        const allPlayers = [
            ...result.teams.flatMap((currentTeam) => currentTeam.players),
            ...result.excessPlayers,
        ];

        if (impact.teamAId === team.id) {
            const playerLeft = allPlayers.find(
                (player) => player.playerId === impact.playerLeftTeamAId
            );
            const playerEntered = team.players.find(
                (player) => player.playerId === impact.playerEnteredTeamAId
            );

            return {
                leftLabel: playerLeft?.playerName || impact.playerLeftTeamAId,
                enteredLabel: playerEntered?.playerName || impact.playerEnteredTeamAId,
                enteredPlayerId: impact.playerEnteredTeamAId,
            };
        }

        if (impact.teamBId === team.id) {
            const playerLeft = allPlayers.find(
                (player) => player.playerId === impact.playerLeftTeamBId
            );
            const playerEntered = team.players.find(
                (player) => player.playerId === impact.playerEnteredTeamBId
            );

            return {
                leftLabel: playerLeft?.playerName || impact.playerLeftTeamBId,
                enteredLabel: playerEntered?.playerName || impact.playerEnteredTeamBId,
                enteredPlayerId: impact.playerEnteredTeamBId,
            };
        }

        return null;
    };

    const winnerConfirmationMessage = (() => {
        if (!selectedWinnerTeam || !result) {
            return "";
        }

        const nextWins = selectedWinnerTeam.currentWins + 1;
        const reachedLimit = nextWins >= maxConsecutiveWins;
        const opponent = currentMatchTeams.find((team) => team.id !== selectedWinnerTeam.id);
        const doubleExitWillApply = Boolean(
            reachedLimit && configuration?.doubleExitOnMaxWins && result.teams.length >= 4
        );
        const messages = [
            `Confirmar que o grupo formado por ${formatAllocatedPlayerList(
                selectedWinnerTeam.players
            )} venceu esta partida?`,
            `Vitórias atuais: ${selectedWinnerTeam.currentWins} de ${maxConsecutiveWins}. Após a confirmação: ${nextWins} de ${maxConsecutiveWins}.`,
        ];

        if (reachedLimit) {
            messages.push(
                "Este grupo atingirá o limite máximo de vitórias e sairá da partida após esta rodada."
            );
        }

        if (doubleExitWillApply && opponent) {
            messages.push(
                `A regra de saída dupla será aplicada. ${opponent.label} também sairá da partida.`
            );
        }

        if (reachedLimit && configuration?.doubleExitOnMaxWins && result.teams.length < 4) {
            messages.push(
                "A saída dupla está ativada, mas não será aplicada porque existem menos de 4 times completos."
            );
        }

        return messages.join("\n\n");
    })();

    const handlePlayerSelection = (group: IRotationGroup, playerId: string, playerName: string) => {
        if (swapSelections.length === 0) {
            return;
        }

        const currentSelection = {
            teamId: group.id,
            teamLabel: group.label,
            playerId,
            playerName,
        } satisfies ISwapSelection;

        const existingSelectionIndex = swapSelections.findIndex(
            (selection) => selection.playerId === playerId
        );

        if (existingSelectionIndex >= 0) {
            setSwapSelections([]);
            return;
        }

        if (swapSelections[0].teamId === currentSelection.teamId) {
            toast.error("Não é permitido trocar jogadores do mesmo grupo.");
            return;
        }

        setSwapSelections([swapSelections[0], currentSelection]);
        setSwapDialogOpen(true);
    };

    const handleConfirmSwap = async () => {
        if (!firstSelection || !secondSelection) {
            toast.error("Selecione um jogador de cada grupo para trocar.");
            return;
        }

        const updatedResult = await confirmDrawSwap({
            firstPlayerId: firstSelection.playerId,
            secondPlayerId: secondSelection.playerId,
        });

        if (updatedResult) {
            setSnapshot((currentSnapshot) =>
                currentSnapshot
                    ? {
                          ...currentSnapshot,
                          result: updatedResult,
                      }
                    : currentSnapshot
            );
        }

        setSwapDialogOpen(false);
        setSwapSelections([]);
    };

    const handleConfirmWinner = async () => {
        if (!selectedWinnerTeam) {
            return;
        }

        const updatedResult = await confirmWinner({
            winnerTeamId: selectedWinnerTeam.id,
        });

        if (updatedResult) {
            setSnapshot((currentSnapshot) =>
                currentSnapshot
                    ? {
                          ...currentSnapshot,
                          result: updatedResult,
                      }
                    : currentSnapshot
            );
        }

        setWinnerDialogTeamId(null);
        setSwapSelections([]);
    };

    const handleGenerateNewDraw = async () => {
        const response = await generateNewDraw();

        if (response) {
            setSnapshot((currentSnapshot) =>
                currentSnapshot
                    ? {
                          ...currentSnapshot,
                          result: response.result,
                      }
                    : currentSnapshot
            );
        }

        setNewDrawDialogOpen(false);
        setSwapSelections([]);
    };

    const handleClearResult = async () => {
        const success = await clearExistingResult();

        if (success) {
            await refreshSnapshot();
        }

        setClearResultDialogOpen(false);
        setSwapSelections([]);
    };

    const handleUndoLastWinner = async () => {
        const updatedResult = await undoLastWinner();

        if (updatedResult) {
            setSnapshot((currentSnapshot) =>
                currentSnapshot
                    ? {
                          ...currentSnapshot,
                          result: updatedResult,
                      }
                    : currentSnapshot
            );
        }

        setUndoWinnerDialogOpen(false);
        setSwapSelections([]);
    };

    const handleActivatePlayer = async () => {
        if (!activationPlayer) {
            return;
        }

        const updatedPlayer = await setExistingPlayerActivity(activationPlayer.id, true);

        if (updatedPlayer) {
            await refreshSnapshot();
        }

        setActivationPlayer(null);
    };

    const handleOpenPlayerMenu = (
        event: React.MouseEvent<HTMLElement>,
        group: IRotationGroup,
        player: IAllocatedPlayer
    ) => {
        event.stopPropagation();
        setPlayerMenuAnchorEl(event.currentTarget);
        setPlayerMenuSelection({
            teamId: group.id,
            teamLabel: group.label,
            playerId: player.playerId,
            playerName: player.playerName,
        });
    };

    const handleClosePlayerMenu = () => {
        setPlayerMenuAnchorEl(null);
        setPlayerMenuSelection(null);
    };

    const handleMovePlayer = () => {
        if (playerMenuSelection) {
            setSwapSelections([playerMenuSelection]);
            setSwapDialogOpen(false);
        }

        handleClosePlayerMenu();
    };

    const handleDeactivatePlayer = async () => {
        if (!playerMenuSelection) {
            return;
        }

        const updatedPlayer = await setExistingPlayerActivity(playerMenuSelection.playerId, false);

        if (updatedPlayer) {
            await refreshSnapshot();
            setSwapSelections((currentSelections) =>
                currentSelections.filter(
                    (selection) => selection.playerId !== playerMenuSelection.playerId
                )
            );
        }

        handleClosePlayerMenu();
    };

    const renderPlayerList = (group: IRotationGroup, enteredPlayerId?: string) => (
        <List disablePadding dense>
            {group.players.map((player) => (
                <ListItemButton
                    key={player.allocationId}
                    selected={swapSelectionByPlayerId.has(player.playerId)}
                    onClick={() => handlePlayerSelection(group, player.playerId, player.playerName)}
                    sx={{
                        minHeight: 0,
                        py: 0.5,
                        px: 1,
                        borderRadius: 1,
                    }}
                >
                    <ListItemText
                        primary={player.playerName}
                        sx={{ my: 0 }}
                        primaryTypographyProps={{
                            variant: "body2",
                        }}
                    />
                    <Stack direction="row" spacing={1}>
                        {enteredPlayerId === player.playerId && (
                            <Chip label="Entrou" size="small" color="success" />
                        )}
                        {swapSelectionByPlayerId.has(player.playerId) && (
                            <Chip label="Selecionado" size="small" color="primary" />
                        )}
                        {canManage && (
                            <IconButton
                                aria-label={`Abrir ações de ${player.playerName}`}
                                edge="end"
                                size="small"
                                onClick={(event) => handleOpenPlayerMenu(event, group, player)}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        )}
                    </Stack>
                </ListItemButton>
            ))}
        </List>
    );

    const renderTeamCard = (team: IDrawTeam, isCurrentMatch: boolean) => {
        const teamImpact = getTeamImpact(team);
        const group = {
            id: team.id,
            label: team.label,
            players: team.players,
            team,
        } satisfies IRotationGroup;

        return (
            <Paper key={team.id} sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="h6" component="h2">
                                {team.label}
                            </Typography>
                            <Chip
                                label={isCurrentMatch ? "Em partida" : `Ordem ${team.playOrder}`}
                                size="small"
                                color={isCurrentMatch ? "primary" : "default"}
                            />
                            {isCurrentMatch && (
                                <Chip
                                    label={`Vitórias ${team.currentWins} de ${maxConsecutiveWins}`}
                                    size="small"
                                    color={getWinChipColor(team, maxConsecutiveWins)}
                                />
                            )}
                        </Stack>

                        {isCurrentMatch && canManage && (
                            <Button
                                variant="contained"
                                startIcon={<EmojiEventsIcon />}
                                onClick={() => setWinnerDialogTeamId(team.id)}
                            >
                                Registrar vitória
                            </Button>
                        )}
                    </Stack>

                    {isCurrentMatch && team.currentWins + 1 >= maxConsecutiveWins && (
                        <Alert severity="warning">
                            Se vencer esta partida, este time sairá na próxima rotação.
                        </Alert>
                    )}

                    {teamImpact && (
                        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                            Saiu: {teamImpact.leftLabel}. Entrou: {teamImpact.enteredLabel}.
                        </Alert>
                    )}

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip label={`${team.playerCount} jogadores`} size="small" />
                        <Chip
                            label={`Soma das notas ${team.notaTotal}`}
                            size="small"
                            color="secondary"
                        />
                    </Stack>

                    {renderPlayerList(group, teamImpact?.enteredPlayerId)}
                </Stack>
            </Paper>
        );
    };

    if (!canRead) {
        return <AccessDenied message="Você não tem permissão para visualizar a rotação." />;
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <BackButton />
                {result && (
                    <ViewActionsMenu
                        actions={[
                            {
                                label: "Desfazer última vitória",
                                onClick: () => setUndoWinnerDialogOpen(true),
                                icon: <UndoIcon fontSize="small" />,
                                disabled: !canUndoLastWinner,
                            },
                            {
                                label: "Ativar jogadores",
                                onClick: () => setActivatePlayersDialogOpen(true),
                                icon: <PlayCircleOutlineIcon fontSize="small" />,
                            },
                            {
                                label: "Refazer sorteio",
                                onClick: () => setNewDrawDialogOpen(true),
                                icon: <CachedIcon fontSize="small" />,
                            },
                            {
                                label: "Limpar resultado",
                                onClick: () => setClearResultDialogOpen(true),
                                icon: <CleaningServicesIcon fontSize="small" />,
                            },
                        ]}
                    />
                )}
            </Stack>

            {snapshot?.restoration.status === "invalid-result" && snapshot.restoration.message && (
                <Alert
                    severity="warning"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => setClearResultDialogOpen(true)}
                        >
                            Limpar resultado
                        </Button>
                    }
                >
                    {snapshot.restoration.message}
                </Alert>
            )}

            {!result && (
                <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack spacing={2.5}>
                        <Typography variant="h5" component="h1">
                            Nenhuma rotação salva
                        </Typography>
                        <Typography color="text.secondary">
                            Realize um sorteio para iniciar a rotação das partidas.
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button variant="contained" onClick={() => navigate("/painel")}>
                                Voltar ao painel
                            </Button>
                            <Button variant="outlined" onClick={() => navigate("/configuracoes")}>
                                Configurar sorteio
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            {result && (
                <Stack spacing={2}>
                    {isOutdated && (
                        <Alert severity="warning">
                            A configuração de jogadores por time mudou em relação ao sorteio salvo.
                        </Alert>
                    )}

                    {result.lastRotationSummary && (
                        <Alert severity="success">
                            Última rodada: {result.lastRotationSummary.winnerTeamLabel} venceu.
                            Saíram: {result.lastRotationSummary.exitedTeamLabels.join(", ") || "-"}.
                            Entraram:{" "}
                            {result.lastRotationSummary.enteredTeamLabels.join(", ") || "-"}.
                        </Alert>
                    )}

                    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack spacing={3}>
                            <Typography variant="h5" component="h1">
                                Rotação de partidas
                            </Typography>

                            <CompactSection title="Resumo da rotação">
                                <CompactInfoRow label="Rodada atual" value={result.roundNumber} />
                                <CompactInfoRow label="Times completos" value={result.totalTeams} />
                                <CompactInfoRow
                                    label="Jogadores excedentes"
                                    value={result.excessPlayers.length}
                                />
                            </CompactSection>

                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1.5}
                                justifyContent="space-between"
                                alignItems={{ xs: "stretch", sm: "center" }}
                            >
                                <Typography variant="subtitle1" component="h2">
                                    Partida atual
                                </Typography>
                            </Stack>

                            {firstSelection && (
                                <Alert severity="info">
                                    {firstSelection.playerName} selecionado. Toque em outro jogador
                                    para confirmar a troca.
                                    <Button
                                        size="small"
                                        sx={{ ml: 1 }}
                                        onClick={() => setSwapSelections([])}
                                    >
                                        Cancelar
                                    </Button>
                                </Alert>
                            )}
                        </Stack>
                    </Paper>

                    {currentMatchTeams.length < 2 && (
                        <Alert severity="warning">
                            Não há dois times completos em partida com os jogadores ativos atuais.
                        </Alert>
                    )}

                    {currentMatchTeams.map((team) => renderTeamCard(team, true))}

                    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack spacing={2}>
                            <Typography variant="h6" component="h2">
                                Próximos times
                            </Typography>
                            {nextTeams.length === 0 && (
                                <Typography color="text.secondary">
                                    Não há times aguardando na fila.
                                </Typography>
                            )}
                        </Stack>
                    </Paper>

                    {nextTeams.map((team) => renderTeamCard(team, false))}

                    {result.excessPlayers.length > 0 && (
                        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={2}>
                                <Typography variant="h6" component="h2">
                                    Jogadores excedentes
                                </Typography>
                                {renderPlayerList({
                                    id: "excess",
                                    label: "Excedentes",
                                    players: result.excessPlayers,
                                })}
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            )}

            <Menu
                anchorEl={playerMenuAnchorEl}
                open={Boolean(playerMenuAnchorEl)}
                onClose={handleClosePlayerMenu}
            >
                <MenuItem onClick={() => void handleDeactivatePlayer()}>
                    <ListItemIcon>
                        <PauseCircleOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    Inativar
                </MenuItem>
                <MenuItem onClick={handleMovePlayer}>
                    <ListItemIcon>
                        <SwapHorizIcon fontSize="small" />
                    </ListItemIcon>
                    Mover
                </MenuItem>
            </Menu>

            <Dialog
                open={activatePlayersDialogOpen}
                onClose={() => setActivatePlayersDialogOpen(false)}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Ativar jogadores</DialogTitle>
                <DialogContent>
                    {inactivePlayers.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 1 }}>
                            Nenhum jogador inativo encontrado.
                        </Typography>
                    ) : (
                        <List disablePadding>
                            {inactivePlayers.map((player, index) => (
                                <>
                                    {index > 0 && <Divider />}
                                    <Box key={player.id} pl={2}>
                                        <ListItemButton
                                            onClick={() => setActivationPlayer(player)}
                                            sx={{ px: 0, py: 1 }}
                                        >
                                            <ListItemText primary={player.name} />
                                        </ListItemButton>
                                    </Box>
                                </>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActivatePlayersDialogOpen(false)}>Fechar</Button>
                </DialogActions>
            </Dialog>

            <SwapPlayersDialog
                open={swapDialogOpen}
                firstSelection={firstSelection}
                secondSelection={secondSelection}
                firstGroupAfterSwap={firstGroupAfterSwap}
                secondGroupAfterSwap={secondGroupAfterSwap}
                onClose={() => {
                    setSwapDialogOpen(false);
                    setSwapSelections([]);
                }}
                onConfirm={() => {
                    void handleConfirmSwap();
                }}
            />

            <ConfirmDialog
                open={Boolean(selectedWinnerTeam)}
                title="Confirmar vencedor"
                message={winnerConfirmationMessage}
                confirmLabel="Confirmar vitória"
                onConfirm={() => {
                    void handleConfirmWinner();
                }}
                onCancel={() => setWinnerDialogTeamId(null)}
            />

            <ConfirmDialog
                open={undoWinnerDialogOpen}
                title="Desfazer última vitória"
                message="A rotação voltará ao estado anterior ao último registro de vitória. Depois disso, esta ação ficará desabilitada até que uma nova vitória seja registrada."
                confirmLabel="Desfazer"
                onConfirm={() => {
                    void handleUndoLastWinner();
                }}
                onCancel={() => setUndoWinnerDialogOpen(false)}
            />

            <ConfirmDialog
                open={Boolean(activationPlayer)}
                title="Ativar jogador"
                message={`Confirmar ativação de "${activationPlayer?.name || "este jogador"}"?`}
                confirmLabel="Ativar"
                onConfirm={() => {
                    void handleActivatePlayer();
                }}
                onCancel={() => setActivationPlayer(null)}
            />

            <ConfirmDialog
                open={newDrawDialogOpen}
                title="Confirmar novo sorteio"
                message="O resultado atual será substituído integralmente por um novo sorteio."
                confirmLabel="Confirmar novo sorteio"
                onConfirm={() => {
                    void handleGenerateNewDraw();
                }}
                onCancel={() => setNewDrawDialogOpen(false)}
            />

            <ConfirmDialog
                open={clearResultDialogOpen}
                title="Limpar resultado"
                message="Somente o resultado será apagado. Os jogadores e a configuração serão preservados."
                confirmLabel="Limpar resultado"
                onConfirm={() => {
                    void handleClearResult();
                }}
                onCancel={() => setClearResultDialogOpen(false)}
            />
        </Box>
    );
}
