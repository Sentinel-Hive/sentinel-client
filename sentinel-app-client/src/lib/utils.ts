import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DatasetItem, JsonValue, Log, RawLog } from "@/types/types";

export function getLogField(log: Log, field: string): string {
    switch (field) {
        case "src_ip":
            return log.src_ip ?? "";
        case "dest_ip":
            return log.dest_ip ?? "";
        case "user":
            return log.user ?? "";
        case "event_type":
            return log.event_type ?? "";
        case "severity":
            return log.severity ?? "";
        case "app":
            return log.app ?? "";
        case "dest_port":
            return log.dest_port ?? "";
        case "src_port":
            return log.src_port ?? "";
        case "status":
            return log.status ?? "";
        case "host":
            return log.host ?? "";
        case "timestamp":
            return log.timestamp ?? "";
        case "_time":
            return log._time ?? "";
        case "createdDateTime":
            return log.createdDateTime ?? "";
        case "conditionalAccessStatus":
            return log.conditionalAccessStatus ?? "";
        case "riskLevelDuringSignIn":
            return log.riskLevelDuringSignIn ?? "";
        case "appDisplayName":
            return log.appDisplayName ?? "";
        case "ipAddress":
            return log.ipAddress ?? "";
        case "dest":
            return log.dest ?? "";
        case "userPrincipalName":
            return log.userPrincipalName ?? "";
        case "threatIndicator":
            return log.threatIndicator ?? "";
        default: {
            if (log.raw && field in log.raw) {
                const value = log.raw[field];
                if (
                    typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean"
                ) {
                    return String(value);
                }
            }
            return "";
        }
    }
}

export function getLogTimestamp(log: Log): string | undefined {
    return log.timestamp || log.createdDateTime || log._time;
}

// Generic JSON-object helper based on your JsonValue type
type JsonObject = { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Build a Log from a generic JSON object, not assuming RawLog shape too strictly
function jsonObjectToLog(obj: JsonObject, fallbackId: string): Log {
    const idValue = obj["id"];
    const id =
        typeof idValue === "string" || typeof idValue === "number" ? String(idValue) : fallbackId;

    const rawField = obj["_raw"];
    const statusField = obj["status"];
    const eventTypeField = obj["eventtype"];

    const messageFromRaw = typeof rawField === "string" ? rawField : "";
    const messageFromStatus =
        isJsonObject(statusField) && typeof statusField["failureReason"] === "string"
            ? statusField["failureReason"]
            : "";

    const messageFallback = messageFromRaw || messageFromStatus || JSON.stringify(obj);

    const eventTypeString =
        typeof eventTypeField === "string"
            ? eventTypeField
            : Array.isArray(eventTypeField)
              ? eventTypeField.map((v) => String(v)).join(",")
              : "info";

    const primaryEventType =
        typeof eventTypeField === "string"
            ? eventTypeField
            : Array.isArray(eventTypeField) && eventTypeField.length > 0
              ? String(eventTypeField[0])
              : undefined;

    const srcIp =
        typeof obj["src_ip"] === "string"
            ? obj["src_ip"]
            : typeof obj["ipAddress"] === "string"
              ? obj["ipAddress"]
              : undefined;

    const timestampValue =
        typeof obj["createdDateTime"] === "string"
            ? obj["createdDateTime"]
            : typeof obj["_time"] === "string"
              ? obj["_time"]
              : undefined;

    return {
        id,
        message: messageFallback,
        type: eventTypeString,

        src_ip: srcIp,
        dest_ip: typeof obj["dest"] === "string" ? obj["dest"] : undefined,
        user: typeof obj["user"] === "string" ? obj["user"] : undefined,
        event_type: primaryEventType,
        severity:
            typeof obj["riskLevelDuringSignIn"] === "string"
                ? obj["riskLevelDuringSignIn"]
                : undefined,
        app: typeof obj["appDisplayName"] === "string" ? obj["appDisplayName"] : undefined,
        dest_port: undefined,
        src_port: undefined,
        status:
            typeof obj["conditionalAccessStatus"] === "string"
                ? obj["conditionalAccessStatus"]
                : undefined,
        host: typeof obj["host"] === "string" ? obj["host"] : undefined,
        timestamp: timestampValue,

        _time: typeof obj["_time"] === "string" ? obj["_time"] : undefined,
        createdDateTime:
            typeof obj["createdDateTime"] === "string" ? obj["createdDateTime"] : undefined,
        conditionalAccessStatus:
            typeof obj["conditionalAccessStatus"] === "string"
                ? obj["conditionalAccessStatus"]
                : undefined,
        riskLevelDuringSignIn:
            typeof obj["riskLevelDuringSignIn"] === "string"
                ? obj["riskLevelDuringSignIn"]
                : undefined,
        appDisplayName:
            typeof obj["appDisplayName"] === "string" ? obj["appDisplayName"] : undefined,
        ipAddress: typeof obj["ipAddress"] === "string" ? obj["ipAddress"] : undefined,
        dest: typeof obj["dest"] === "string" ? obj["dest"] : undefined,
        userPrincipalName:
            typeof obj["userPrincipalName"] === "string" ? obj["userPrincipalName"] : undefined,
        threatIndicator:
            typeof obj["threatIndicator"] === "string" ? obj["threatIndicator"] : undefined,

        raw: obj,
    };
}

export function parseLogsFromContent(content: string | null | undefined): Log[] {
    if (!content) return [];

    const trimmed = content.trim();
    if (trimmed.length === 0) return [];

    const logs: Log[] = [];

    let parsedWhole: JsonValue | null = null;
    try {
        parsedWhole = JSON.parse(trimmed) as JsonValue;
    } catch {
        parsedWhole = null;
    }

    let nextId = 1;

    if (parsedWhole && Array.isArray(parsedWhole)) {
        parsedWhole.forEach((item) => {
            if (isJsonObject(item)) {
                logs.push(jsonObjectToLog(item, String(nextId++)));
            }
        });
        if (logs.length > 0) return logs;
    }

    const lines = trimmed.split(/\r?\n/);
    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        try {
            const parsedLine = JSON.parse(l) as JsonValue;
            if (isJsonObject(parsedLine)) {
                logs.push(jsonObjectToLog(parsedLine, String(nextId++)));
            }
        } catch {
            // ignore malformed lines
        }
    }

    return logs;
}

