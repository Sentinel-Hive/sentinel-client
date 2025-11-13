import { create } from "zustand";
import { UseBoundStore, StoreApi } from "zustand";
import { useMemo } from "react";
import { DatasetItem, Log } from "@/types/types";
import { parseLogsFromContent } from "@/lib/utils";

interface DatasetStore {
    datasets: DatasetItem[];
    selectedDatasetIds: number[];
    logsCache: Record<number, Log[]>; // cache parsed logs per dataset id
    addDataset: (dataset: DatasetItem) => void;
    updateDataset: (id: number, partial: Partial<DatasetItem>) => void;
    removeDataset: (id: number) => void;
    clearDatasets: () => void;
    toggleDatasetSelection: (id: number) => void;
    setSelectedDatasetIds: (ids: number[]) => void;
    clearSelectedDatasetIds: () => void;
}

function calculateSize(content: string): number {
    return new Blob([content]).size;
}

export const useDatasetStore: UseBoundStore<StoreApi<DatasetStore>> = create<DatasetStore>(
    (set) => ({
        datasets: [],
        selectedDatasetIds: [],
        logsCache: {},
        addDataset: (dataset) =>
            set((state) => {
                const size = dataset.size ?? calculateSize(dataset.content ?? "");
                const updatedDataset = { ...dataset, size };
                const parsedLogs = parseLogsFromContent(updatedDataset.content ?? "").map((l) => ({
                    ...l,
                    datasetId: updatedDataset.id,
                    datasetName: updatedDataset.name,
                }));
                return {
                    datasets: [...state.datasets, updatedDataset],
                    logsCache: { ...state.logsCache, [updatedDataset.id]: parsedLogs },
                };
            }),
        updateDataset: (id, partial) =>
            set((state) => {
                const newDatasets = state.datasets.map((d) =>
                    d.id === id
                        ? {
                              ...d,
                              ...partial,
                              size: partial.content ? calculateSize(partial.content) : d.size,
                          }
                        : d
                );
                // If content changed, refresh cache
                let newCache = { ...state.logsCache };
                const target = newDatasets.find((d) => d.id === id);
                if (target && ("content" in partial)) {
                    newCache[id] = parseLogsFromContent(target.content ?? "").map((l) => ({
                        ...l,
                        datasetId: target.id,
                        datasetName: target.name,
                    }));
                }
                return { datasets: newDatasets, logsCache: newCache };
            }),
        removeDataset: (id) =>
            set((state) => {
                const { [id]: _, ...rest } = state.logsCache;
                return {
                    datasets: state.datasets.filter((d) => d.id !== id),
                    logsCache: rest,
                    selectedDatasetIds: state.selectedDatasetIds.filter((x) => x !== id),
                };
            }),
        clearDatasets: () => set({ datasets: [], logsCache: {}, selectedDatasetIds: [] }),
        toggleDatasetSelection: (id) =>
            set((state) => ({
                selectedDatasetIds: state.selectedDatasetIds.includes(id)
                    ? state.selectedDatasetIds.filter((x) => x !== id)
                    : [...state.selectedDatasetIds, id],
            })),
        setSelectedDatasetIds: (ids) => set({ selectedDatasetIds: ids }),
        clearSelectedDatasetIds: () => set({ selectedDatasetIds: [] }),
    })
);

export const useDatasets = () => useDatasetStore((state) => state.datasets);
export const useSelectedDatasetIds = () =>
    useDatasetStore((state) => state.selectedDatasetIds);

// Return a stable array reference for selected datasets
export const useSelectedDatasets = () => {
    const ids = useDatasetStore((state) => state.selectedDatasetIds);
    const datasets = useDatasetStore((state) => state.datasets);
    return useMemo(() => datasets.filter((d) => ids.includes(d.id)), [datasets, ids]);
};

// Return a stable array reference for selected logs to avoid infinite re-renders
export const useSelectedLogs = () => {
    const ids = useDatasetStore((state) => state.selectedDatasetIds);
    const cache = useDatasetStore((state) => state.logsCache);
    return useMemo(() => ids.flatMap((id) => cache[id] ?? []), [ids, cache]);
};
