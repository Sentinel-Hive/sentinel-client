import { create } from "zustand";
import { UseBoundStore, StoreApi } from "zustand";
import { DatasetItem } from "@/types/types";

interface DatasetStore {
    datasets: DatasetItem[];
    addDataset: (dataset: DatasetItem) => void;
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
        removeDataset: (id) =>
            set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
        clearDatasets: () => set({ datasets: [] }),
    })
);

export const useDatasets = () => useDatasetStore((state) => state.datasets);
