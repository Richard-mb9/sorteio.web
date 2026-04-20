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
    DEFAULT_PLAYER_NOTA,
    MAX_PLAYER_NOTA,
    MIN_PLAYER_NOTA,
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
    onSubmit: (data: { name: string; gender: PlayerGender; nota: number }) => Promise<boolean>;
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
    const initialNota = typeof player?.nota === "number" ? player.nota : DEFAULT_PLAYER_NOTA;
    const [name, setName] = useState(player?.name || "");
    const [gender, setGender] = useState<PlayerGender>(initialGender);
    const [notaInput, setNotaInput] = useState<string>(String(initialNota));

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

        const parsedNota = Number(notaInput);
        if (
            notaInput.trim() === "" ||
            !Number.isInteger(parsedNota) ||
            parsedNota < MIN_PLAYER_NOTA ||
            parsedNota > MAX_PLAYER_NOTA
        ) {
            toast.error(`Informe uma nota inteira entre ${MIN_PLAYER_NOTA} e ${MAX_PLAYER_NOTA}.`);
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
            nota: Number(notaInput),
        });

        if (hasSaved) {
            if (keepOpenAfterSubmit) {
                setName("");
                setGender("M");
                setNotaInput(String(DEFAULT_PLAYER_NOTA));
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
                    <TextField
                        label={`Nota (${MIN_PLAYER_NOTA} a ${MAX_PLAYER_NOTA})`}
                        type="number"
                        value={notaInput}
                        onChange={(event) => setNotaInput(event.target.value)}
                        inputProps={{
                            min: MIN_PLAYER_NOTA,
                            max: MAX_PLAYER_NOTA,
                            step: 1,
                            inputMode: "numeric",
                        }}
                        helperText="Nota tecnica inteira usada no balanceamento dos times."
                        fullWidth
                        required
                    />
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
