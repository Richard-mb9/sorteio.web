import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { type ReactNode, useMemo, useState } from "react";

interface IMobileCardField {
    label: string;
    value: ReactNode;
}

export interface IMobileCardAction {
    label: string;
    icon: ReactNode;
    onClick: () => void;
}

interface IMobileCardProps {
    fields: IMobileCardField[];
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    menuActions?: IMobileCardAction[];
}

export default function MobileCard({
    fields,
    onView,
    onEdit,
    onDelete,
    menuActions = [],
}: IMobileCardProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isMenuOpen = Boolean(anchorEl);

    const extraActions = useMemo(() => {
        const actions: IMobileCardAction[] = [...menuActions];

        if (onEdit) {
            actions.push({
                label: "Editar",
                icon: <EditIcon fontSize="small" />,
                onClick: onEdit,
            });
        }

        if (onDelete) {
            actions.push({
                label: "Remover",
                icon: <DeleteIcon fontSize="small" />,
                onClick: onDelete,
            });
        }

        return actions;
    }, [menuActions, onDelete, onEdit]);

    return (
        <Card variant="outlined" sx={{ mb: 1.5 }}>
            <CardContent sx={{ pb: onView ? 1 : 2 }}>
                {extraActions.length > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                        <IconButton
                            size="small"
                            aria-label="Abrir menu de acoes"
                            onClick={(event) => setAnchorEl(event.currentTarget)}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )}

                {fields.map((field, index) => (
                    <Box
                        key={`${field.label}-${index}`}
                        sx={{ mb: index < fields.length - 1 ? 1 : 0 }}
                    >
                        <Typography variant="caption" color="text.secondary" component="span">
                            {field.label}:{" "}
                        </Typography>
                        {typeof field.value === "string" || typeof field.value === "number" ? (
                            <Typography variant="body2" component="span">
                                {field.value}
                            </Typography>
                        ) : (
                            <Box component="span" sx={{ display: "inline" }}>
                                {field.value}
                            </Box>
                        )}
                    </Box>
                ))}
            </CardContent>

            {onView && (
                <>
                    <Divider />
                    <CardActions sx={{ justifyContent: "flex-end" }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={onView}
                        >
                            Visualizar
                        </Button>
                    </CardActions>
                </>
            )}

            {extraActions.length > 0 && (
                <Menu anchorEl={anchorEl} open={isMenuOpen} onClose={() => setAnchorEl(null)}>
                    {extraActions.map((action) => (
                        <MenuItem
                            key={action.label}
                            onClick={() => {
                                setAnchorEl(null);
                                action.onClick();
                            }}
                        >
                            <ListItemIcon>{action.icon}</ListItemIcon>
                            <ListItemText>{action.label}</ListItemText>
                        </MenuItem>
                    ))}
                </Menu>
            )}
        </Card>
    );
}
