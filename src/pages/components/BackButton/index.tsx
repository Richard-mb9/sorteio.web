import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";

export default function BackButton() {
    const navigate = useNavigate();

    return (
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Voltar
        </Button>
    );
}