export function parseSQLQuery(q: string): Record<string, string> {
    const out: Record<string, string> = {};
    const regex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(q)) !== null) {
        out[match[1]] = match[2];
    }
    return out;
}

export function uniqueFieldValues(logs: Log[], field: string): string[] {
    const values = new Set<string>();
    logs.forEach((log) => {
        const value = getLogField(log, field);
        if (value.length > 0) {
            values.add(value);
        }
    });
    return Array.from(values);
}

export function getDatasetLabel(dataset: DatasetItem): string {
    if (dataset.name && dataset.name.length > 0) return dataset.name;
    return String(dataset.id);
}

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function parseFlexibleJson(text: string): { objects: unknown[] } {
    const trimmed = text.trim();
    const out: unknown[] = [];

    // 1) Try plain JSON (object/array/primitive)
    try {
        const v = JSON.parse(trimmed);
        out.push(v);
        return { objects: out };
    } catch {
        // continue
    }

    // 2) Try NDJSON (JSON Lines) — one JSON object per non-empty line
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length > 1) {
        try {
            const objs = lines.map((l) => JSON.parse(l));
            return { objects: objs };
        } catch {
            // fall through to concatenated parser
        }
    }

    // 3) Try concatenated objects: {}{} or {} \n {} \n {}
    //    Streaming parse by brace/bracket depth and string handling
    const objs: unknown[] = [];
    let i = 0;
    const n = trimmed.length;
    const isWs = (c: string) => /\s/.test(c);

    while (i < n) {
        // skip whitespace
        while (i < n && isWs(trimmed[i])) i++;

        if (i >= n) break;
        const start = i;

        // Determine first non-ws char must begin a JSON value
        const first = trimmed[i];
        if (!'{["tfn-0123456789'.includes(first)) {
            // not a valid start => fail this strategy
            break;
        }

        // If it’s a primitive (true/false/null/number/string), let JSON.parse
        // find its boundary by scanning forward until it parses
        if (first !== "{" && first !== "[") {
            let j = i + 1;
            let parsed = false;
            while (j <= n) {
                try {
                    const chunk = trimmed.slice(i, j);
                    const v = JSON.parse(chunk);
                    objs.push(v);
                    i = j;
                    parsed = true;
                    break;
                } catch {
                    j++;
                }
            }
            if (!parsed) break;
            continue;
        }

        // If it’s an object/array, track bracket depth safely
        let depth = 0;
        let inStr = false;
        let esc = false;

        while (i < n) {
            const c = trimmed[i];
            if (inStr) {
                if (esc) {
                    esc = false;
                } else if (c === "\\") {
                    esc = true;
                } else if (c === '"') {
                    inStr = false;
                }
            } else {
                if (c === '"') inStr = true;
                else if (c === "{" || c === "[") depth++;
                else if (c === "}" || c === "]") {
                    depth--;
                    if (depth === 0) {
                        // end of a complete JSON value
                        const chunk = trimmed.slice(start, i + 1);
                        try {
                            const v = JSON.parse(chunk);
                            objs.push(v);
                            i = i + 1;
                            break;
                        } catch {
                            // can't parse this chunk => abort
                            i = n + 1; // force failure
                            break;
                        }
                    }
                }
            }
            i++;
        }

        if (depth !== 0) {
            // unbalanced
            break;
        }
    }

    if (objs.length > 0) {
        return { objects: objs };
    }

    throw new Error("Invalid JSON: not a single JSON value, NDJSON, or concatenated JSON objects.");
}

export const formatSize = (sizeInBytes: number) => {
    if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
};
