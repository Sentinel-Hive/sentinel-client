"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function Dataset() {
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

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            setUploadStatus("Please select one or more JSON files.");
            setIsError(true);
            return;
        }
        const formData = new FormData();
        selectedFiles.forEach((file) => {
            formData.append("datasets", file);
        });

        setUploadStatus("Uploading...");
        setIsError(false);
        /* HERE, we try to upload it to the server
        try {
            const response = await fetch("/api/ingest", {
                method: "POST",
                body: formData,
            });

            const result: { message?: string; error?: string } = await response.json();

            if (response.ok) {
                setUploadStatus(
                    `Upload successful! ${result.message || "Contents logged to terminal."}`
                );
                setIsError(false);
                setSelectedFiles([]);
            } else {
                setUploadStatus(`Upload failed: ${result.error || "Unknown error"}`);
                setIsError(true);
            }
        } catch (error) {
            console.error("Network error during upload:", error);

            setUploadStatus(`An error occurred during upload: ${(error as Error).message}`);
            setIsError(true);
        }
        */
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
            setUploadStatus(`Saved ${newItems.length} file(s) to memory. (Not uploaded)`);
            setIsError(false);
        } catch (error) {
            setUploadStatus((error as Error).message || "Failed to read files");
            setIsError(true);
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

    return (
        <div className="flex w-full h-full border-yellow-600 border p-5">
            <Card className="w-full border-none max-w-3xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Upload className="h-5 w-5 text-yellow-600" />
                        <span>Local (In-Memory) JSON Datasets</span>
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Picker + Save */}
                    <div className="flex w-full items-center space-x-4">
                        <Input
                            id="json-files"
                            type="file"
                            accept=".json"
                            multiple
                            onChange={handleFileChange}
                            className="flex-1"
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
                                    <span>Save to memory ({humanCount})</span>
                                </>
                            )}
                        </Button>
                    </div>

                    <Alert className="border-yellow-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Heads up</AlertTitle>
                        <AlertDescription>
                            Files saved here live <strong>only in memory</strong>. If you leave or
                            refresh this page, they’ll be lost unless you implement a server upload
                            or local persistence.
                        </AlertDescription>
                    </Alert>

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
                            <h3 className="text-sm font-semibold text-gray-700">Ready to Save:</h3>
                            <ul className="space-y-1">
                                {selectedFiles.map((file) => (
                                    <li
                                        key={file.name}
                                        className="flex items-center text-sm text-gray-600"
                                    >
                                        <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <span>
                                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700">
                            In-Memory Datasets {hasUnsaved ? "(unsaved changes)" : ""}
                        </h3>

                        {items.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                                Nothing saved yet. Add some JSON files above.
                            </div>
                        ) : (
                            <ul className="divide-y rounded-md border">
                                {items.map((it) => (
                                    <li
                                        key={it.id}
                                        className="flex items-center justify-between p-3"
                                    >
                                        <div className="flex items-center min-w-0">
                                            <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                            {editingId === it.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editValue}
                                                        onChange={(e) =>
                                                            setEditValue(e.target.value)
                                                        }
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
                                                        size="md"
                                                        variant="ghost"
                                                        onClick={cancelEdit}
                                                        aria-label="Cancel"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="truncate font-medium">
                                                        {it.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {(it.size / 1024).toFixed(1)} KB
                                                    </span>
                                                    {it.lastModified ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            • modified{" "}
                                                            {new Date(
                                                                it.lastModified
                                                            ).toLocaleString()}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {editingId !== it.id && (
                                                <Button
                                                    size="md"
                                                    variant="ghost"
                                                    onClick={() => startEdit(it.id, it.name)}
                                                    aria-label="Rename"
                                                    title="Rename"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                size="md"
                                                variant="ghost"
                                                onClick={() => handleDelete(it.id)}
                                                aria-label="Delete"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
