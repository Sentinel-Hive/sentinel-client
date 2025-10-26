import { create } from "zustand";
import { UseBoundStore, StoreApi } from "zustand";
import { DatasetItem } from "@/types/types";

interface DatasetStore {
    datasets: DatasetItem[];
    addDataset: (dataset: DatasetItem) => void;
    removeDataset: (id: string) => void;
    clearDatasets: () => void;
}

const DUMMY_DATA: DatasetItem[] = [
    {
        id: "dset_001",
        name: "evil-data_Q4_2023.json",
        size: 15485760,
        lastModified: 1672531200000,
        content: "json",
        addedAt: "2024-01-10T10:00:00Z",
        updatedAt: "2024-01-10T10:00:00Z",
    },
    {
        id: "dset_002",
        name: "web_traffic_2026.json",
        size: 256000,
        lastModified: 1704153600000,
        content: "json",
        addedAt: "2024-02-15T14:30:00Z",
        updatedAt: "2024-02-15T14:30:00Z",
    },
    {
        id: "dset_003",
        name: "Web_Traffic_Logs_2024.json",
        size: 4294967296,
        lastModified: 1711929600000,
        content: "application/zip",
        addedAt: "2024-03-20T08:45:00Z",
        updatedAt: "2024-04-01T11:00:00Z",
    },
];

export const useDatasetStore: UseBoundStore<StoreApi<DatasetStore>> = create<DatasetStore>(
    (set) => ({
        datasets: DUMMY_DATA,
        addDataset: (dataset) => set((state) => ({ datasets: [...state.datasets, dataset] })),
        removeDataset: (id) =>
            set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
        clearDatasets: () => set({ datasets: [] }),
    })
);

export const useDatasets = () => useDatasetStore((state) => state.datasets);
