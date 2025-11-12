import { create } from "zustand";
import { UseBoundStore, StoreApi } from "zustand";
import { DatasetItem } from "@/types/types";

interface DatasetStore {
    datasets: DatasetItem[];
    addDataset: (dataset: DatasetItem) => void;
    updateDataset: (id: number, partial: Partial<DatasetItem>) => void;
    removeDataset: (id: number) => void;
    clearDatasets: () => void;
}

function calculateSize(content: string): number {
    return new Blob([content]).size;
}

export const useDatasetStore: UseBoundStore<StoreApi<DatasetStore>> = create<DatasetStore>(
    (set) => ({
        datasets: [],
        addDataset: (dataset) =>
            set((state) => {
                const size = dataset.size ?? calculateSize(dataset.content ?? "");
                const updatedDataset = { ...dataset, size };
                return { datasets: [...state.datasets, updatedDataset] };
            }),
        updateDataset: (id, partial) =>
            set((state) => ({
                datasets: state.datasets.map((d) =>
                    d.id === id
                        ? {
                              ...d,
                              ...partial,
                              size: partial.content ? calculateSize(partial.content) : d.size,
                          }
                        : d
                ),
            })),
        removeDataset: (id) =>
            set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
        clearDatasets: () => set({ datasets: [] }),
    })
);

export const useDatasets = () => useDatasetStore((state) => state.datasets);
