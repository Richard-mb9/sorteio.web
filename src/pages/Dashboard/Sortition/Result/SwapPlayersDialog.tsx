import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export interface ISwapSelection {
    teamId: string;
    teamLabel: string;
    playerId: string;
    playerName: string;
}

interface ISwapPlayersDialogProps {
    open: boolean;
    firstSelection: ISwapSelection | null;
    secondSelection: ISwapSelection | null;
    onClose: () => void;
    onConfirm: () => void;
}

export default function SwapPlayersDialog({
    open,
    firstSelection,
    secondSelection,
    onClose,
    onConfirm,
}: ISwapPlayersDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Confirmar troca manual</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <Typography>Confirma a troca entre os jogadores selecionados?</Typography>
                    <Stack spacing={1.25}>
                        <Typography variant="subtitle2">Jogador do time A</Typography>
                        <Typography>
                            {firstSelection?.playerName || "-"} ({firstSelection?.teamLabel || "-"})
                        </Typography>
                    </Stack>
                    <Stack spacing={1.25}>
                        <Typography variant="subtitle2">Jogador do time B</Typography>
                        <Typography>
                            {secondSelection?.playerName || "-"} (
                            {secondSelection?.teamLabel || "-"})
                        </Typography>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={onConfirm}>
                    Confirmar troca
                </Button>
            </DialogActions>
        </Dialog>
    );
}
