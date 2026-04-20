import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: false,
            includeAssets: [
                "favicon.svg",
                "apple-touch-icon.png",
                "mask-icon.svg",
                "pwa-192x192.png",
                "pwa-512x512.png",
                "pwa-maskable-512x512.png",
            ],
            manifest: {
                id: "/",
                name: "Sorteio de Times",
                short_name: "Sorteio",
                description: "Sistema local para sorteio equilibrado de times.",
                theme_color: "#7e14ff",
                background_color: "#ffffff",
                display: "standalone",
                lang: "pt-BR",
                scope: "/",
                start_url: "/",
                icons: [
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
                navigateFallback: "index.html",
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
            },
        }),
    ],
    server: {
        port: 3001,
    },
    preview: {
        port: 3001,
    },
    build: {
        outDir: "build",
    },
});
