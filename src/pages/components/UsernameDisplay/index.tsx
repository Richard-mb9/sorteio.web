import Typography from "@mui/material/Typography";

export default function UsernameDisplay() {
    return (
        <Typography
            variant="body2"
            noWrap
            sx={{ maxWidth: { xs: 120, sm: 200 }, overflow: "hidden", textOverflow: "ellipsis" }}
        >
            Modo local
        </Typography>
    );
}
