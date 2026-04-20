import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { type ReactNode, useMemo, useState } from "react";

export interface IViewMenuAction {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
}

interface IViewActionsMenuProps {
    actions: IViewMenuAction[];
}

function getActionIcon(label: string) {
    const normalizedLabel = label.toLocaleLowerCase("pt-BR");

    if (normalizedLabel.includes("editar")) {
        return <EditIcon fontSize="small" />;
    }

    if (normalizedLabel.includes("limpar")) {
        return <DeleteSweepIcon fontSize="small" />;
    }

    return <SettingsIcon fontSize="small" />;
}

export default function ViewActionsMenu({ actions }: IViewActionsMenuProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const resolvedActions = useMemo(
        () =>
            actions.map((action) => ({
                ...action,
                icon: action.icon || getActionIcon(action.label),
            })),
        [actions]
    );

    return (
        <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
            <IconButton
                aria-label="Abrir menu de acoes"
                onClick={(event) => setAnchorEl(event.currentTarget)}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
                {resolvedActions.map((action) => (
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
        </Box>
    );
}
