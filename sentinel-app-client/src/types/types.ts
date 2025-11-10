export type Log = {
    id: string;
    message: string;
    type: string;
    src_ip?: string;
    dest_ip?: string;
    user?: string;
    event_type?: string;
    severity?: string;
    app?: string;
    dest_port?: string;
    src_port?: string;
    status?: string;
    host?: string;
    timestamp?: string;

    _time?: string;
    createdDateTime?: string;
    conditionalAccessStatus?: string;
    riskLevelDuringSignIn?: string;
    appDisplayName?: string;
    ipAddress?: string;
    dest?: string;
    userPrincipalName?: string;
    threatIndicator?: string;

    raw?: Record<string, unknown>;
};

export type DatasetItem = {
    id: number;
    name: string;
    path: string;
    size?: number;
    lastModified?: number;
    content?: string;
    addedAt: string;
    updatedAt?: string;
};

export type DbDataset = {
    id: number;
    dataset_name: string;
    dataset_path: string;
    added_at: string;
};

export type ClientListResponse = {
    count: number;
    items: Array<{ record: DbDataset }>;
};

export enum RelationshipTypes {
    IP_CONNECTION = "IP Connection",
    USER_EVENT = "User Event",
    APP_EVENT = "App Event",
    HOST_EVENT = "Host Event",
    THREAT_INDICATOR = "Threat Indicator"
}

export type NodeData = {
    id: string;
    type: string;
    value: string;
    dataset: string;
    details: Log;
};

export type LinkData = {
    source: string;
    target: string;
    type: RelationshipTypes;
};
export type ClientOneResponse = { record: DbDataset };

export type RawLog = {
    _raw?: string;
    id?: number;
    appDisplayName?: string;
    resourceDisplayName?: string;
    conditionalAccessStatus?: string;
    createdDateTime?: string;
    _time?: string;
    ipAddress?: string;
    src_ip?: string;
    dest?: string;
    user?: string;
    userPrincipalName?: string;
    eventtype?: string | string[];
    riskLevelDuringSignIn?: string;
    status?: {
        failureReason?: string;
    };
    host?: string;
    [key: string]: unknown;
};

export interface UserData {
    id: number;
    token?: string;
    username?: string;
    user_id?: string;
    is_admin: boolean;
    last_login?: string | null;
}
