export const APPLICATION_NAME =
    (import.meta.env.VITE_APPLICATION_NAME as string | undefined) || "Sorteio de Times";

export const APPLICATION_STORAGE_NAMESPACE =
    (import.meta.env.VITE_APPLICATION_STORAGE_NAMESPACE as string | undefined) ||
    "sorteio.web.local-state";
