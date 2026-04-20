import { toast } from "react-toastify";
import { registerSW } from "virtual:pwa-register";

let pwaRegistered = false;

export function registerPWA() {
    if (pwaRegistered || typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return;
    }

    pwaRegistered = true;

    const updateSW = registerSW({
        immediate: true,
        onOfflineReady() {
            toast.success("Aplicativo pronto para uso offline.");
        },
        onNeedRefresh() {
            toast.info("Nova versao disponivel. Atualizando aplicativo...");
            void updateSW(true);
        },
        onRegisterError(error) {
            console.error("Erro ao registrar o service worker do PWA.", error);
        },
    });
}
