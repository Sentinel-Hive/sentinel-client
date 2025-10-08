// src/pages/Datasets.tsx
import { useCallback, useMemo, useRef, useState } from "react";
import { UploadCloud, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";

type LocalItem = {
    id: string;
    file: File;
};

export default function Datasets() {
    const [items, setItems] = useState<LocalItem[]>([]);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const onFiles = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        const next: LocalItem[] = [];
        Array.from(files).forEach((f) => {
            const id = `${f.name}-${f.size}-${f.lastModified}-${crypto.randomUUID()}`;
            next.push({ id, file: f });
        });

        setItems((prev) => [...next, ...prev]);
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} added`);
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            onFiles(e.dataTransfer.files ?? null);
        },
        [onFiles]
    );

    const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.file.size, 0), [items]);

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((x) => x.id !== id));
    };

    const clearAll = () => setItems([]);

    const handleUpload = async () => {
        if (items.length === 0) {
            toast.info("No files selected");
            return;
        }
        toast.success(`Pretending to upload ${items.length} file${items.length > 1 ? "s" : ""}`);
    };

    return (
        <div className="mx-auto max-w-5xl p-6">
            <h2 className="mb-4 text-2xl font-semibold">Datasets</h2>

            <Card className="border-neutral-800 bg-neutral-900">
                <CardHeader>
                    <CardTitle className="text-lg">Upload local files</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Dropzone */}
                    <div
                        onDrop={onDrop}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                        }}
                        className="relative flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed
                       border-neutral-700 bg-neutral-900/60 text-neutral-300 transition
                       hover:border-[hsl(var(--primary))]/70 hover:bg-neutral-800/40"
                    >
                        <UploadCloud className="mb-2 h-7 w-7 text-[hsl(var(--primary))]" />
                        <p className="text-sm">
                            Drag & drop files here, or{" "}
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="font-semibold text-[hsl(var(--primary))] underline underline-offset-4"
                            >
                                browse
                            </button>
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                            Any file type. Multiple files supported.
                        </p>

                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            onChange={(e) => onFiles(e.target.files)}
                            className="sr-only"
                            aria-hidden="true"
                            tabIndex={-1}
                        />
                    </div>

                    {/* Selected files list */}
                    {items.length > 0 && (
                        <div className="rounded-xl border border-neutral-800">
                            <div className="flex items-center justify-between border-b border-neutral-800 p-3">
                                <div className="text-sm text-neutral-300">
                                    {items.length} file{items.length > 1 ? "s" : ""} •{" "}
                                    {formatBytes(totalSize)}
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={clearAll}
                                    className="h-8 rounded-lg px-2 text-xs text-neutral-300 hover:bg-neutral-800/60"
                                >
                                    Clear all
                                </Button>
                            </div>

                            <ul className="divide-y divide-neutral-800">
                                {items.map(({ id, file }) => (
                                    <li
                                        key={id}
                                        className="flex items-center justify-between gap-3 p-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <FileText className="h-4 w-4 shrink-0 text-yellow-400" />
                                            <div className="min-w-0">
                                                <div className="truncate text-sm text-neutral-100">
                                                    {file.name}
                                                </div>
                                                <div className="text-xs text-neutral-400">
                                                    {file.type || "unknown"} •{" "}
                                                    {formatBytes(file.size)}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            className="h-8 w-8 rounded-lg p-0 text-neutral-300 hover:bg-neutral-800/60"
                                            onClick={() => removeItem(id)}
                                            aria-label={`Remove ${file.name}`}
                                            title="Remove"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => inputRef.current?.click()}
                        className="rounded-xl bg-neutral-800/50 text-neutral-100 hover:bg-neutral-800"
                    >
                        Add more
                    </Button>
                    <Button
                        onClick={handleUpload}
                        className="rounded-xl bg-[hsl(var(--primary))] text-black hover:bg-yellow-600"
                    >
                        Upload
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    const i = Math.floor(Math.log(n) / Math.log(1024));
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    return `${(n / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}
