"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle, AlertTriangle, Trash2, Loader } from "lucide-react";
import { DatasetItem } from "@/types/types";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useDatasets, useDatasetStore } from "@/store/datasetStore";
import { loadAllDatasets, postDatasetToServer, deleteDatasetOnServer } from "@/lib/dataHandler";
import { StagedDatasetList } from "./StagedDatasetList";
import { formatSize } from "@/lib/utils";

export default function Dataset() {
    const datasets = useDatasets();
    const { removeDataset, addDataset } = useDatasetStore();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadStatus, setUploadStatus] = useState<string>("");
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [isError, setIsError] = useState<boolean>(false);

    const [stagedItems, setStagedItems] = useState<DatasetItem[]>([]);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    const [isBulkUploading, setIsBulkUploading] = useState(false);

    const hasUnsaved = stagedItems.length > 0;

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!hasUnsaved) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsaved]);

    useEffect(() => {
        const loadData = async () => {
            await loadAllDatasets();
        };
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, []);
    const isSaving = uploadStatus.startsWith("Saving");
    const humanCount = useMemo(() => String(selectedFiles.length || 0), [selectedFiles.length]);

    const validateJsonLike = (text: string, filename: string) => {
        try {
            JSON.parse(text);
            return;
        } catch {
            // do nothing
        }

        const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        if (lines.length === 0) {
            throw new Error(`File "${filename}" does not contain any JSON content.`);
        }

        try {
            for (const line of lines) {
                JSON.parse(line);
            }
        } catch {
            throw new Error(
                `File "${filename}" is not valid JSON, JSONL, or NDJSON. Each non-empty line must be valid JSON.`
            );
        }
    };

    const nextTempId = React.useCallback(() => {
        let candidate: number;
        const used = new Set(stagedItems.map((i) => i.id));
        do {
            candidate = Math.floor(Math.random() * 1_000_000_000); // 0..999,999,999
        } while (used.has(candidate));
        return candidate;
    }, [stagedItems]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList) return;

        const files: File[] = Array.from(fileList).filter((file) => {
            const lower = file.name.toLowerCase();
            if (lower.endsWith(".json") || lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
                return true;
            }
            return file.type === "application/json";
        });

        setSelectedFiles(files);
        setUploadStatus("");
        setIsError(false);
    };

    const handleUploadClick = async (itemId: number) => {
        const itemToUpload = stagedItems.find((item) => item.id === itemId);
        if (!itemToUpload || uploadingId === itemId) return;
        try {
            setUploadingId(itemId);

            const { id: _tempId, ...rest } = itemToUpload;
            const payload = {
                ...rest,
                updatedAt: new Date().toISOString(),
            } as unknown as DatasetItem;

            const result = await postDatasetToServer(payload);

            if (!result?.success || !result?.id) {
                throw new Error(
                    "An unexpected error occurred while pushing the data to the server."
                );
            }

            const datasetForStore: DatasetItem = {
                ...itemToUpload,
                id: Number(result.id),
                size:
                    typeof itemToUpload.size === "number"
                        ? itemToUpload.size
                        : new Blob([itemToUpload.content ?? ""]).size,
            };

            addDataset(datasetForStore);

            setStagedItems((prev) => prev.filter((it) => it.id !== itemId));

            toast.success("Uploaded", {
                description: `"${itemToUpload.name}" was uploaded${result?.id ? ` (id: ${result.id})` : ""}.`,
            });
            return true;
        } catch (e) {
            const msg = (e as Error)?.message || "Upload failed";
            toast.error("Upload failed", { description: msg });
            return false;
        } finally {
            setUploadingId(null);
        }
    };

    const handleUploadAllClick = async () => {
        if (stagedItems.length === 0 || isBulkUploading) return;

        setIsBulkUploading(true);

        const ids = stagedItems.map((i) => i.id);
        let successCount = 0;
        let failCount = 0;

        for (const id of ids) {
            const ok = await handleUploadClick(id);
            if (ok) successCount++;
            else failCount++;
        }

        setIsBulkUploading(false);

        if (successCount && !failCount) {
            toast.success("All staged datasets uploaded", {
                description: `${successCount} ${successCount === 1 ? "item" : "items"} uploaded successfully.`,
            });
        } else if (successCount && failCount) {
            toast.warning("Upload completed with some errors", {
                description: `${successCount} succeeded, ${failCount} failed.`,
            });
        } else {
            toast.error("No datasets were uploaded", {
                description: "Every upload attempt failed.",
            });
        }
    };

    const handleStageData = async () => {
        if (selectedFiles.length === 0) {
            setUploadStatus("Please select one or more JSON/JSONL/NDJSON files.");
            setIsError(true);
            return;
        }

        setUploadStatus("Saving to memory...");
        setIsError(false);

        try {
            const newItems: DatasetItem[] = [];
            for (const f of selectedFiles) {
                const text = await f.text();

                validateJsonLike(text, f.name);

                newItems.push({
                    id: nextTempId(),
                    name: f.name.replace(/\.(json|jsonl|ndjson)$/i, ""),
                    path: "",
                    size: f.size,
                    lastModified: f.lastModified,
                    content: text,
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }

            setStagedItems((prev) => [...newItems, ...prev]);
            setSelectedFiles([]);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            setUploadStatus(`Saved ${newItems.length} file(s) to memory. (Not uploaded)`);
            setIsError(false);
        } catch (error) {
            setUploadStatus((error as Error).message || "Failed to read files");
            setIsError(true);
        } finally {
            setSelectedFiles([]);
        }
    };

    const startEdit = (id: number, current: string) => {
        setEditingId(id);
        setEditValue(current);
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
    };
    const commitEdit = () => {
        if (!editingId) return;
        const trimmed = editValue.trim();
        if (!trimmed) return cancelEdit();
        setStagedItems((prev) =>
            prev.map((it) =>
                it.id === editingId
                    ? { ...it, name: trimmed, updatedAt: new Date().toISOString() }
                    : it
            )
        );
        cancelEdit();
    };

    const handleDelete = (id: number) => {
        setStagedItems((prev) => prev.filter((it) => it.id !== id));
    };

    const handleDeleteUploaded = (id: number) => {
        const ds = datasets.find((d) => d.id === id);
        const name = ds?.name ?? String(id);

        // Use a toast-based confirmation with explicit irreversible warning
        const tid = toast.custom((t) => (
            <div className="bg-neutral-900 border border-neutral-700 rounded-md p-3 text-sm max-w-md">
                <div className="font-medium text-yellow-400 mb-1">Delete dataset permanently?</div>
                <div className="text-neutral-200 mb-3">
                    You are about to permanently delete{" "}
                    <span className="font-semibold">{name}</span> (ID {id}). This action cannot be
                    undone.
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-200"
                        onClick={() => toast.dismiss(t as any)}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                        onClick={async () => {
                            try {
                                // call backend first to ensure permanent deletion
                                await deleteDatasetOnServer(id);
                                // update local store
                                removeDataset(id);
                                toast.dismiss(t as any);
                                toast.success("Dataset deleted", {
                                    description: `${name} (ID ${id}) was permanently removed.`,
                                });
                            } catch (e) {
                                toast.dismiss(t as any);
                                toast.error("Delete failed", {
                                    description:
                                        (e as Error)?.message || "Unable to delete dataset.",
                                });
                            }
                        }}
                    >
                        Delete permanently
                    </button>
                </div>
            </div>
        ));

        return tid;
    };

    return (
        <div className="flex w-full max-h-[75vh] overflow-y-auto border-yellow-600 border p-5">
            <Card className="w-full border-none max-w-3xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Upload className="h-5 w-5 text-yellow-600" />
                        <span>Dataset Manager</span>
                    </CardTitle>
                    <Alert className="border-yellow-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Heads up</AlertTitle>
                        <AlertDescription>
                            Files saved here live <strong>only in memory</strong>. Staged datasets
                            will be lost if you leave or refresh this page. Click{" "}
                            <strong>Upload All</strong> to commit them.
                        </AlertDescription>
                    </Alert>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="flex w-full items-center space-x-4">
                        <Input
                            id="json-files"
                            type="file"
                            accept=".json, .jsonl, .ndjson"
                            multiple
                            onChange={handleFileChange}
                            className="flex-1"
                            ref={fileInputRef}
                        />
                        <Button
                            onClick={handleStageData}
                            disabled={selectedFiles.length === 0 || isSaving}
                            className="flex items-center space-x-2 bg-yellow-600 hover:bg-yellow-700"
                        >
                            {isSaving ? (
                                <>
                                    <span className="animate-spin">🔄</span>
                                    <span>Saving…</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    <span>Stage ({humanCount})</span>
                                </>
                            )}
                        </Button>
                    </div>

                    {uploadStatus && (
                        <Alert
                            variant={isError ? "destructive" : "default"}
                            className={isError ? "border-red-500" : "border-green-500"}
                        >
                            {isError ? (
                                <AlertTriangle className="h-4 w-4" />
                            ) : (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            <AlertTitle>{isError ? "Problem" : "Success"}</AlertTitle>
                            <AlertDescription>{uploadStatus}</AlertDescription>
                        </Alert>
                    )}

                    {selectedFiles.length > 0 && !isSaving && (
                        <div className="space-y-2 p-3 bg-muted rounded-md">
                            <h3 className="text-sm font-semibold text-gray-700">Ready to Stage:</h3>
                            <ul className="space-y-1">
                                {selectedFiles.map((file) => (
                                    <li
                                        key={file.name}
                                        className="flex items-center text-sm text-gray-600"
                                    >
                                        <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <span>
                                            {file.name} ({formatSize(file.size)})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="space-y-3 pt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                                Staged Datasets
                            </h3>
                            <Button
                                onClick={handleUploadAllClick}
                                disabled={
                                    stagedItems.length === 0 ||
                                    isBulkUploading ||
                                    uploadingId !== null
                                }
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                            >
                                {isBulkUploading ? (
                                    <>
                                        <span className="animate-spin">
                                            <Loader />
                                        </span>
                                        <span>Uploading…</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        <span>Upload All ({stagedItems.length})</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {stagedItems.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-3 border rounded-md">
                                Nothing staged yet. Add some JSON files above and click{" "}
                                <strong>Stage</strong>.
                            </div>
                        ) : (
                            <ul className="divide-y rounded-md border">
                                {stagedItems.map((it) => (
                                    <StagedDatasetList
                                        key={it.id}
                                        it={it}
                                        isStaged={true}
                                        editingId={editingId}
                                        editValue={editValue}
                                        formatSize={formatSize}
                                        onStartEdit={startEdit}
                                        onCancelEdit={cancelEdit}
                                        onCommitEdit={commitEdit}
                                        onChangeEdit={setEditValue}
                                        onUploadClick={handleUploadClick}
                                        onDeleteStaged={handleDelete}
                                        onDeleteUploaded={handleDeleteUploaded}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>

                    <hr className="my-6 border-t border-gray-200" />

                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                            Uploaded Datasets ({datasets.length})
                        </h3>

                        {datasets.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-3 border rounded-md">
                                No datasets have been uploaded yet. Stage and then{" "}
                                <strong>Upload All</strong> to see them here.
                            </div>
                        ) : (
                            <div className="rounded-md border max-h-[65vh] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Id</TableHead>
                                            <TableHead>Dataset Name</TableHead>
                                            <TableHead className="w-20">Path</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {datasets.map((it) => (
                                            <TableRow key={it.id} className="hover:bg-gray-900">
                                                <TableCell className="text-muted-foreground">
                                                    <div className="flex items-center h-full">
                                                        {it.id}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center">
                                                        <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                                        <span className="truncate font-medium">
                                                            {it.name}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-muted-foreground">
                                                    <div className="flex items-center h-full">
                                                        {it.path}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end h-full">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                handleDeleteUploaded(it.id)
                                                            }
                                                            aria-label="Delete"
                                                            title="Delete Uploaded Dataset"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
