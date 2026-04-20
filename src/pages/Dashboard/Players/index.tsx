import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import EditIcon from "@mui/icons-material/Edit";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    filterActivePlayers,
    formatDateTime,
    formatGenderLabel,
    isDrawResultOutdated,
    type IApplicationSnapshot,
    type IPlayer,
    type PlayerGender,
} from "../../../commons/sortition";
import {
    DEFAULT_ROWS_PER_PAGE_OPTIONS,
    readPageParam,
    readRowsPerPageParam,
    updateUrlSearchParams,
} from "../../../commons/queryParams";
import usePermissions from "../../../hooks/usePermissions";
import useSortition from "../../../services/useSortition";
import { CompactInfoRow, CompactSection } from "../../components/CompactInfo";
import ConfirmDialog from "../../components/ConfirmDialog";
import MobileCard from "../../components/MobileCard";
import AccessDenied from "../../components/AccessDenied";
import PlayerFormDialog from "../Sortition/Panel/PlayerFormDialog";

type PlayerStatusFilter = "active" | "inactive";

function getStatusLabel(isActive: boolean) {
    return isActive ? "Ativo" : "Inativo";
}

function getStatusColor(isActive: boolean): "success" | "default" {
    return isActive ? "success" : "default";
}

export default function PlayersPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { hasAnyPermission } = usePermissions();
    const {
        getApplicationStateSnapshot,
        getPlayers,
        createNewPlayer,
        updateExistingPlayer,
        setExistingPlayerActivity,
        deleteExistingPlayer,
        clearExistingPlayers,
    } = useSortition();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const canRead = hasAnyPermission(["sortition:read", "sortition:*"]);
    const canManage = hasAnyPermission(["sortition:update", "sortition:*"]);

    const page = readPageParam(searchParams);
    const rowsPerPage = readRowsPerPageParam(searchParams);
    const appliedSearch = searchParams.get("search") || "";
    const rawAppliedGender = searchParams.get("gender");
    const rawAppliedStatus = searchParams.get("status");
    const appliedGender =
        rawAppliedGender === "M" || rawAppliedGender === "F"
            ? (rawAppliedGender as PlayerGender)
            : undefined;
    const appliedStatus =
        rawAppliedStatus === "active" || rawAppliedStatus === "inactive"
            ? (rawAppliedStatus as PlayerStatusFilter)
            : undefined;
    const appliedIsActive =
        appliedStatus === "active" ? true : appliedStatus === "inactive" ? false : undefined;

    const [formSearch, setFormSearch] = useState(appliedSearch);
    const [formGender, setFormGender] = useState<PlayerGender | "">(appliedGender || "");
    const [formStatus, setFormStatus] = useState<PlayerStatusFilter | "">(appliedStatus || "");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(
        Boolean(appliedGender || appliedStatus)
    );
    const [snapshot, setSnapshot] = useState<IApplicationSnapshot | null>(null);
    const [players, setPlayers] = useState<IPlayer[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [clearPlayersDialogOpen, setClearPlayersDialogOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<IPlayer | null>(null);

    const allPlayers = snapshot?.players || [];
    const activePlayers = filterActivePlayers(allPlayers);
    const inactivePlayersCount = allPlayers.length - activePlayers.length;
    const advancedActiveCount = Number(Boolean(appliedGender)) + Number(Boolean(appliedStatus));
    const appliedAdvancedFilters = [
        ...(appliedGender ? [`Genero: ${appliedGender === "M" ? "Masculino" : "Feminino"}`] : []),
        ...(appliedStatus ? [`Status: ${appliedStatus === "active" ? "Ativo" : "Inativo"}`] : []),
    ];
    const isResultOutdated = isDrawResultOutdated(
        snapshot?.result || null,
        allPlayers,
        snapshot?.configuration || null
    );

    useEffect(() => {
        setFormSearch(appliedSearch);
        setFormGender(appliedGender || "");
        setFormStatus(appliedStatus || "");
    }, [appliedSearch, appliedGender, appliedStatus]);

    async function refreshData() {
        const currentSnapshot = await getApplicationStateSnapshot();

        if (currentSnapshot) {
            setSnapshot(currentSnapshot);
        }

        const playerResponse = await getPlayers({
            page,
            perPage: rowsPerPage,
            search: appliedSearch,
            gender: appliedGender,
            isActive: appliedIsActive,
        });

        if (playerResponse) {
            setPlayers(playerResponse.data);
            setTotalCount(playerResponse.count);
        }
    }

    useEffect(() => {
        if (!canRead) {
            return;
        }

        async function run() {
            await refreshData();
        }

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, rowsPerPage, appliedSearch, appliedGender, appliedIsActive, canRead]);

    const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSearchParams(
            updateUrlSearchParams(searchParams, {
                search: formSearch.trim(),
                gender: formGender || undefined,
                status: formStatus || undefined,
                page: 0,
                perPage: rowsPerPage,
            })
        );
    };

    const handleClearAdvancedFilters = () => {
        setFormGender("");
        setFormStatus("");
        setSearchParams(
            updateUrlSearchParams(searchParams, {
                gender: undefined,
                status: undefined,
                page: 0,
            })
        );
    };

    const handleChangePage = (_event: unknown, newPage: number) => {
        setSearchParams(
            updateUrlSearchParams(searchParams, {
                page: newPage,
                perPage: rowsPerPage,
            })
        );
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchParams(
            updateUrlSearchParams(searchParams, {
                page: 0,
                perPage: Number(event.target.value),
            })
        );
    };

    const handleMobileRowsPerPageChange = (value: number) => {
        setSearchParams(
            updateUrlSearchParams(searchParams, {
                page: 0,
                perPage: value,
            })
        );
    };

    const handleCreatePlayer = async (data: { name: string; gender: PlayerGender }) => {
        const createdPlayer = await createNewPlayer(data);

        if (!createdPlayer) {
            return false;
        }

        await refreshData();
        return true;
    };

    const handleUpdatePlayer = async (data: { name: string; gender: PlayerGender }) => {
        if (!selectedPlayer) {
            return false;
        }

        const updatedPlayer = await updateExistingPlayer(selectedPlayer.id, data);

        if (!updatedPlayer) {
            return false;
        }

        await refreshData();
        return true;
    };

    const handleDeletePlayer = async () => {
        if (!selectedPlayer) {
            return;
        }

        const success = await deleteExistingPlayer(selectedPlayer.id);

        if (success) {
            await refreshData();
        }

        setDeleteDialogOpen(false);
        setSelectedPlayer(null);
    };

    const handleSetPlayerActivity = async (player: IPlayer, isActive: boolean) => {
        const updatedPlayer = await setExistingPlayerActivity(player.id, isActive);

        if (updatedPlayer) {
            await refreshData();
        }
    };

    const handleClearPlayers = async () => {
        const response = await clearExistingPlayers();

        if (response) {
            await refreshData();
        }

        setClearPlayersDialogOpen(false);
    };

    const statusSummaryLabel = useMemo(() => {
        if (!snapshot?.result) {
            return "Sem resultado salvo";
        }

        return isResultOutdated ? "Resultado desatualizado" : "Resultado ativo";
    }, [isResultOutdated, snapshot]);

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
                    Jogadores
                </Typography>
                {canManage && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        {allPlayers.length > 0 && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteSweepIcon />}
                                onClick={() => setClearPlayersDialogOpen(true)}
                            >
                                Limpar jogadores
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            Adicionar jogador
                        </Button>
                    </Stack>
                )}
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
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {snapshot.restoration.message}
                </Alert>
            )}

            {isResultOutdated && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    O resultado salvo pode ter sido afetado por alteracoes na lista de jogadores
                    ativos.
                </Alert>
            )}

            {inactivePlayersCount > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Jogadores inativos ficam cadastrados, mas sao ignorados no sorteio e em todo o
                    calculo da formacao dos times.
                </Alert>
            )}

            <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
                <Stack spacing={3}>
                    <CompactSection title="Resumo de jogadores">
                        <CompactInfoRow label="Total cadastrados" value={allPlayers.length} />
                        <CompactInfoRow label="Ativos para sorteio" value={activePlayers.length} />
                        <CompactInfoRow label="Inativos" value={inactivePlayersCount} />
                        <CompactInfoRow
                            label="Homens ativos"
                            value={activePlayers.filter((player) => player.gender === "M").length}
                        />
                        <CompactInfoRow
                            label="Mulheres ativas"
                            value={activePlayers.filter((player) => player.gender === "F").length}
                        />
                        <CompactInfoRow label="Status do resultado" value={statusSummaryLabel} />
                    </CompactSection>
                </Stack>
            </Paper>

            <Paper component="form" onSubmit={handleSearchSubmit} sx={{ p: 2, mb: 2 }}>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        alignItems={{ xs: "stretch", md: "center" }}
                    >
                        <TextField
                            label="Buscar jogador"
                            value={formSearch}
                            onChange={(event) => setFormSearch(event.target.value)}
                            fullWidth
                        />
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{ width: { xs: "100%", md: "auto" } }}
                        >
                            <Button
                                type="submit"
                                variant="contained"
                                startIcon={<SearchIcon />}
                                sx={{ flexGrow: { xs: 1, md: 0 } }}
                            >
                                Pesquisar
                            </Button>
                            <Button
                                type="button"
                                variant="outlined"
                                size="small"
                                startIcon={<FilterAltIcon />}
                                onClick={() => setShowAdvancedFilters((previous) => !previous)}
                            >
                                Filtros
                            </Button>
                            {advancedActiveCount > 0 && (
                                <Chip label={advancedActiveCount} size="small" color="primary" />
                            )}
                        </Stack>
                    </Stack>

                    {advancedActiveCount > 0 && (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {appliedAdvancedFilters.map((label) => (
                                <Chip key={label} label={label} size="small" />
                            ))}
                        </Stack>
                    )}

                    <Collapse in={showAdvancedFilters}>
                        <Divider sx={{ mb: 2 }} />
                        <Stack spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Genero</InputLabel>
                                <Select
                                    value={formGender}
                                    label="Genero"
                                    onChange={(event) =>
                                        setFormGender(
                                            (event.target.value as PlayerGender | "") || ""
                                        )
                                    }
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="M">Masculino</MenuItem>
                                    <MenuItem value="F">Feminino</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={formStatus}
                                    label="Status"
                                    onChange={(event) =>
                                        setFormStatus(
                                            (event.target.value as PlayerStatusFilter | "") || ""
                                        )
                                    }
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="active">Ativos</MenuItem>
                                    <MenuItem value="inactive">Inativos</MenuItem>
                                </Select>
                            </FormControl>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    type="button"
                                    size="small"
                                    onClick={handleClearAdvancedFilters}
                                >
                                    Limpar filtros
                                </Button>
                            </Stack>
                        </Stack>
                    </Collapse>
                </Stack>
            </Paper>

            {isMobile ? (
                <Box>
                    <FormControl size="small" sx={{ minWidth: 160, mb: 2 }}>
                        <InputLabel id="players-per-page-label">Linhas por pagina</InputLabel>
                        <Select
                            labelId="players-per-page-label"
                            value={String(rowsPerPage)}
                            label="Linhas por pagina"
                            onChange={(event) =>
                                handleMobileRowsPerPageChange(Number(event.target.value))
                            }
                        >
                            {DEFAULT_ROWS_PER_PAGE_OPTIONS.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {players.map((player) => (
                        <MobileCard
                            key={player.id}
                            fields={[
                                { label: "Nome", value: player.name },
                                { label: "Genero", value: formatGenderLabel(player.gender) },
                                {
                                    label: "Status",
                                    value: (
                                        <Chip
                                            label={getStatusLabel(player.isActive)}
                                            size="small"
                                            color={getStatusColor(player.isActive)}
                                        />
                                    ),
                                },
                                { label: "Atualizado em", value: formatDateTime(player.updatedAt) },
                            ]}
                            onEdit={
                                canManage
                                    ? () => {
                                          setSelectedPlayer(player);
                                          setEditDialogOpen(true);
                                      }
                                    : undefined
                            }
                            onDelete={
                                canManage
                                    ? () => {
                                          setSelectedPlayer(player);
                                          setDeleteDialogOpen(true);
                                      }
                                    : undefined
                            }
                            menuActions={
                                canManage
                                    ? [
                                          {
                                              label: player.isActive ? "Inativar" : "Ativar",
                                              icon: player.isActive ? (
                                                  <PauseCircleOutlineIcon fontSize="small" />
                                              ) : (
                                                  <PlayCircleOutlineIcon fontSize="small" />
                                              ),
                                              onClick: () => {
                                                  void handleSetPlayerActivity(
                                                      player,
                                                      !player.isActive
                                                  );
                                              },
                                          },
                                      ]
                                    : []
                            }
                        />
                    ))}

                    {players.length === 0 && (
                        <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                            Nenhum registro encontrado
                        </Typography>
                    )}

                    <TablePagination
                        rowsPerPageOptions={[]}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                    />
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Nome</TableCell>
                                <TableCell>Genero</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Atualizado em</TableCell>
                                <TableCell align="center">Acoes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {players.map((player) => (
                                <TableRow key={player.id} hover>
                                    <TableCell>{player.name}</TableCell>
                                    <TableCell>{formatGenderLabel(player.gender)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(player.isActive)}
                                            size="small"
                                            color={getStatusColor(player.isActive)}
                                        />
                                    </TableCell>
                                    <TableCell>{formatDateTime(player.updatedAt)}</TableCell>
                                    <TableCell
                                        align="center"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <Stack direction="row" spacing={0} justifyContent="center">
                                            {canManage && (
                                                <Tooltip title="Editar">
                                                    <IconButton
                                                        color="primary"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setSelectedPlayer(player);
                                                            setEditDialogOpen(true);
                                                        }}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {canManage && (
                                                <Tooltip
                                                    title={player.isActive ? "Inativar" : "Ativar"}
                                                >
                                                    <IconButton
                                                        color={
                                                            player.isActive ? "warning" : "success"
                                                        }
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void handleSetPlayerActivity(
                                                                player,
                                                                !player.isActive
                                                            );
                                                        }}
                                                    >
                                                        {player.isActive ? (
                                                            <PauseCircleOutlineIcon />
                                                        ) : (
                                                            <PlayCircleOutlineIcon />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {canManage && (
                                                <Tooltip title="Remover">
                                                    <IconButton
                                                        color="error"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setSelectedPlayer(player);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {players.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">
                                        <Typography color="text.secondary" sx={{ py: 2 }}>
                                            Nenhum registro encontrado
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        rowsPerPageOptions={DEFAULT_ROWS_PER_PAGE_OPTIONS}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Linhas por pagina:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                    />
                </TableContainer>
            )}

            <PlayerFormDialog
                key={createDialogOpen ? "create-open" : "create-closed"}
                open={createDialogOpen}
                title="Cadastrar jogador"
                submitLabel="Salvar"
                players={allPlayers}
                keepOpenAfterSubmit
                onClose={() => setCreateDialogOpen(false)}
                onSubmit={handleCreatePlayer}
            />

            <PlayerFormDialog
                key={`${selectedPlayer?.id || "edit"}-${editDialogOpen ? "open" : "closed"}`}
                open={editDialogOpen}
                title="Editar jogador"
                submitLabel="Salvar alteracoes"
                players={allPlayers}
                player={selectedPlayer}
                onClose={() => {
                    setEditDialogOpen(false);
                    setSelectedPlayer(null);
                }}
                onSubmit={handleUpdatePlayer}
            />

            <ConfirmDialog
                open={deleteDialogOpen}
                title="Confirmar remocao"
                message={`Tem certeza que deseja remover "${selectedPlayer?.name || "este jogador"}"?`}
                confirmLabel="Remover"
                onConfirm={() => {
                    void handleDeletePlayer();
                }}
                onCancel={() => {
                    setDeleteDialogOpen(false);
                    setSelectedPlayer(null);
                }}
            />

            <ConfirmDialog
                open={clearPlayersDialogOpen}
                title="Limpar jogadores"
                message={`Voce vai remover ${allPlayers.length} jogadores. A configuracao sera mantida e qualquer resultado salvo sera limpo.`}
                confirmLabel="Confirmar limpeza"
                onConfirm={() => {
                    void handleClearPlayers();
                }}
                onCancel={() => setClearPlayersDialogOpen(false)}
            />
        </Box>
    );
}
