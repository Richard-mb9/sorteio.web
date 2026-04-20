import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
    calculateDrawPreview,
    filterActivePlayers,
    type IApplicationSnapshot,
} from "../../../../commons/sortition";
import usePermissions from "../../../../hooks/usePermissions";
import useSortition from "../../../../services/useSortition";
import BackButton from "../../../components/BackButton";
import { CompactInfoRow, CompactSection } from "../../../components/CompactInfo";
import ConfirmDialog from "../../../components/ConfirmDialog";
import AccessDenied from "../../../components/AccessDenied";

export default function SettingsPage() {
    const navigate = useNavigate();
    const { hasAnyPermission } = usePermissions();
    const { getApplicationStateSnapshot, saveDrawConfiguration, generateNewDraw } = useSortition();

    const canManage = hasAnyPermission(["sortition:update", "sortition:*"]);

    const [snapshot, setSnapshot] = useState<IApplicationSnapshot | null>(null);
    const [playersPerTeam, setPlayersPerTeam] = useState("");
    const [confirmDrawDialogOpen, setConfirmDrawDialogOpen] = useState(false);

    const activePlayers = filterActivePlayers(snapshot?.players || []);
    const inactivePlayersCount = (snapshot?.players.length || 0) - activePlayers.length;
    const totalPlayers = activePlayers.length;
    const existingResult = snapshot?.result || null;
    const parsedPlayersPerTeam = Number(playersPerTeam);
    const isValidConfiguration = Number.isInteger(parsedPlayersPerTeam) && parsedPlayersPerTeam > 0;
    const drawPreview = calculateDrawPreview(
        totalPlayers,
        isValidConfiguration ? parsedPlayersPerTeam : null
    );

    async function refreshSnapshot() {
        const currentSnapshot = await getApplicationStateSnapshot();

        if (currentSnapshot) {
            setSnapshot(currentSnapshot);
            setPlayersPerTeam(currentSnapshot.configuration?.playersPerTeam?.toString() || "");
        }
    }

    useEffect(() => {
        if (!canManage) {
            return;
        }

        async function run() {
            await refreshSnapshot();
        }

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage]);

    const validateConfiguration = () => {
        if (!isValidConfiguration) {
            toast.error("Informe uma quantidade valida de jogadores por time.");
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        if (!validateConfiguration()) {
            return;
        }

        const configuration = await saveDrawConfiguration({
            playersPerTeam: parsedPlayersPerTeam,
        });

        if (configuration) {
            await refreshSnapshot();
        }
    };

    const executeSaveAndDraw = async () => {
        if (!validateConfiguration()) {
            return;
        }

        const configuration = await saveDrawConfiguration({
            playersPerTeam: parsedPlayersPerTeam,
        });

        if (!configuration) {
            setConfirmDrawDialogOpen(false);
            return;
        }

        const response = await generateNewDraw();

        if (response) {
            await refreshSnapshot();
            navigate("/resultado");
        }

        setConfirmDrawDialogOpen(false);
    };

    if (!canManage) {
        return <AccessDenied />;
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                <BackButton />
                <Typography variant="h5" component="h1">
                    Configuracoes do sorteio
                </Typography>
            </Stack>

            {existingResult && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Alterar a configuracao nao modifica o resultado atual automaticamente. A nova
                    configuracao vale para os proximos sorteios.
                </Alert>
            )}

            {isValidConfiguration && !drawPreview.isEligible && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Nao ha jogadores suficientes para iniciar o sorteio. Atual: {totalPlayers}.
                    Minimo necessario: {drawPreview.minimumPlayersNeeded}.
                </Alert>
            )}

            {inactivePlayersCount > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Jogadores inativos sao desconsiderados no sorteio e em todo o calculo estrutural
                    dos times.
                </Alert>
            )}

            <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={3}>
                    <TextField
                        label="Jogadores por time"
                        value={playersPerTeam}
                        onChange={(event) =>
                            setPlayersPerTeam(event.target.value.replace(/\D/g, "").slice(0, 2))
                        }
                        fullWidth
                        required
                        inputMode="numeric"
                    />

                    <CompactSection title="Resumo dinamico de impacto">
                        <CompactInfoRow
                            label="Jogadores ativos para sorteio"
                            value={totalPlayers}
                        />
                        <CompactInfoRow label="Jogadores inativos" value={inactivePlayersCount} />
                        <CompactInfoRow
                            label="Minimo necessario para sortear"
                            value={drawPreview.minimumPlayersNeeded || "-"}
                        />
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

                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                        <Button variant="contained" color="error" onClick={() => navigate(-1)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={() => void handleSave()}
                        >
                            Salvar
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<PlayCircleIcon />}
                            disabled={!drawPreview.isEligible || !isValidConfiguration}
                            onClick={() => {
                                if (existingResult) {
                                    setConfirmDrawDialogOpen(true);
                                    return;
                                }

                                void executeSaveAndDraw();
                            }}
                        >
                            Salvar e realizar sorteio
                        </Button>
                    </Stack>
                </Stack>
            </Paper>

            <ConfirmDialog
                open={confirmDrawDialogOpen}
                title="Confirmar novo sorteio"
                message="O resultado atual sera descartado e substituido por um novo sorteio com a configuracao informada."
                confirmLabel="Salvar e sortear"
                onConfirm={() => {
                    void executeSaveAndDraw();
                }}
                onCancel={() => setConfirmDrawDialogOpen(false)}
            />
        </Box>
    );
}
