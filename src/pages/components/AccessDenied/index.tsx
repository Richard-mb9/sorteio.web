import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";

interface IAccessDeniedProps {
    message?: string;
}

export default function AccessDenied({
    message = "Voce nao tem permissao para acessar esta pagina.",
}: IAccessDeniedProps) {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "60vh",
            }}
        >
            <Paper sx={{ p: { xs: 2, sm: 3 }, textAlign: "center", maxWidth: 420 }}>
                <Stack spacing={2.5} alignItems="center">
                    <LockIcon sx={{ fontSize: 64, color: "error.main" }} />
                    <Typography variant="h5" component="h1" color="error">
                        Acesso negado
                    </Typography>
                    <Typography color="text.secondary">{message}</Typography>
                    <Button
                        variant="contained"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate(-1)}
                    >
                        Voltar
                    </Button>
                </Stack>
            </Paper>
        </Box>
    );
}
