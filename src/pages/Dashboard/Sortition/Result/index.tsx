import AutorenewIcon from "@mui/icons-material/Autorenew";
import CachedIcon from "@mui/icons-material/Cached";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import SportsIcon from "@mui/icons-material/Sports";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
    isDrawResultOutdated,
    type IApplicationSnapshot,
    type IDrawTeam,
} from "../../../../commons/sortition";
import usePermissions from "../../../../hooks/usePermissions";
import useSortition from "../../../../services/useSortition";
import BackButton from "../../../components/BackButton";
import { CompactInfoRow, CompactSection } from "../../../components/CompactInfo";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ViewActionsMenu from "../../../components/ViewActionsMenu";
import AccessDenied from "../../../components/AccessDenied";
import SwapPlayersDialog, { type ISwapSelection } from "./SwapPlayersDialog";

export default function ResultPage() {
    const navigate = useNavigate();
    const { hasAnyPermission } = usePermissions();
    const { getApplicationStateSnapshot, clearExistingResult, generateNewDraw, confirmDrawSwap } =
        useSortition();

    const canRead = hasAnyPermission(["sortition:read", "sortition:*"]);
    const canManage = hasAnyPermission(["sortition:update", "sortition:*"]);

    const [snapshot, setSnapshot] = useState<IApplicationSnapshot | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [swapSelections, setSwapSelections] = useState<ISwapSelection[]>([]);
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [newDrawDialogOpen, setNewDrawDialogOpen] = useState(false);
    const [clearResultDialogOpen, setClearResultDialogOpen] = useState(false);

    const result = snapshot?.result || null;
    const isOutdated = isDrawResultOutdated(
        result,
        snapshot?.players || [],
        snapshot?.configuration || null
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

    const swapSelectionByPlayerId = useMemo(() => {
        return new Set(swapSelections.map((selection) => selection.playerId));
    }, [swapSelections]);

    const firstSelection = swapSelections[0] || null;
    const secondSelection = swapSelections[1] || null;

    const getTeamImpact = (team: IDrawTeam) => {
        const impact = result?.lastSwapImpact;

        if (!impact) {
            return null;
        }

        if (impact.teamAId === team.id) {
            const playerLeft = result.teams
                .flatMap((currentTeam) => currentTeam.players)
                .find((player) => player.playerId === impact.playerLeftTeamAId);
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
            const playerLeft = result.teams
                .flatMap((currentTeam) => currentTeam.players)
                .find((player) => player.playerId === impact.playerLeftTeamBId);
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

    const handleToggleSelectionMode = () => {
        setIsSelectionMode((previous) => !previous);
        setSwapSelections([]);
        setSwapDialogOpen(false);
    };

    const handlePlayerSelection = (team: IDrawTeam, playerId: string, playerName: string) => {
        if (!isSelectionMode) {
            return;
        }

        const currentSelection = {
            teamId: team.id,
            teamLabel: team.label,
            playerId,
            playerName,
        } satisfies ISwapSelection;

        const existingSelectionIndex = swapSelections.findIndex(
            (selection) => selection.playerId === playerId
        );

        if (existingSelectionIndex >= 0) {
            setSwapSelections(
                swapSelections.filter((selection) => selection.playerId !== playerId)
            );
            return;
        }

        if (swapSelections.length === 0) {
            setSwapSelections([currentSelection]);
            return;
        }

        if (swapSelections[0].teamId === currentSelection.teamId) {
            toast.error("Nao e permitido trocar jogadores do mesmo time.");
            return;
        }

        setSwapSelections([swapSelections[0], currentSelection]);
        setSwapDialogOpen(true);
    };

    const handleConfirmSwap = async () => {
        if (!firstSelection || !secondSelection) {
            toast.error("Selecione um jogador de cada time para trocar.");
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
        setIsSelectionMode(false);
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
        setIsSelectionMode(false);
    };

    const handleClearResult = async () => {
        const success = await clearExistingResult();

        if (success) {
            await refreshSnapshot();
        }

        setClearResultDialogOpen(false);
        setSwapSelections([]);
        setIsSelectionMode(false);
    };

    if (!canRead) {
        return <AccessDenied message="Voce nao tem permissao para visualizar o resultado." />;
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <BackButton />
                {result && (
                    <ViewActionsMenu
                        actions={[
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
                            Nenhum resultado salvo
                        </Typography>
                        <Typography color="text.secondary">
                            Nao existe resultado salvo para exibir.
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
                            O resultado salvo pode ter sido gerado com base em um conjunto anterior
                            de jogadores ou configuracao.
                        </Alert>
                    )}

                    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack spacing={3}>
                            <Typography variant="h5" component="h1">
                                Resultado do sorteio e ordem de jogo
                            </Typography>

                            <CompactSection title="Cabecalho do resultado">
                                <CompactInfoRow label="Status" value="Ativo" />
                                <CompactInfoRow
                                    label="Total de jogadores"
                                    value={result.totalPlayers}
                                />
                                <CompactInfoRow label="Total de homens" value={result.totalMen} />
                                <CompactInfoRow
                                    label="Total de mulheres"
                                    value={result.totalWomen}
                                />
                                <CompactInfoRow
                                    label="Jogadores por time"
                                    value={result.playersPerTeamConfigured}
                                />
                                <CompactInfoRow
                                    label="Quantidade de times"
                                    value={result.totalTeams}
                                />
                                <CompactInfoRow
                                    label="Possui time incompleto"
                                    value={result.hasIncompleteTeam ? "Sim" : "Nao"}
                                />
                                <CompactInfoRow
                                    label="Soma total das notas"
                                    value={result.teams.reduce(
                                        (sum, team) => sum + team.notaTotal,
                                        0
                                    )}
                                />
                                <CompactInfoRow
                                    label="Diferenca entre maior e menor soma"
                                    value={(() => {
                                        const totals = result.teams.map((team) => team.notaTotal);
                                        return Math.max(...totals) - Math.min(...totals);
                                    })()}
                                />
                            </CompactSection>

                            <Divider />

                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1.5}
                                justifyContent="space-between"
                                alignItems={{ xs: "stretch", sm: "center" }}
                            >
                                <Typography variant="subtitle1" component="h2">
                                    Times em sequencia unica
                                </Typography>
                                {canManage && (
                                    <Button
                                        variant={isSelectionMode ? "outlined" : "contained"}
                                        startIcon={
                                            isSelectionMode ? <AutorenewIcon /> : <SportsIcon />
                                        }
                                        onClick={handleToggleSelectionMode}
                                    >
                                        {isSelectionMode
                                            ? "Cancelar selecao de troca"
                                            : "Iniciar troca manual"}
                                    </Button>
                                )}
                            </Stack>

                            {isSelectionMode && (
                                <Alert severity="info">
                                    Selecione um jogador de cada time para trocar.
                                </Alert>
                            )}
                        </Stack>
                    </Paper>

                    {result.teams.map((team) => {
                        const teamImpact = getTeamImpact(team);

                        return (
                            <Paper key={team.id} sx={{ p: { xs: 2, sm: 3 } }}>
                                <Stack spacing={2}>
                                    <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        spacing={1}
                                        justifyContent="space-between"
                                        alignItems={{ xs: "flex-start", sm: "center" }}
                                    >
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            useFlexGap
                                            flexWrap="wrap"
                                        >
                                            <Typography variant="h6" component="h2">
                                                {team.label}
                                            </Typography>
                                            <Chip
                                                label={`Ordem de jogo ${team.playOrder}`}
                                                size="small"
                                                color="primary"
                                            />
                                            {team.isOriginalIncompleteTeam && (
                                                <Chip
                                                    label="Ultimo time incompleto"
                                                    size="small"
                                                    color="warning"
                                                />
                                            )}
                                        </Stack>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            useFlexGap
                                            flexWrap="wrap"
                                        >
                                            <Chip
                                                label={`${team.playerCount} jogadores`}
                                                size="small"
                                            />
                                            <Chip label={`${team.totalMen} homens`} size="small" />
                                            <Chip
                                                label={`${team.totalWomen} mulheres`}
                                                size="small"
                                            />
                                            <Chip
                                                label={`Nota ${team.notaTotal}`}
                                                size="small"
                                                color="secondary"
                                            />
                                            <Chip
                                                label={`M ${team.notaTotalMen} / F ${team.notaTotalWomen}`}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Stack>
                                    </Stack>

                                    {teamImpact && (
                                        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                                            Saiu: {teamImpact.leftLabel}. Entrou:{" "}
                                            {teamImpact.enteredLabel}.
                                        </Alert>
                                    )}

                                    <List disablePadding dense>
                                        {team.players.map((player) => (
                                            <ListItemButton
                                                key={player.allocationId}
                                                selected={swapSelectionByPlayerId.has(
                                                    player.playerId
                                                )}
                                                onClick={() =>
                                                    handlePlayerSelection(
                                                        team,
                                                        player.playerId,
                                                        player.playerName
                                                    )
                                                }
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
                                                    {teamImpact?.enteredPlayerId ===
                                                        player.playerId && (
                                                        <Chip
                                                            label="Entrou"
                                                            size="small"
                                                            color="success"
                                                        />
                                                    )}
                                                    {swapSelectionByPlayerId.has(
                                                        player.playerId
                                                    ) && (
                                                        <Chip
                                                            label="Selecionado"
                                                            size="small"
                                                            color="primary"
                                                        />
                                                    )}
                                                </Stack>
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Stack>
                            </Paper>
                        );
                    })}
                </Stack>
            )}

            <SwapPlayersDialog
                open={swapDialogOpen}
                firstSelection={firstSelection}
                secondSelection={secondSelection}
                onClose={() => {
                    setSwapDialogOpen(false);
                    setSwapSelections([]);
                }}
                onConfirm={() => {
                    void handleConfirmSwap();
                }}
            />

            <ConfirmDialog
                open={newDrawDialogOpen}
                title="Confirmar novo sorteio"
                message="O resultado atual sera substituido integralmente por um novo sorteio."
                confirmLabel="Confirmar novo sorteio"
                onConfirm={() => {
                    void handleGenerateNewDraw();
                }}
                onCancel={() => setNewDrawDialogOpen(false)}
            />

            <ConfirmDialog
                open={clearResultDialogOpen}
                title="Limpar resultado"
                message="Somente o resultado sera apagado. Os jogadores e a configuracao serao preservados."
                confirmLabel="Limpar resultado"
                onConfirm={() => {
                    void handleClearResult();
                }}
                onCancel={() => setClearResultDialogOpen(false)}
            />
        </Box>
    );
}
