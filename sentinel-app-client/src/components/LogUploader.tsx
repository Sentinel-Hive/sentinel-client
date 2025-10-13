import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { UploadCloud } from "lucide-react";
import { Log, RawLog } from "../types/types";

function parseNDJSON(
    rawText: string,
    onBatch: (logs: Record<string, unknown>[]) => void,
    onProgress: (percent: number) => void,
    batchSize = 1000
) {
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const total = lines.length;
    let index = 0;

    function processBatch() {
        const batch: Record<string, unknown>[] = [];
        for (let i = 0; i < batchSize && index < total; i++, index++) {
            try {
                const obj = JSON.parse(lines[index]);
                batch.push(obj);
            } catch {
                // skip bad lines
            }
        }

        if (batch.length) {
            onBatch(batch);
        }

        onProgress(Math.min(100, Math.round((index / total) * 100)));

        if (index < total) {
            setTimeout(processBatch, 0);
        }
    }

    processBatch();
}

interface LogUploaderProps {
    onLogsProcessed: (logs: Log[]) => void;
    uploading: boolean;
    uploadProgress: number;
    onUploadStart: () => void;
    onUploadProgress: (progress: number) => void;
    onUploadComplete: () => void;
}

export default function LogUploader({
    onLogsProcessed,
    uploading,
    uploadProgress,
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
}: LogUploaderProps) {
    const handleFileUpload = (file: File) => {
        onUploadStart();

        const reader = new FileReader();

        reader.onload = (event) => {
            const rawText = event.target?.result as string;
            if (!rawText) return;

            onUploadProgress(0);
            const allLogs: Log[] = [];

            parseNDJSON(
                rawText,
                (batch) => {
                    const normalized: Log[] = batch.map((entry, idx) => {
                        const r = (entry as { result?: RawLog }).result || ({} as RawLog);
                        let innerRaw: RawLog = {};
                        try {
                            if (r._raw) {
                                innerRaw = JSON.parse(r._raw);
                            }
                        } catch {
                            innerRaw = {};
                        }

                        return {
                            id: innerRaw.id ?? r.id ?? idx,
                            message:
                                innerRaw.appDisplayName ??
                                r.appDisplayName ??
                                innerRaw.resourceDisplayName ??
                                r.resourceDisplayName ??
                                "(no message)",
                            type: r.conditionalAccessStatus ?? "info",
                            timestamp: innerRaw.createdDateTime ?? r.createdDateTime ?? r._time,
                            src_ip: innerRaw.ipAddress ?? r.ipAddress ?? r.src_ip,
                            dest_ip: r.dest ?? "",
                            user: innerRaw.userPrincipalName ?? r.user ?? r.userPrincipalName,
                            event_type: Array.isArray(r.eventtype)
                                ? r.eventtype.join(", ")
                                : r.eventtype,
                            severity: r.riskLevelDuringSignIn ?? "",
                            app: innerRaw.appDisplayName ?? r.appDisplayName,
                            dest_port: "",
                            src_port: "",
                            status:
                                (typeof r["status.failureReason"] === "string"
                                    ? r["status.failureReason"]
                                    : innerRaw.status?.failureReason) ?? "",
                            host: r.host ?? "",
                        };
                    });

                    allLogs.push(...normalized);
                },
                (percent) => {
                    onUploadProgress(percent);
                    if (percent === 100) {
                        onLogsProcessed(allLogs);
                        setTimeout(() => onUploadComplete(), 500);
                    }
                }
            );
        };

        reader.readAsText(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    return (
        <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader>
                <CardTitle className="text-lg">Upload Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                    }}
                    className="relative flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed
                    border-neutral-700 bg-neutral-900/60 text-neutral-300 transition
                    hover:border-[hsl(var(--primary))]/70 hover:bg-neutral-800/40 px-10"
                >
                    <UploadCloud className="mb-2 h-10 w-12 text-[hsl(var(--primary))]" />
                    <p className="text-sm">
                        Drag & drop files here, or{" "}
                        <button
                            type="button"
                            onClick={() => document.getElementById("file-input")?.click()}
                            className="font-semibold text-[hsl(var(--primary))] underline underline-offset-4"
                        >
                            browse
                        </button>
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">Only .json files are supported.</p>
                    <input
                        id="file-input"
                        type="file"
                        accept=".json"
                        onChange={handleInputChange}
                        className="sr-only"
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                </div>
                {uploading && (
                    <div className="mt-4">
                        <Progress value={uploadProgress} className="w-full" />
                        <p className="text-sm text-gray-500 mt-2">Uploading... {uploadProgress}%</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
