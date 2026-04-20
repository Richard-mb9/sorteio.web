import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { toast } from "react-toastify";
import {
    normalizePlayerName,
    type IPlayer,
    type PlayerGender,
} from "../../../../commons/sortition";

interface IPlayerFormDialogProps {
    open: boolean;
    title: string;
    submitLabel: string;
    players: IPlayer[];
    player?: IPlayer | null;
    keepOpenAfterSubmit?: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; gender: PlayerGender }) => Promise<boolean>;
}

export default function PlayerFormDialog({
    open,
    title,
    submitLabel,
    players,
    player,
    keepOpenAfterSubmit = false,
    onClose,
    onSubmit,
}: IPlayerFormDialogProps) {
    const initialGender: PlayerGender = player?.gender || "M";
    const [name, setName] = useState(player?.name || "");
    const [gender, setGender] = useState<PlayerGender>(initialGender);

    const validateForm = () => {
        if (!name.trim()) {
            toast.error("Informe o nome do jogador.");
            return false;
        }

        const normalizedName = normalizePlayerName(name);
        const hasDuplicate = players.some(
            (currentPlayer) =>
                currentPlayer.normalizedName === normalizedName && currentPlayer.id !== player?.id
        );

        if (hasDuplicate) {
            toast.error("Ja existe um jogador com esse nome.");
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        const hasSaved = await onSubmit({
            name,
            gender,
        });

        if (hasSaved) {
            if (keepOpenAfterSubmit) {
                setName("");
                setGender("M");
                return;
            }

            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2.5} sx={{ pt: 1 }}>
                    <TextField
                        autoFocus
                        label="Nome"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        fullWidth
                        required
                    />
                    <FormControl component="fieldset" required>
                        <FormLabel component="legend">Genero</FormLabel>
                        <RadioGroup
                            row
                            value={gender}
                            onChange={(event) => setGender(event.target.value as PlayerGender)}
                        >
                            <FormControlLabel value="M" control={<Radio />} label="Masculino" />
                            <FormControlLabel value="F" control={<Radio />} label="Feminino" />
                        </RadioGroup>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={handleSubmit}>
                    {submitLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
