import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

interface IConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    onConfirm,
    onCancel,
}: IConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{cancelLabel}</Button>
                <Button onClick={onConfirm} variant="contained" color="error">
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
