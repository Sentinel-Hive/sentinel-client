import { useState, useEffect, useMemo } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { useDatasets, useDatasetStore } from "@/store/datasetStore";
import type { DatasetItem, Log, RawLog } from "@/types/types";
import DatasetViewer from "@/components/DatasetViewer";
import { formatSize } from "@/lib/utils";
import { fetchDatasetContent } from "@/lib/dataHandler";

const filterFields = [
    { key: "src_ip", label: "Source IP" },
    { key: "dest_ip", label: "Destination IP" },
    { key: "user", label: "User" },
    { key: "event_type", label: "Event Type" },
    { key: "severity", label: "Severity" },
    { key: "app", label: "Application" },
    { key: "dest_port", label: "Destination Port" },
    { key: "src_port", label: "Source Port" },
    { key: "status", label: "Status" },
    { key: "host", label: "Host" },
];

type LogRow = Log & {
    datasetId: number;
    datasetName: string;
    raw: RawLog | null;
};

type DatasetMatch = {
    dataset: DatasetItem;
    matchedCount: number;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const ITEMS_PER_LOAD = 20;

const isJsonObject = (value: unknown): value is RawLog =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const getFieldAsString = (obj: RawLog, field: string): string => {
    const value = obj[field];
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return "";
};

const coerceLogFromRaw = (raw: RawLog, fallbackId: number): Log => {
    const messageCandidates = ["message", "msg", "log", "description", "event", "detail", "text"];

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
        raw.user ?? (typeof raw.userPrincipalName === "string" ? raw.userPrincipalName : undefined);

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
        id: raw.id ?? fallbackId,
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

const getTimestampMillis = (ts: string | undefined): number | null => {
    if (!ts) return null;
    const millis = Date.parse(ts);
    if (Number.isNaN(millis)) return null;
    return millis;
};

const parseSQLQuery = (sql: string): Record<string, string> => {
    const result: Record<string, string> = {};
    const regex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sql)) !== null) {
        const key = match[1];
        const value = match[2];
        result[key] = value;
    }
    return result;
};

