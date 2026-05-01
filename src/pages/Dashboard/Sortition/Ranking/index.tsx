import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { filterActivePlayers, type IApplicationSnapshot } from "../../../../commons/sortition";
import usePermissions from "../../../../hooks/usePermissions";
import useSortition from "../../../../services/useSortition";
import BackButton from "../../../components/BackButton";
import AccessDenied from "../../../components/AccessDenied";

interface IRankingRow {
    playerId: string;
    playerName: string;
    games: number;
    wins: number;
}

export default function RankingPage() {
    const { hasAnyPermission } = usePermissions();
    const { getApplicationStateSnapshot } = useSortition();
    const canRead = hasAnyPermission(["sortition:read", "sortition:*"]);

    const [snapshot, setSnapshot] = useState<IApplicationSnapshot | null>(null);

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

    const rankingRows = useMemo(() => {
        const activePlayers = filterActivePlayers(snapshot?.players || []);
        const activePlayersById = new Map(activePlayers.map((player) => [player.id, player]));
        const activePlayerIdsByName = new Map(
            activePlayers.map((player) => [player.name, player.id])
        );
        const rowsByPlayerId = new Map<string, IRankingRow>();

        for (const match of snapshot?.result?.matchHistory || []) {
            const winnerIds =
                match.winnerPlayerIds ||
                match.winnerPlayers
                    .map((playerName) => activePlayerIdsByName.get(playerName))
                    .filter((playerId): playerId is string => Boolean(playerId));
            const loserIds =
                match.loserPlayerIds ||
                match.loserPlayers
                    .map((playerName) => activePlayerIdsByName.get(playerName))
                    .filter((playerId): playerId is string => Boolean(playerId));
            const playerIdsInMatch = new Set([...winnerIds, ...loserIds]);

            for (const playerId of playerIdsInMatch) {
                const player = activePlayersById.get(playerId);

                if (!player) {
                    continue;
                }

                const currentRow = rowsByPlayerId.get(playerId) || {
                    playerId,
                    playerName: player.name,
                    games: 0,
                    wins: 0,
                };

                currentRow.games += 1;

                if (winnerIds.includes(playerId)) {
                    currentRow.wins += 1;
                }

                rowsByPlayerId.set(playerId, currentRow);
            }
        }

        return [...rowsByPlayerId.values()].sort((playerA, playerB) => {
            if (playerA.wins !== playerB.wins) {
                return playerB.wins - playerA.wins;
            }

            return playerA.playerName.localeCompare(playerB.playerName, "pt-BR");
        });
    }, [snapshot]);

    if (!canRead) {
        return <AccessDenied message="Você não tem permissão para visualizar o ranking." />;
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                <BackButton />
                <Typography variant="h5" component="h1">
                    Ranking
                </Typography>
            </Stack>

            {!snapshot?.result && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Realize um sorteio para iniciar o ranking da rotação.
                </Alert>
            )}

            {snapshot?.result && rankingRows.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Nenhum jogador ativo participou de partidas finalizadas nesta rotação.
                </Alert>
            )}

            <Stack spacing={1.5}>
                {rankingRows.map((row, index) => (
                    <Paper key={row.playerId} sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle1">
                                    {index + 1}. {row.playerName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {row.games} {row.games === 1 ? "jogo" : "jogos"}
                                </Typography>
                            </Stack>
                            <Chip
                                label={`${row.wins} ${row.wins === 1 ? "vitória" : "vitórias"}`}
                                color="primary"
                            />
                        </Stack>
                    </Paper>
                ))}
            </Stack>
        </Box>
    );
}
