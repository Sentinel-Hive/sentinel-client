import { useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import DatasetViewer from "@/components/DatasetViewer";
import { DatasetItem, JsonValue, Log, RawLog } from "@/types/types";
import { useDatasets, useDatasetStore } from "@/store/datasetStore";
import { formatSize } from "@/lib/utils";
import { fetchDatasetContent } from "@/lib/dataHandler";
import { toast } from "sonner";
import { Download } from "lucide-react";

type LogRow = Log & {
    datasetId: number;
    datasetName: string;
    raw: RawLog | null;
};

export default function Datasets() {
    const datasets = useDatasets();
    const { updateDataset } = useDatasetStore();
    const [viewerDataset, setViewerDataset] = useState<DatasetItem | null>(null);

    const isJsonObject = (value: unknown): value is RawLog =>
        typeof value === "object" && value !== null && !Array.isArray(value);

    const coerceLogFromRaw = (raw: RawLog, fallbackId: number): Log => {
        const messageCandidates = [
            "message",
            "msg",
            "log",
            "description",
            "event",
            "detail",
            "text",
        ];

        let message: string | undefined;
        for (const key of messageCandidates) {
            const value = raw[key];
            if (typeof value === "string" && value.trim() !== "") {
                message = value;
                break;
            }
        }

        if (!message) {
            const serialized = JSON.stringify(raw);
            const maxLen = 200;
            message =
                serialized.length > maxLen
                    ? `${serialized.slice(0, maxLen - 3)}...`
                    : serialized || "[empty record]";
        }

        const rawEventType = raw.eventtype;
        let eventTypeString: string | undefined;
        if (typeof rawEventType === "string") {
            eventTypeString = rawEventType;
        } else if (Array.isArray(rawEventType) && rawEventType.length > 0) {
            const first = rawEventType[0];
            if (typeof first === "string") {
                eventTypeString = first;
            }
        }

        const severity = typeof raw.severity === "string" ? raw.severity : undefined;

        const type = eventTypeString ?? severity ?? "info";

        const timestamp =
            raw.createdDateTime ??
            raw._time ??
            (typeof raw.timestamp === "string" ? raw.timestamp : undefined);

        const srcIp = raw.src_ip ?? (typeof raw.ipAddress === "string" ? raw.ipAddress : undefined);

        const destIp = typeof raw.dest === "string" ? raw.dest : undefined;

        const user =
            raw.user ??
            (typeof raw.userPrincipalName === "string" ? raw.userPrincipalName : undefined);

        const app = typeof raw.appDisplayName === "string" ? raw.appDisplayName : undefined;

        let statusValue: string | undefined;
        if (typeof raw.status === "object" && raw.status !== null) {
            const failure = (raw.status as { failureReason?: string }).failureReason;
            if (typeof failure === "string") {
                statusValue = failure;
            }
        }

        const host = typeof raw.host === "string" ? raw.host : undefined;

        const destPort = typeof raw.dest_port === "string" ? raw.dest_port : undefined;
        const srcPort = typeof raw.src_port === "string" ? raw.src_port : undefined;

        return {
            id: raw.id.toString() ?? fallbackId,
            message,
            type,
            src_ip: srcIp,
            dest_ip: destIp,
            user,
            event_type: eventTypeString,
            severity,
            app,
            dest_port: destPort,
            src_port: srcPort,
            status: statusValue,
            host,
            timestamp,
        };
    };

    const parseDatasetToLogRows = (dataset: DatasetItem): LogRow[] => {
        if (!dataset.content) return [];

        const text = dataset.content.trim();
        if (!text) return [];

        const rows: LogRow[] = [];
        let fallbackId = 1;

        // Try full JSON document
        try {
            const parsed = JSON.parse(text) as JsonValue;
            if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                    if (isJsonObject(item)) {
                        const log = coerceLogFromRaw(item, fallbackId++);
                        rows.push({
                            ...log,
                            datasetId: dataset.id,
                            datasetName: dataset.name,
                            raw: item,
                        });
                    }
                });
                if (rows.length > 0) return rows;
            } else if (isJsonObject(parsed)) {
                const log = coerceLogFromRaw(parsed, fallbackId++);
                rows.push({
                    ...log,
                    datasetId: dataset.id,
                    datasetName: dataset.name,
                    raw: parsed,
                });
                return rows;
            }
        } catch (error) {
            console.warn("Dataset is not a single JSON document, trying line-by-line", {
                datasetId: dataset.id,
                error,
            });
        }

        const lines = text.split(/\r?\n/);
        for (const rawLine of lines) {
            const ln = rawLine.trim();
            if (!ln) continue;
            try {
                const parsedLine = JSON.parse(ln) as JsonValue;
                if (isJsonObject(parsedLine)) {
                    const log = coerceLogFromRaw(parsedLine, fallbackId++);
                    rows.push({
                        ...log,
                        datasetId: dataset.id,
                        datasetName: dataset.name,
                        raw: parsedLine,
                    });
                }
            } catch (error) {
                console.warn("Failed to parse JSON line in dataset", {
                    datasetId: dataset.id,
                    line: ln,
                    error,
                });
            }
        }

        return rows;
    };

    const logsByDatasetId: Record<number, LogRow[]> = useMemo(() => {
        const map: Record<number, LogRow[]> = {};
        datasets.forEach((ds) => {
            map[ds.id] = parseDatasetToLogRows(ds);
        });
        return map;
    }, [datasets]);

    const loadDataset = async (id: number, path: string) => {
        try {
            const res = await fetchDatasetContent(id, path);

            if (res != null) {
                updateDataset(id, {
                    content: res,
                });
                toast.success(`Successfully loaded content from dataset id:${id}`);
            }
        } catch (err) {
            console.error("Failed to load dataset content", err);
        }
    };

    const loadAllDatasets = async () => {
        for (const ds of datasets) {
            try {
                await loadDataset(ds.id, ds.path);
            } catch {
                toast.error(`Unable to fetch dataset: ${ds.id}-${ds.name}`);
            }
        }
    };

    return (
        <>
            <div className="flex-1 my-4 mr-4 max-h-[70vh] overflow-y-auto">
                <span className="flex justify-end w-full">
                    <Button
                        size="lg"
                        className="bg-yellow-500 text-lg m-1 text-black hover:bg-neutral-800"
                        onClick={() => loadAllDatasets()}
                    >
                        <Download />
                        Load All
                    </Button>
                </span>
                {datasets.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-sm text-muted-foreground p-6 border rounded-md">
                            Toggle one or more datasets on the left to see them here.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-3 pr-1">
                        {datasets.map((ds) => {
                            const logsCount = (logsByDatasetId[ds.id] ?? []).length;
                            return (
                                <div
                                    key={ds.id}
                                    className="p-4 border border-yellow-400 bg-neutral-800 rounded-lg bg-[hsl(var(--bg))] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="font-semibold truncate mb-1">{ds.name}</div>
                                        <div className="text-xs text-muted-foreground mb-1">
                                            Path: {ds.path}
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-1">
                                            Added: {ds.addedAt}
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2">
                                            Size:{" "}
                                            {typeof ds.size === "number"
                                                ? formatSize(ds.size)
                                                : "Unknown"}
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2">
                                            Logs parsed: {logsCount}
                                        </div>
                                        {ds.content && (
                                            <pre className="text-[10px] max-h-24 overflow-hidden whitespace-pre-wrap break-words border rounded p-1 bg-black/40">
                                                {ds.content.slice(0, 300)}
                                                {ds.content.length > 300 ? "..." : ""}
                                            </pre>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <Button size="sm" onClick={() => setViewerDataset(ds)}>
                                            Inspect
                                        </Button>
                                        {!ds.content && (
                                            <Button
                                                size="sm"
                                                onClick={() => loadDataset(ds.id, ds.path)}
                                            >
                                                Load Dataset
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {viewerDataset && (
                <DatasetViewer
                    open={!!viewerDataset}
                    dataset={viewerDataset}
                    onOpenChange={(open) => {
                        if (!open) {
                            setViewerDataset(null);
                        }
                    }}
                />
            )}
        </>
    );
}
