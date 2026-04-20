export interface IPaginationParams {
    page?: number;
    perPage?: number;
}

export interface IPaginatedResponse<T> {
    data: T[];
    count: number;
    page: number;
}
