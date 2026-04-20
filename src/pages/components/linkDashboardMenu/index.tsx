import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { type JSX, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export interface ISubItem {
    text: string;
    to: string;
    icon: JSX.Element;
}

interface ILinkDashboardMenuProps {
    text: string;
    to?: string;
    icon: JSX.Element;
    onClick?: () => void;
    subItems?: ISubItem[];
}

export default function LinkDashboardMenu({
    text,
    to,
    icon,
    onClick,
    subItems,
}: ILinkDashboardMenuProps) {
    const location = useLocation();
    const hasSubItems = Boolean(subItems && subItems.length > 0);
    const isChildActive = hasSubItems
        ? subItems!.some((subItem) => location.pathname.startsWith(subItem.to))
        : false;
    const isSelfActive = !hasSubItems && to ? location.pathname.startsWith(to) : false;
    const isActive = isChildActive || isSelfActive;
    const [manualOpen, setManualOpen] = useState(false);
    const open = isChildActive || manualOpen;

    if (hasSubItems) {
        return (
            <>
                <ListItem disablePadding>
                    <ListItemButton
                        onClick={() => setManualOpen((previous) => !previous)}
                        selected={isActive}
                    >
                        <ListItemIcon>{icon}</ListItemIcon>
                        <ListItemText primary={text} />
                        <ChevronRightIcon
                            fontSize="small"
                            sx={{
                                transition: "transform 0.2s",
                                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                        />
                    </ListItemButton>
                </ListItem>
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List disablePadding>
                        {subItems!.map((subItem) => (
                            <ListItem key={subItem.to} disablePadding sx={{ pl: 2 }}>
                                <ListItemButton
                                    component={Link}
                                    to={subItem.to}
                                    selected={location.pathname.startsWith(subItem.to)}
                                    onClick={onClick}
                                >
                                    <ListItemIcon>{subItem.icon}</ListItemIcon>
                                    <ListItemText primary={subItem.text} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Collapse>
            </>
        );
    }

    return (
        <ListItem disablePadding>
            <ListItemButton component={Link} to={to!} selected={isActive} onClick={onClick}>
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={text} />
            </ListItemButton>
        </ListItem>
    );
}
