import { DatasetItem } from "@/types/types";
import { authFetch } from "./session";

export type DbRecord = Record<string, unknown>;
export type AllRecordsResponse = {
    count: number;
    items: { record: DbRecord }[];
};

export async function fetchAllRecordsMeta(): Promise<AllRecordsResponse> {
    const res = await authFetch("/data?include_record=true&include_file=false", {
        method: "GET",
        headers: { Accept: "application/json" },
    });
    console.log(res);
    if (res.status === 404) {
        return { count: 0, items: [] };
    }
    if (!res.ok) {
        let detail = "";
        try {
            const j = await res.json();
            detail = j?.detail || JSON.stringify(j);
        } catch {
            detail = await res.text();
        }
        throw new Error(`Fetch failed (${res.status}): ${detail}`);
    }
    return res.json();
}

export async function postDatasetToServer(payload: DatasetItem) {
    const res = await authFetch("/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        let detail = "";
        try {
            const j = await res.json();
            detail = j?.detail || JSON.stringify(j);
        } catch {
            detail = await res.text();
        }
        throw new Error(`Upload failed (${res.status}): ${detail}`);
    }
    return res.json() as Promise<{ success?: boolean; id?: string }>;
}
