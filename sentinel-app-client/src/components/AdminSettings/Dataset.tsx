"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Upload,
    FileText,
    CheckCircle,
    AlertTriangle,
    Trash2,
    Pencil,
    Save,
    X,
} from "lucide-react";
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

const formatSize = (sizeInBytes: number) => {
    if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
};

export default function Dataset() {
    const datasets = useDatasets();
    const { addDataset, removeDataset } = useDatasetStore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadStatus, setUploadStatus] = useState<string>("");
    const [isError, setIsError] = useState<boolean>(false);

    const [items, setItems] = useState<DatasetItem[]>([]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    const hasUnsaved = items.length > 0;

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!hasUnsaved) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsaved]);

    const isSaving = uploadStatus.startsWith("Saving");
    const humanCount = useMemo(() => String(selectedFiles.length || 0), [selectedFiles.length]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList) return;
        const files: File[] = Array.from(fileList).filter(
            (file) => file.type === "application/json" || file.name.toLowerCase().endsWith(".json")
        );
        setSelectedFiles(files);
        setUploadStatus("");
        setIsError(false);
    };

    // const handleUpload = async () => {
    //     if (selectedFiles.length === 0) {
    //         setUploadStatus("Please select one or more JSON files.");
    //         setIsError(true);
    //         return;
    //     }
    //     const formData = new FormData();
    //     selectedFiles.forEach((file) => {
    //         formData.append("datasets", file);
    //     });

    //     setUploadStatus("Uploading...");
    //     setIsError(false);
    //     try {
    //         const response = await fetch("/api/ingest", {
    //             method: "POST",
    //             body: formData,
    //         });

    //         const result: { message?: string; error?: string } = await response.json();

    //         if (response.ok) {
    //             setUploadStatus(
    //                 `Upload successful! ${result.message || "Contents logged to terminal."}`
    //             );
    //             setIsError(false);
    //             setSelectedFiles([]);
    //         } else {
    //             setUploadStatus(`Upload failed: ${result.error || "Unknown error"}`);
    //             setIsError(true);
    //         }
    //     } catch (error) {
    //         console.error("Network error during upload:", error);

    //         setUploadStatus(`An error occurred during upload: ${(error as Error).message}`);
    //         setIsError(true);
    //     }
    // };
    const handleUploadClick = (itemId: string) => {
        const itemToMove = items.find((item) => item.id === itemId);

        if (!itemToMove) return;
        setItems((prevStaged) => prevStaged.filter((item) => item.id !== itemId));

        addDataset({
            ...itemToMove,
            updatedAt: new Date().toISOString(),
        });
        toast.success("Uploaded", {
            description: `"${itemToMove.name}" added to datasets.`,
        });
        // Perform the actual server upload here
    };

    const handleSaveToMemory = async () => {
        if (selectedFiles.length === 0) {
            setUploadStatus("Please select one or more JSON files.");
            setIsError(true);
            return;
        }

        setUploadStatus("Saving to memory...");
        setIsError(false);

        try {
            const newItems: DatasetItem[] = [];
            for (const f of selectedFiles) {
                const text = await f.text();
                try {
                    JSON.parse(text);
                } catch {
                    throw new Error(`File "${f.name}" is not valid JSON.`);
                }

                newItems.push({
                    id: crypto.randomUUID(),
                    name: f.name.replace(/\.json$/i, ""),
                    size: f.size,
                    lastModified: f.lastModified,
                    content: text,
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }

            setItems((prev) => [...newItems, ...prev]);
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

    const startEdit = (id: string, current: string) => {
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
        setItems((prev) =>
            prev.map((it) =>
                it.id === editingId
                    ? { ...it, name: trimmed, updatedAt: new Date().toISOString() }
                    : it
            )
        );
        cancelEdit();
    };

    const handleDelete = (id: string) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
    };

    const handleFinalUpload = () => {
        if (items.length === 0) {
            setUploadStatus("No staged datasets to upload.");
            setIsError(true);
            return;
        }
        const count = items.length;
        setUploadStatus(`Uploading ${count} dataset(s) to server...`);
        setIsError(false);
        setTimeout(() => {
            items.forEach((it) => addDataset({ ...it, updatedAt: new Date().toISOString() }));
            setItems([]);
            setUploadStatus(`Successfully uploaded ${count} dataset(s) to the server.`);
            setIsError(false);
            toast.success("Upload Complete!", {
                description: `${count} dataset(s) are now live.`,
            });
        }, 400);
    };
    const handleDeleteUploaded = (id: string) => {
        removeDataset(id);
        toast.warning(`Dataset ${id} Deleted`, {
            description: "The dataset was removed from the live list.",
        });
    };

    const DatasetListRow = ({ it, isStaged }: { it: DatasetItem; isStaged: boolean }) => {
        return (
            <li
                key={it.id}
                className="flex items-center justify-between p-3 transition-colors hover:bg-gray-900"
            >
                <div className="flex items-center min-w-0">
                    {isStaged && (
                        <Button
                            variant="ghost"
                            className="mr-3 h-fit py-2 w-fit hover:bg-gray-800"
                            onClick={() => handleUploadClick(it.id)}
                            title="Simulate individual file upload to server"
                        >
                            <Upload className="text-yellow-500 size-5" />
                        </Button>
                    )}
                    <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                    {editingId === it.id && isStaged ? (
                        <div className="flex items-center gap-2">
                            <Input
                                key={it.id}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-8 w-56"
                                placeholder="Dataset name"
                            />
                            <Button
                                className="h-9 w-9 p-0"
                                variant="ghost"
                                onClick={commitEdit}
                                aria-label="Save"
                            >
                                <Save className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                aria-label="Cancel"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-medium">{it.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatSize(it.size)}
                            </span>
                            <span className="text-xs text-muted-foreground truncate hidden sm:block">
                                • {isStaged ? "Staged" : "Uploaded"}:{" "}
                                {new Date(it.updatedAt).toLocaleDateString()}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {isStaged && editingId !== it.id && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(it.id, it.name)}
                            aria-label="Rename"
                            title="Rename"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            isStaged ? handleDelete(it.id) : handleDeleteUploaded(it.id)
                        }
                        aria-label="Delete"
                        title="Delete"
                    >
                        <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                </div>
            </li>
        );
    };

    return (
        <div className="flex w-full h-full border-yellow-600 border p-5">
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
                            accept=".json"
                            multiple
                            onChange={handleFileChange}
                            className="flex-1"
                            ref={fileInputRef}
                        />
                        <Button
                            onClick={handleSaveToMemory}
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
                                onClick={handleFinalUpload}
                                disabled={items.length === 0}
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                            >
                                <Upload className="h-4 w-4" />
                                <span>Upload All ({items.length})</span>
                            </Button>
                        </div>

                        {items.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-3 border rounded-md">
                                Nothing staged yet. Add some JSON files above and click{" "}
                                <strong>Stage</strong>.
                            </div>
                        ) : (
                            <ul className="divide-y rounded-md border">
                                {items.map((it) => (
                                    <DatasetListRow key={it.id} it={it} isStaged={true} />
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
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Dataset Name</TableHead>
                                            <TableHead className="w-20">Size</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {datasets.map((it) => (
                                            <TableRow key={it.id} className="hover:bg-gray-900">
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
                                                        {formatSize(it.size)}
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
