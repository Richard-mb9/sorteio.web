import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
    DEFAULT_MAX_CONSECUTIVE_WINS,
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
    const [maxConsecutiveWins, setMaxConsecutiveWins] = useState(
        String(DEFAULT_MAX_CONSECUTIVE_WINS)
    );
    const [doubleExitOnMaxWins, setDoubleExitOnMaxWins] = useState(false);
    const [rotationRandomnessEnabled, setRotationRandomnessEnabled] = useState(false);
    const [confirmDrawDialogOpen, setConfirmDrawDialogOpen] = useState(false);

    const activePlayers = filterActivePlayers(snapshot?.players || []);
    const inactivePlayersCount = (snapshot?.players.length || 0) - activePlayers.length;
    const totalPlayers = activePlayers.length;
    const existingResult = snapshot?.result || null;
    const parsedPlayersPerTeam = Number(playersPerTeam);
    const parsedMaxConsecutiveWins = Number(maxConsecutiveWins);
    const isValidConfiguration = Number.isInteger(parsedPlayersPerTeam) && parsedPlayersPerTeam > 0;
    const isValidWinLimit =
        Number.isInteger(parsedMaxConsecutiveWins) && parsedMaxConsecutiveWins > 0;
    const drawPreview = calculateDrawPreview(
        totalPlayers,
        isValidConfiguration ? parsedPlayersPerTeam : null
    );

    async function refreshSnapshot() {
        const currentSnapshot = await getApplicationStateSnapshot();

        if (currentSnapshot) {
            setSnapshot(currentSnapshot);
            setPlayersPerTeam(currentSnapshot.configuration?.playersPerTeam?.toString() || "");
            setMaxConsecutiveWins(
                String(
                    currentSnapshot.configuration?.maxConsecutiveWins ||
                        DEFAULT_MAX_CONSECUTIVE_WINS
                )
            );
            setDoubleExitOnMaxWins(Boolean(currentSnapshot.configuration?.doubleExitOnMaxWins));
            setRotationRandomnessEnabled(
                Boolean(currentSnapshot.configuration?.rotationRandomnessEnabled)
            );
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

        if (!isValidWinLimit) {
            toast.error("Informe uma quantidade máxima de vitórias válida.");
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
            maxConsecutiveWins: parsedMaxConsecutiveWins,
            doubleExitOnMaxWins,
            rotationRandomnessEnabled,
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
            maxConsecutiveWins: parsedMaxConsecutiveWins,
            doubleExitOnMaxWins,
            rotationRandomnessEnabled,
        });

        if (!configuration) {
            setConfirmDrawDialogOpen(false);
            return;
        }

        const response = await generateNewDraw();

        if (response) {
            await refreshSnapshot();
            navigate("/rotacao");
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
                    Configurações do sorteio
                </Typography>
            </Stack>

            {existingResult && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Alterar a configuração não modifica o resultado atual automaticamente. A nova
                    configuração vale para os próximos sorteios.
                </Alert>
            )}

            {isValidConfiguration && !drawPreview.isEligible && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Não há jogadores suficientes para iniciar o sorteio. Atual: {totalPlayers}.
                    Mínimo necessário: {drawPreview.minimumPlayersNeeded}.
                </Alert>
            )}

            {inactivePlayersCount > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Jogadores inativos são desconsiderados no sorteio e em todo o cálculo estrutural
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

                    <TextField
                        label="Máximo de vitórias consecutivas por time"
                        value={maxConsecutiveWins}
                        onChange={(event) =>
                            setMaxConsecutiveWins(event.target.value.replace(/\D/g, "").slice(0, 2))
                        }
                        fullWidth
                        required
                        inputMode="numeric"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={doubleExitOnMaxWins}
                                onChange={(event) => setDoubleExitOnMaxWins(event.target.checked)}
                            />
                        }
                        label="Remover os dois times quando um atingir o limite de vitórias"
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={rotationRandomnessEnabled}
                                onChange={(event) =>
                                    setRotationRandomnessEnabled(event.target.checked)
                                }
                            />
                        }
                        label="Aleatoriedade na rotação dos times"
                    />

                    <CompactSection title="Resumo dinamico de impacto">
                        <CompactInfoRow
                            label="Jogadores ativos para sorteio"
                            value={totalPlayers}
                        />
                        <CompactInfoRow label="Jogadores inativos" value={inactivePlayersCount} />
                        <CompactInfoRow
                            label="Mínimo necessário para sortear"
                            value={drawPreview.minimumPlayersNeeded || "-"}
                        />
                        <CompactInfoRow
                            label="Quantidade prevista de times"
                            value={drawPreview.totalTeams}
                        />
                        <CompactInfoRow
                            label="Divisão exata"
                            value={drawPreview.exactDivision ? "Sim" : "Não"}
                        />
                        <CompactInfoRow
                            label="Havera time incompleto"
                            value={drawPreview.hasIncompleteTeam ? "Sim" : "Não"}
                        />
                        <CompactInfoRow
                            label="Quantidade prevista no ultimo time"
                            value={drawPreview.lastTeamPlayerCount || "-"}
                        />
                        <CompactInfoRow
                            label="Máximo de vitórias por time"
                            value={isValidWinLimit ? parsedMaxConsecutiveWins : "-"}
                        />
                        <CompactInfoRow
                            label="Saída dupla no limite"
                            value={doubleExitOnMaxWins ? "Ativada" : "Desativada"}
                        />
                        <CompactInfoRow
                            label="Aleatoriedade na rotação dos times"
                            value={rotationRandomnessEnabled ? "Ativada" : "Desativada"}
                        />
                    </CompactSection>

                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        justifyContent={{ xs: "stretch", sm: "flex-end" }}
                    >
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
                            disabled={
                                !drawPreview.isEligible || !isValidConfiguration || !isValidWinLimit
                            }
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
                message="O resultado atual será descartado e substituído por um novo sorteio com a configuração informada."
                confirmLabel="Salvar e sortear"
                onConfirm={() => {
                    void executeSaveAndDraw();
                }}
                onCancel={() => setConfirmDrawDialogOpen(false)}
            />
        </Box>
    );
}
