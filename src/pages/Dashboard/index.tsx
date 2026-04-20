import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuIcon from "@mui/icons-material/Menu";
import SportsVolleyballIcon from "@mui/icons-material/SportsVolleyball";
import TuneIcon from "@mui/icons-material/Tune";
import ViewListIcon from "@mui/icons-material/ViewList";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { APPLICATION_NAME } from "../../config";
import LinkDashboardMenu from "../components/linkDashboardMenu";
import UsernameDisplay from "../components/UsernameDisplay";
import PlayersPage from "./Players";
import PanelPage from "./Sortition/Panel";
import ResultPage from "./Sortition/Result";
import SettingsPage from "./Sortition/Settings";

const drawerWidth = 280;

const pageTitles: Record<string, string> = {
    "/painel": "Painel do Sorteio",
    "/jogadores": "Jogadores",
    "/configuracoes": "Configuracoes do Sorteio",
    "/resultado": "Resultado do Sorteio",
};

function getPageTitle(pathname: string) {
    if (pageTitles[pathname]) {
        return pageTitles[pathname];
    }

    return APPLICATION_NAME;
}

export default function Dashboard() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        const title = getPageTitle(location.pathname);
        document.title = `${title} - ${APPLICATION_NAME}`;
    }, [location.pathname]);

    const handleDrawerClose = () => {
        setIsClosing(true);
        setMobileOpen(false);
    };

    const handleDrawerTransitionEnd = () => {
        setIsClosing(false);
    };

    const handleDrawerToggle = () => {
        if (!isClosing) {
            setMobileOpen((previous) => !previous);
        }
    };

    const handleMobileLinkClick = () => {
        setMobileOpen(false);
    };

    const drawer = (
        <div>
            <Box sx={{ p: 2.5 }}>
                <Typography variant="h6" component="h1">
                    {APPLICATION_NAME}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Sorteio local e mobile-first
                </Typography>
            </Box>
            <Divider />
            <List>
                <LinkDashboardMenu
                    text="Sorteio"
                    icon={<SportsVolleyballIcon color="primary" />}
                    onClick={handleMobileLinkClick}
                    subItems={[
                        {
                            text: "Painel",
                            to: "/painel",
                            icon: <ViewListIcon color="primary" />,
                        },
                        {
                            text: "Configuracoes",
                            to: "/configuracoes",
                            icon: <TuneIcon color="primary" />,
                        },
                        {
                            text: "Resultado",
                            to: "/resultado",
                            icon: <EmojiEventsIcon color="primary" />,
                        },
                    ]}
                />
                <LinkDashboardMenu
                    text="Jogadores"
                    to="/jogadores"
                    icon={<GroupsIcon color="primary" />}
                    onClick={handleMobileLinkClick}
                />
            </List>
        </div>
    );

    return (
        <Box sx={{ display: "flex" }}>
            <AppBar position="fixed" sx={{ display: { xs: "flex", md: "none" } }}>
                <Toolbar sx={{ justifyContent: "space-between" }}>
                    <IconButton
                        color="inherit"
                        aria-label="Abrir menu"
                        edge="start"
                        onClick={handleDrawerToggle}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" noWrap>
                        {APPLICATION_NAME}
                    </Typography>
                    {/* <UsernameDisplay /> */}
                </Toolbar>
            </AppBar>

            <AppBar
                position="fixed"
                color="default"
                elevation={1}
                sx={{
                    display: { xs: "none", md: "flex" },
                    width: `calc(100% - ${drawerWidth}px)`,
                    ml: `${drawerWidth}px`,
                }}
            >
                <Toolbar sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body1" color="text.secondary">
                        Modulo local sem autenticacao
                    </Typography>
                    <UsernameDisplay />
                </Toolbar>
            </AppBar>

            <Box
                component="nav"
                sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
                aria-label="Menu de navegacao"
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onTransitionEnd={handleDrawerTransitionEnd}
                    onClose={handleDrawerClose}
                    sx={{
                        display: { xs: "block", md: "none" },
                        "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
                    }}
                    slotProps={{
                        root: {
                            keepMounted: true,
                        },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    open
                    sx={{
                        display: { xs: "none", md: "block" },
                        "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 2, sm: 3 },
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    mt: { xs: "64px", md: "64px" },
                }}
            >
                <Routes>
                    <Route element={<Navigate replace to="/painel" />} path="/" />
                    <Route element={<PanelPage />} path="/painel" />
                    <Route element={<PlayersPage />} path="/jogadores" />
                    <Route element={<SettingsPage />} path="/configuracoes" />
                    <Route element={<ResultPage />} path="/resultado" />
                </Routes>
            </Box>
        </Box>
    );
}
