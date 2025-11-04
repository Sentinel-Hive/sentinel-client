import { ClientListResponse, DatasetItem, DbDataset } from "@/types/types";
import { authFetch } from "./session";
import { useDatasetStore } from "@/store/datasetStore";
function toDatasetItem(r: DbDataset): DatasetItem {
    return {
        id: r.id,
        name: r.dataset_name,
        addedAt: r.added_at,
        path: r.dataset_path,
    };
}
export async function loadAllDatasets(): Promise<DatasetItem[]> {
    const res = await authFetch("/data?include_record=true&include_file=false", {
        method: "GET",
        headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
        useDatasetStore.getState().clearDatasets();
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

    const datasets = (data.items ?? []).map(({ record }) => toDatasetItem(record));

    const store = useDatasetStore.getState();
    store.clearDatasets();
    datasets.forEach((d) => store.addDataset(d));

    return datasets;
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
