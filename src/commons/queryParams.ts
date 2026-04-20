export const DEFAULT_ROWS_PER_PAGE = 30;
export const DEFAULT_ROWS_PER_PAGE_OPTIONS = [20, 30, 50];

export function readPageParam(searchParams: URLSearchParams) {
    const rawValue = Number(searchParams.get("page"));

    if (!Number.isInteger(rawValue) || rawValue < 0) {
        return 0;
    }

    return rawValue;
}

export function readRowsPerPageParam(searchParams: URLSearchParams) {
    const rawValue = Number(searchParams.get("perPage"));

    if (!DEFAULT_ROWS_PER_PAGE_OPTIONS.includes(rawValue)) {
        return DEFAULT_ROWS_PER_PAGE;
    }

    return rawValue;
}

export function updateUrlSearchParams(
    searchParams: URLSearchParams,
    updates: Record<string, number | string | null | undefined>
) {
    const nextSearchParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            nextSearchParams.delete(key);
            return;
        }

        nextSearchParams.set(key, String(value));
    });

    return nextSearchParams;
}
