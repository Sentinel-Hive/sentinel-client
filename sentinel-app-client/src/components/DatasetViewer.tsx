import { DatasetItem } from "@/types/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { VisuallyHidden } from "./VisuallyHidden";
import { formatSize } from "@/lib/utils";
import { useEffect } from "react";
import { fetchDatasetContent } from "@/lib/dataHandler";
import { useDatasetStore } from "@/store/datasetStore";

type Props = {
    open: boolean;
    dataset: DatasetItem;
    onOpenChange: (open: boolean) => void;
    hideTitle?: boolean;
};

export default function DatasetViewer({ open, dataset, onOpenChange, hideTitle = false }: Props) {
    const titleText = dataset ? `Record Details — ${dataset.name || "Dataset"}` : "Record Details";
    const { updateDataset } = useDatasetStore();

    useEffect(() => {
        if (dataset.content && dataset.content !== "") return;
        const loadContent = async () => {
            try {
                const res = await fetchDatasetContent(dataset.id, dataset.path);

                if (res != null) {
                    updateDataset(dataset.id, { content: res });
                }
            } catch (err) {
                console.error("Failed to load dataset content", err);
            }
        };

        loadContent();
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[70vh] overflow-y-auto bg-black border rounded border-yellow-400">
                {hideTitle ? (
                    <VisuallyHidden>
                        <DialogTitle>{titleText}</DialogTitle>
                        <DialogDescription></DialogDescription>
                    </VisuallyHidden>
                ) : (
                    <DialogHeader>
                        <DialogTitle>{titleText}</DialogTitle>
                        <DialogDescription></DialogDescription>
                    </DialogHeader>
                )}
                <div className="flex flex-col gap-4 mt-2">
                    <div className="flex gap-5">
                        <span>
                            <strong>Id:</strong> {dataset.id}
                        </span>
                        <span>
                            <strong>Path:</strong> {dataset.path}
                        </span>
                        <span>
                            <strong>Size:</strong> {dataset.size ? formatSize(dataset.size) : "???"}
                        </span>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap break-words border border-white p-2 rounded">
                        {dataset.content ? dataset.content : "No Content Could To Display"}
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    );
}
