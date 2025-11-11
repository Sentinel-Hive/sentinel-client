import { ClientListResponse, DatasetItem, DbDataset } from "@/types/types";
import { authFetch } from "./session";
import { useDatasetStore } from "@/store/datasetStore";
import { toast } from "sonner";
function toDatasetItem(r: DbDataset): DatasetItem {
    return {
        id: r.id,
        name: r.dataset_name,
        addedAt: r.added_at,
        path: r.dataset_path,
    };
}

export interface LoadDatasetsOptions {
    id?: string;
    include_record?: boolean;
    include_file?: boolean;
}

export async function loadAllDatasets({
    id,
    include_record = true,
    include_file = false,
}: LoadDatasetsOptions = {}): Promise<DatasetItem[]> {
    const params = new URLSearchParams();

    params.set("include_record", String(include_record));
    params.set("include_file", String(include_file));

    if (id) {
        params.set("id", id);
    }

    const res = await authFetch(`/data?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
        toast.error(`An error occurred fetching the datasets. Error: ${res.status}`);
        return [];
    }

    if (!res.ok) {
        let detail = "";
        try {
            const j: unknown = await res.json();
            detail =
                typeof j === "object" && j !== null && "detail" in j
                    ? String((j as Record<string, unknown>).detail)
                    : JSON.stringify(j);
        } catch {
            detail = await res.text();
        }
        throw new Error(`Fetch failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as ClientListResponse;

    const fetchedDatasets = (data.items ?? []).map(({ record }) => toDatasetItem(record));

    const store = useDatasetStore.getState();
    const existing = store.datasets;
    const existingById = new Map(existing.map((d) => [d.id, d]));

    for (const d of fetchedDatasets) {
        if (existingById.has(d.id)) {
            store.updateDataset(d.id, d);
        } else {
            store.addDataset(d);
        }
    }

    return fetchedDatasets;
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

export async function fetchDatasetContent(datasetId: number, path: string): Promise<string | null> {
    const params = new URLSearchParams({
        id: String(datasetId),
        include_record: "false",
        include_file: "true",
        file_path: path,
    });

    const res = await authFetch(`/data?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
    });

    if (!res.ok) {
        console.error("Failed to fetch dataset file", res.status);
        return null;
    }

    const body = await res.json();
    const fileData = body[0];
    console.log(fileData);

    if (fileData == null) return null;

    if (typeof fileData === "string") {
        return fileData;
    }

    return JSON.stringify(fileData, null, 2);
}
