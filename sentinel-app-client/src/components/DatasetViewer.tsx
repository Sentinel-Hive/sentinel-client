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

type Props = {
    open: boolean;
    dataset: DatasetItem;
    onOpenChange: (open: boolean) => void;
    hideTitle?: boolean;
};

export default function DatasetViewer({ open, dataset, onOpenChange, hideTitle = false }: Props) {
    const titleText = dataset ? `Record Details — ${dataset.name || "Dataset"}` : "Record Details";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-96 max-h-[70vh] overflow-y-auto bg-black">
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
                    <pre className="text-xs whitespace-pre-wrap break-words">
                        {dataset.content ? dataset.content : "No Content Could To Display"}
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    );
}
