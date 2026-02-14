// StagedDatasetList.tsx (or above Dataset component)
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Upload, Pencil, Save, X, Trash2 } from "lucide-react";
import { DatasetItem } from "@/types/types";

type Props = {
    it: DatasetItem;
    isStaged: boolean;
    editingId: number | null;
    editValue: string;
    formatSize: (n: number) => string;
    onStartEdit: (id: number, current: string) => void;
    onCancelEdit: () => void;
    onCommitEdit: () => void;
    onChangeEdit: (v: string) => void;
    onUploadClick: (id: number) => void;
    onDeleteStaged: (id: number) => void;
    onDeleteUploaded: (id: number) => void;
};

export const StagedDatasetList = React.memo(function StagedDatasetList({
    it,
    isStaged,
    editingId,
    editValue,
    formatSize,
    onStartEdit,
    onCancelEdit,
    onCommitEdit,
    onChangeEdit,
    onUploadClick,
    onDeleteStaged,
    onDeleteUploaded,
}: Props) {
    return (
        <li className="flex items-center justify-between p-3 transition-colors hover:bg-gray-900">
            <div className="flex items-center min-w-0">
                {isStaged && (
                    <Button
                        variant="ghost"
                        className="mr-3 h-fit py-2 w-fit hover:bg-gray-800"
                        onClick={() => onUploadClick(it.id)}
                        title="Simulate individual file upload to server"
                    >
                        <Upload className="text-yellow-500 size-5" />
                    </Button>
                )}
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                {editingId === it.id && isStaged ? (
                    <div className="flex items-center gap-2">
                        <Input
                            value={editValue}
                            onChange={(e) => onChangeEdit(e.target.value)}
                            className="h-8 w-56"
                            placeholder="Dataset name"
                        />
                        <Button
                            className="h-9 w-9 p-0"
                            variant="ghost"
                            onClick={onCommitEdit}
                            aria-label="Save"
                        >
                            <Save className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onCancelEdit}
                            aria-label="Cancel"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium">{it.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                            {it.size ? formatSize(it.size) : "???"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">
                            • {isStaged ? "Staged" : "Uploaded"}:{" "}
                            {it.updatedAt ? new Date(it.updatedAt).toLocaleDateString() : "???"}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
                {isStaged && editingId !== it.id && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onStartEdit(it.id, it.name)}
                        aria-label="Rename"
                        title="Rename"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (isStaged ? onDeleteStaged(it.id) : onDeleteUploaded(it.id))}
                    aria-label="Delete"
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
            </div>
        </li>
    );
});
