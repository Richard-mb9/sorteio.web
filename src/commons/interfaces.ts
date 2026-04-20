export interface IHistoryChange {
    field: string;
    path: string;
    oldValue: unknown;
    newValue: unknown;
    valueType: "string" | "number" | "boolean" | "list" | "date" | "null";
}

export interface IHistory {
    id: number;
    entityType: string;
    entityId: number;
    action: "CREATE" | "UPDATE" | "DELETE";
    description: string;
    agentUsername: string;
    changes: IHistoryChange[];
    createdAt: string;
}