export default function Analytics() {
    const { updateDataset } = useDatasetStore();
    const datasets = useDatasets();

    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({
        src_ip: "",
        dest_ip: "",
        user: "",
        event_type: "",
        severity: "",
        app: "",
        dest_port: "",
        src_port: "",
        status: "",
        host: "",
    });
    const [dateFrom, setDateFrom] = useState<string | null>(null);
    const [dateTo, setDateTo] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState("Newest");
    const [datasetsToShow, setDatasetsToShow] = useState(20);
    const [selectedDatasetIds, setSelectedDatasetIds] = useState<number[]>([]);
    const [loadedFilterOptions, setLoadedFilterOptions] = useState<Record<string, number>>(
        Object.fromEntries(filterFields.map((f) => [f.key, ITEMS_PER_LOAD]))
    );
    const [viewerDataset, setViewerDataset] = useState<DatasetItem | null>(null);

    // Build logs per dataset
    const logsByDatasetId: Record<number, LogRow[]> = useMemo(() => {
        const map: Record<number, LogRow[]> = {};
        datasets.forEach((ds) => {
            map[ds.id] = parseDatasetToLogRows(ds);
        });
        return map;
    }, [datasets]);

    const allLogs: LogRow[] = useMemo(() => {
        const result: LogRow[] = [];
        Object.values(logsByDatasetId).forEach((arr) => result.push(...arr));
        return result;
    }, [logsByDatasetId]);

    const uniqueValues = (field: string): string[] =>
        Array.from(
            new Set(
                allLogs
                    .map((log) => (log.raw ? getFieldAsString(log.raw, field) : ""))
                    .filter((val) => val !== "")
            )
        );

    const hasActiveFilters = useMemo(() => {
        const hasSql = query.trim() !== "";
        const hasTypes = filters.length > 0;
        const hasDate = dateFrom !== null || dateTo !== null;
        const hasFieldFilters = Object.values(fieldFilters).some((v) => v.trim() !== "");
        return hasSql || hasTypes || hasDate || hasFieldFilters;
    }, [query, filters, dateFrom, dateTo, fieldFilters]);

    const clearAll = () => {
        setQuery("");
        setFilters([]);
        setFieldFilters({
            src_ip: "",
            dest_ip: "",
            user: "",
            event_type: "",
            severity: "",
            app: "",
            dest_port: "",
            src_port: "",
            status: "",
            host: "",
        });
        setDateFrom(null);
        setDateTo(null);
        setShowFilters(false);
        setDatasetsToShow(20);
    };

    const toggleFilter = (type: string) => {
        setFilters((prev) =>
            prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type]
        );
    };

    const setFieldFilter = (field: string, value: string) => {
        setFieldFilters((prev) => ({ ...prev, [field]: value }));
    };

    const loadMoreFilterOptions = (field: string) => {
        setLoadedFilterOptions((prev) => ({
            ...prev,
            [field]: prev[field] + ITEMS_PER_LOAD,
        }));
    };

    // Filter logs, then compute matching datasets
    const { matchingDatasets, totalMatchingLogs } = useMemo(() => {
        const sqlFilters = parseSQLQuery(query);

        const filteredLogs = allLogs.filter((log) => {
            const raw = log.raw;

            // SQL-like field filters
            if (Object.keys(sqlFilters).length > 0) {
                if (!raw) return false;
                for (const [field, value] of Object.entries(sqlFilters)) {
                    const v = getFieldAsString(raw, field).toLowerCase();
                    if (!v.includes(value.toLowerCase())) return false;
                }
            }

            // type filters
            if (filters.length > 0) {
                const logType = log.type.toLowerCase();
                if (!filters.includes(logType)) return false;
            }

            // date range filters
            if (dateFrom || dateTo) {
                const tsMillis = getTimestampMillis(log.timestamp);
                if (tsMillis !== null) {
                    if (dateFrom) {
                        const fromMillis = getTimestampMillis(dateFrom);
                        if (fromMillis !== null && tsMillis < fromMillis) return false;
                    }
                    if (dateTo) {
                        const toDate = new Date(dateTo);
                        toDate.setHours(23, 59, 59, 999);
                        const toMillis = toDate.getTime();
                        if (tsMillis > toMillis) return false;
                    }
                }
            }

            // fieldFilters
            if (Object.values(fieldFilters).some((v) => v.trim() !== "")) {
                if (!raw) return false;
                for (const [field, value] of Object.entries(fieldFilters)) {
                    if (value.trim() !== "") {
                        const v = getFieldAsString(raw, field).toLowerCase();
                        if (!v.includes(value.toLowerCase())) return false;
                    }
                }
            }

            return true;
        });

        // Map dataset -> matched count
        const countsByDatasetId = new Map<number, number>();
        filteredLogs.forEach((log) => {
            const current = countsByDatasetId.get(log.datasetId) ?? 0;
            countsByDatasetId.set(log.datasetId, current + 1);
        });

        let matches: DatasetMatch[];

        if (!hasActiveFilters) {
            // Default: ALL dataset items
            matches = datasets.map((ds) => ({
                dataset: ds,
                matchedCount: (logsByDatasetId[ds.id] ?? []).length,
            }));
        } else {
            matches = datasets
                .map((ds) => {
                    const cnt = countsByDatasetId.get(ds.id) ?? 0;
                    return { dataset: ds, matchedCount: cnt };
                })
                .filter((m) => m.matchedCount > 0);
        }

        const sorted = matches.slice().sort((a, b) => {
            if (sortOption === "A-Z") {
                return a.dataset.name.localeCompare(b.dataset.name);
            }
            if (sortOption === "Z-A") {
                return b.dataset.name.localeCompare(a.dataset.name);
            }

            const ta = Date.parse(a.dataset.addedAt);
            const tb = Date.parse(b.dataset.addedAt);

            if (sortOption === "Oldest") {
                if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
                return a.dataset.id - b.dataset.id;
            }

            // Default: "Newest"
            if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
            return b.dataset.id - a.dataset.id;
        });

        return {
            matchingDatasets: sorted,
            totalMatchingLogs: filteredLogs.length,
        };
    }, [
        allLogs,
        datasets,
        logsByDatasetId,
        query,
        filters,
        fieldFilters,
        dateFrom,
        dateTo,
        sortOption,
        hasActiveFilters,
    ]);

    const displayedDatasets = useMemo(
        () => matchingDatasets.slice(0, datasetsToShow),
        [matchingDatasets, datasetsToShow]
    );

    const loadMoreDatasets = () => {
        setDatasetsToShow((prev) => prev + 20);
    };

    const selectedDatasets = useMemo(
        () => datasets.filter((d) => selectedDatasetIds.includes(d.id)),
        [datasets, selectedDatasetIds]
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setViewerDataset(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const toggleDatasetSelection = (datasetId: number) => {
        setSelectedDatasetIds((prev) =>
            prev.includes(datasetId) ? prev.filter((id) => id !== datasetId) : [...prev, datasetId]
        );
    };

    return (
        <div className="flex flex-row justify-between">
            <div className="flex-1 max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl ml-0 mr-4 my-4 p-4 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg h-fit">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter SQL-like query (e.g., src_ip='192.168.1.1' AND user='admin')"
                    className="w-full mb-2"
                />

                <div className="mb-2">
                    <div className="flex items-center justify-between">
                        <label className="block font-semibold">Filters</label>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowFilters((s) => !s)}
                        >
                            Filter
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="mt-2 space-y-3 p-3 bg-[hsl(var(--bg))] border border-yellow-400 rounded">
                            {filterFields.map((f) => {
                                const values = uniqueValues(f.key);
                                return (
                                    <div key={f.key}>
                                        <div className="text-sm font-medium mb-1">{f.label}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {values
                                                .slice(0, loadedFilterOptions[f.key])
                                                .map((val) => {
                                                    const selected = fieldFilters[f.key] === val;
                                                    return (
                                                        <Button
                                                            key={`${f.key}-${val}`}
                                                            size="sm"
                                                            variant={selected ? "default" : "ghost"}
                                                            onClick={() =>
                                                                setFieldFilter(
                                                                    f.key,
                                                                    selected ? "" : val
                                                                )
                                                            }
                                                        >
                                                            {val}
                                                        </Button>
                                                    );
                                                })}
                                        </div>
                                        {values.length > loadedFilterOptions[f.key] && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-2"
                                                onClick={() => loadMoreFilterOptions(f.key)}
                                            >
                                                Load More
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}

                            <div>
                                <div className="text-sm font-medium mb-1">Date Range (Between)</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={dateFrom ?? ""}
                                        onChange={(e) => setDateFrom(e.target.value || null)}
                                        className="p-2 rounded bg-[hsl(var(--muted))] text-sm"
                                    />
                                    <span>and</span>
                                    <input
                                        type="date"
                                        value={dateTo ?? ""}
                                        onChange={(e) => setDateTo(e.target.value || null)}
                                        className="p-2 rounded bg-[hsl(var(--muted))] text-sm"
                                    />
                                </div>
                            </div>
                            <div className="pt-2">
                                <div className="text-sm font-medium mb-1">Type</div>
                                <div className="flex gap-3">
                                    {["info", "error", "warning"].map((type) => (
                                        <label
                                            key={type}
                                            className="inline-flex items-center gap-2 text-sm"
                                        >
                                            <Checkbox
                                                checked={filters.includes(type)}
                                                onCheckedChange={() => toggleFilter(type)}
                                            />
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setFieldFilters({
                                            src_ip: "",
                                            dest_ip: "",
                                            user: "",
                                            event_type: "",
                                            severity: "",
                                            app: "",
                                            dest_port: "",
                                            src_port: "",
                                            status: "",
                                            host: "",
                                        });
                                        setDateFrom(null);
                                        setDateTo(null);
                                    }}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <Select value={"Sort By:"} onValueChange={(v) => setSortOption(v)}>
                    <SelectTrigger className="w-full mb-2">
                        <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Newest">Newest</SelectItem>
                        <SelectItem value="Oldest">Oldest</SelectItem>
                        <SelectItem value="A-Z">A-Z</SelectItem>
                        <SelectItem value="Z-A">Z-A</SelectItem>
                    </SelectContent>
                </Select>

                <Button className="w-full mt-2 mb-2" onClick={clearAll}>
                    View All
                </Button>

                <div className="text-xs text-muted-foreground mb-1">
                    Matching logs: {totalMatchingLogs}
                </div>

                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                    {displayedDatasets.length === 0 ? (
                        <div className="text-sm text-gray-500 italic text-center py-4">
                            No datasets match the current filters.
                        </div>
                    ) : (
                        displayedDatasets.map(({ dataset, matchedCount }) => {
                            const isSelected = selectedDatasetIds.includes(dataset.id);
                            return (
                                <Button
                                    key={dataset.id}
                                    className={`w-full justify-between border ${isSelected ? "border-yellow-400" : "border-white"}`}
                                    onClick={() => toggleDatasetSelection(dataset.id)}
                                >
                                    <span className="truncate">{dataset.name}</span>
                                    <span className="ml-2 text-xs opacity-80">
                                        {matchedCount} log
                                        {matchedCount === 1 ? "" : "s"}
                                    </span>
                                </Button>
                            );
                        })
                    )}
                </div>

                {datasetsToShow < matchingDatasets.length && (
                    <Button className="w-full mt-2" onClick={loadMoreDatasets}>
                        Load More
                    </Button>
                )}
            </div>

            <div className="flex-1 my-4 mr-4">
                {selectedDatasets.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-sm text-muted-foreground p-6 border rounded-md">
                            Toggle one or more datasets on the left to see them here.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-3">
                        {selectedDatasets.map((ds) => {
                            const logsCount = (logsByDatasetId[ds.id] ?? []).length;
                            return (
                                <div
                                    key={ds.id}
                                    className="p-4 border border-yellow-400 rounded-lg bg-[hsl(var(--bg))] flex flex-col justify-between"
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
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => toggleDatasetSelection(ds.id)}
                                        >
                                            Deselect
                                        </Button>
                                        {ds.content ? (
                                            <Button size="sm" onClick={() => setViewerDataset(ds)}>
                                                Inspect
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetchDatasetContent(
                                                            ds.id,
                                                            ds.path
                                                        );

                                                        if (res != null) {
                                                            updateDataset(ds.id, {
                                                                content: res,
                                                            });
                                                        }
                                                    } catch (err) {
                                                        console.error(
                                                            "Failed to load dataset content",
                                                            err
                                                        );
                                                    }
                                                }}
                                            >
                                                Load
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
        </div>
    );
}
