import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type PropsWithChildren, type ReactNode } from "react";

interface ICompactSectionProps {
    title?: string;
}

interface ICompactInfoRowProps {
    label: string;
    value: ReactNode;
}

function renderValue(value: ReactNode) {
    if (value === null || value === undefined || value === "") {
        return <Typography variant="body2">-</Typography>;
    }

    if (typeof value === "string" || typeof value === "number") {
        return <Typography variant="body2">{value}</Typography>;
    }

    return value;
}

export function CompactSection({ title, children }: PropsWithChildren<ICompactSectionProps>) {
    return (
        <Stack spacing={1.25}>
            {title && (
                <Typography variant="subtitle1" component="h2" fontWeight={600}>
                    {title}
                </Typography>
            )}
            <Stack spacing={0.75}>{children}</Stack>
        </Stack>
    );
}

export function CompactInfoRow({ label, value }: ICompactInfoRowProps) {
    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                columnGap: 0.75,
                rowGap: 0.5,
                alignItems: "center",
            }}
        >
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {label}:
            </Typography>
            <Box sx={{ minWidth: 0, flex: 1 }}>{renderValue(value)}</Box>
        </Box>
    );
}
