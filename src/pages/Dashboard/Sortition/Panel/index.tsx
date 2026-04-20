import CasinoIcon from "@mui/icons-material/Casino";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import SettingsIcon from "@mui/icons-material/Settings";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    calculateDrawPreview,
    filterActivePlayers,
    getPlayerCounts,
    isDrawResultOutdated,
    type IApplicationSnapshot,
} from "../../../../commons/sortition";
import usePermissions from "../../../../hooks/usePermissions";
import useSortition from "../../../../services/useSortition";
import { CompactInfoRow, CompactSection } from "../../../components/CompactInfo";
import ConfirmDialog from "../../../components/ConfirmDialog";
import AccessDenied from "../../../components/AccessDenied";

export default function PanelPage() {
    const navigate = useNavigate();
    const { hasAnyPermission } = usePermissions();
    const { getApplicationStateSnapshot, clearExistingResult, generateNewDraw } = useSortition();

    const canRead = hasAnyPermission(["sortition:read", "sortition:*"]);
    const canManage = hasAnyPermission(["sortition:update", "sortition:*"]);

    const [snapshot, setSnapshot] = useState<IApplicationSnapshot | null>(null);
    const [newDrawDialogOpen, setNewDrawDialogOpen] = useState(false);
    const [clearResultDialogOpen, setClearResultDialogOpen] = useState(false);

    const allPlayers = snapshot?.players || [];
    const activePlayers = filterActivePlayers(allPlayers);
    const inactivePlayersCount = allPlayers.length - activePlayers.length;
    const activePlayerCounts = getPlayerCounts(activePlayers);
    const configuration = snapshot?.configuration || null;
    const result = snapshot?.result || null;
    const drawPreview = calculateDrawPreview(
        activePlayers.length,
        configuration?.playersPerTeam || null
    );
    const isResultOutdated = isDrawResultOutdated(result, allPlayers, configuration);

    const resultStatusLabel = useMemo(() => {
        if (result) {
            return isResultOutdated ? "Resultado desatualizado" : "Resultado ativo restaurado";
        }

        if (snapshot?.restoration.hasStoredData) {
            return "Resultado limpo";
        }

        return "Sem resultado salvo";
    }, [isResultOutdated, result, snapshot]);

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

    const handleGenerateDraw = async () => {
        const response = await generateNewDraw();

        if (response) {
            await refreshSnapshot();
            navigate("/resultado");
        }

        setNewDrawDialogOpen(false);
    };

    const handleClearResult = async () => {
        const success = await clearExistingResult();

        if (success) {
            await refreshSnapshot();
        }

        setClearResultDialogOpen(false);
    };

    if (!canRead) {
        return <AccessDenied />;
    }

    return (
        <Box>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                spacing={1.5}
                mb={3}
            >
                <Typography variant="h5" component="h1">
                    Painel do sorteio
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<GroupsIcon />}
                    onClick={() => navigate("/jogadores")}
                >
                    Abrir jogadores
                </Button>
            </Stack>

            {snapshot?.restoration.status === "success" && snapshot.restoration.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {snapshot.restoration.message}
                </Alert>
            )}

            {snapshot?.restoration.status === "read-error" && snapshot.restoration.message && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => window.location.reload()}
                        >
                            Recarregar
                        </Button>
                    }
                >
                    {snapshot.restoration.message}
                </Alert>
            )}

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

            {isResultOutdated && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    O resultado salvo pode ter sido gerado com base em um conjunto anterior de
                    jogadores ativos ou configuracao.
                </Alert>
            )}

            {inactivePlayersCount > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Jogadores inativos nao entram na lista elegivel do sorteio e sao ignorados em
                    todo o calculo dos times.
                </Alert>
            )}

            {!configuration && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Configure a quantidade de jogadores por time antes do primeiro sorteio.
                </Alert>
            )}

            {configuration && !drawPreview.isEligible && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Nao ha jogadores suficientes para iniciar o sorteio. Atual:{" "}
                    {activePlayers.length}. Minimo necessario: {drawPreview.minimumPlayersNeeded}.
                </Alert>
            )}

            <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={3}>
                    <CompactSection title="Resumo atual">
                        <CompactInfoRow label="Jogadores cadastrados" value={allPlayers.length} />
                        <CompactInfoRow
                            label="Jogadores ativos para sorteio"
                            value={activePlayers.length}
                        />
                        <CompactInfoRow label="Jogadores inativos" value={inactivePlayersCount} />
                        <CompactInfoRow
                            label="Total de homens ativos"
                            value={activePlayerCounts.totalMen}
                        />
                        <CompactInfoRow
                            label="Total de mulheres ativas"
                            value={activePlayerCounts.totalWomen}
                        />
                        <CompactInfoRow
                            label="Soma de notas (ativos)"
                            value={activePlayerCounts.notaTotal}
                        />
                        <CompactInfoRow
                            label="Soma de notas masculinas"
                            value={activePlayerCounts.notaTotalMen}
                        />
                        <CompactInfoRow
                            label="Soma de notas femininas"
                            value={activePlayerCounts.notaTotalWomen}
                        />
                        <CompactInfoRow
                            label="Jogadores por time"
                            value={configuration?.playersPerTeam || "Nao definido"}
                        />
                        <CompactInfoRow
                            label="Minimo para sortear"
                            value={
                                configuration?.playersPerTeam
                                    ? configuration.playersPerTeam * 2
                                    : "Nao definido"
                            }
                        />
                        <CompactInfoRow label="Status do resultado" value={resultStatusLabel} />
                    </CompactSection>

                    <CompactSection title="Previsao estrutural">
                        <CompactInfoRow
                            label="Quantidade prevista de times"
                            value={drawPreview.totalTeams}
                        />
                        <CompactInfoRow
                            label="Divisao exata"
                            value={drawPreview.exactDivision ? "Sim" : "Nao"}
                        />
                        <CompactInfoRow
                            label="Havera time incompleto"
                            value={drawPreview.hasIncompleteTeam ? "Sim" : "Nao"}
                        />
                        <CompactInfoRow
                            label="Quantidade prevista no ultimo time"
                            value={drawPreview.lastTeamPlayerCount || "-"}
                        />
                    </CompactSection>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap">
                        <Button
                            variant="outlined"
                            startIcon={<GroupsIcon />}
                            onClick={() => navigate("/jogadores")}
                        >
                            Gerenciar jogadores
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SettingsIcon />}
                            onClick={() => navigate("/configuracoes")}
                        >
                            Configurar sorteio
                        </Button>
                        {canManage && (
                            <Button
                                variant="contained"
                                startIcon={<CasinoIcon />}
                                disabled={!configuration || !drawPreview.isEligible}
                                onClick={() => {
                                    if (result) {
                                        setNewDrawDialogOpen(true);
                                        return;
                                    }

                                    void handleGenerateDraw();
                                }}
                            >
                                {result ? "Refazer sorteio" : "Realizar sorteio"}
                            </Button>
                        )}
                        {result && (
                            <Button
                                variant="outlined"
                                startIcon={<EmojiEventsIcon />}
                                onClick={() => navigate("/resultado")}
                            >
                                Abrir resultado
                            </Button>
                        )}
                        {(result || snapshot?.restoration.hasInvalidStoredResult) && canManage && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteSweepIcon />}
                                onClick={() => setClearResultDialogOpen(true)}
                            >
                                Limpar resultado
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Paper>

            <ConfirmDialog
                open={newDrawDialogOpen}
                title="Confirmar novo sorteio"
                message="O resultado atual sera descartado. Os jogadores ativos e a configuracao atuais serao reaproveitados."
                confirmLabel="Confirmar novo sorteio"
                onConfirm={() => {
                    void handleGenerateDraw();
                }}
                onCancel={() => setNewDrawDialogOpen(false)}
            />

            <ConfirmDialog
                open={clearResultDialogOpen}
                title="Limpar resultado"
                message="Somente o resultado sera apagado. Os jogadores cadastrados e a configuracao do sorteio serao preservados."
                confirmLabel="Limpar resultado"
                onConfirm={() => {
                    void handleClearResult();
                }}
                onCancel={() => setClearResultDialogOpen(false)}
            />
        </Box>
    );
}
