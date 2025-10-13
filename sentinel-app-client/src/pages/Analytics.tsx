// src/pages/Analytics.tsx
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import LogUploader from "../components/LogUploader";
import { Log } from "../types/types";

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

export default function Analytics() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [displayedLogs, setDisplayedLogs] = useState<Log[]>([]);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
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
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [logsToShow, setLogsToShow] = useState(500);
    const ITEMS_PER_LOAD = 20;
    const [loadedFilterOptions, setLoadedFilterOptions] = useState<Record<string, number>>(
        Object.fromEntries(filterFields.map((f) => [f.key, ITEMS_PER_LOAD]))
    );

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
        setLogsToShow(500);
    };

    const handleLogsProcessed = (processedLogs: Log[]) => {
        setLogs(processedLogs);
        setDisplayedLogs(processedLogs.slice(0, logsToShow));
    };

    const handleUploadStart = () => {
        setUploading(true);
        setUploadProgress(0);
        setLogs([]);
        setDisplayedLogs([]);
    };

    const handleUploadProgress = (progress: number) => {
        setUploadProgress(progress);
    };

    const handleUploadComplete = () => {
        setUploading(false);
    };

    const loadMoreLogs = () => {
        setLogsToShow((prev) => {
            const newLimit = prev + 500;
            setDisplayedLogs(logs.slice(0, newLimit));
            return newLimit;
        });
    };

    const toggleFilter = (type: string) => {
        setFilters((prev) =>
            prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type]
        );
    };

    const setFieldFilter = (field: string, value: string) => {
        setFieldFilters((prev: Record<string, string>) => ({ ...prev, [field]: value }));
    };

    const loadMoreFilterOptions = (field: string) => {
        setLoadedFilterOptions((prev) => ({
            ...prev,
            [field]: prev[field] + ITEMS_PER_LOAD,
        }));
    };

    const uniqueValues = (field: string) =>
        Array.from(
            new Set(
                logs.map((l) => String((l as Record<string, unknown>)[field] ?? "")).filter(Boolean)
            )
        );

    const parseSQLQuery = (query: string): Record<string, string> => {
        const filters: Record<string, string> = {};
        const regex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = regex.exec(query)) !== null) {
            const [_, key, value] = match;
            filters[key] = value;
        }
        return filters;
    };

    const filteredLogs = useMemo(() => {
        const sqlFilters = parseSQLQuery(query);
        const list = logs
            .filter((log) => {
                for (const [field, value] of Object.entries(sqlFilters)) {
                    const logValue = String(
                        (log as Record<string, unknown>)[field] ?? ""
                    ).toLowerCase();
                    if (!logValue.includes(value.toLowerCase())) return false;
                }
                return true;
            })
            .filter((log) => (filters.length > 0 ? filters.includes(log.type) : true))
            .filter((log) => {
                if (dateFrom || dateTo) {
                    const ts = log.timestamp ? new Date(log.timestamp).getTime() : null;
                    if (ts) {
                        if (dateFrom) {
                            const from = new Date(dateFrom).getTime();
                            if (ts < from) return false;
                        }
                        if (dateTo) {
                            const toDate = new Date(dateTo);
                            toDate.setHours(23, 59, 59, 999);
                            const to = toDate.getTime();
                            if (ts > to) return false;
                        }
                    }
                }

                for (const [field, value] of Object.entries(fieldFilters)) {
                    if (value && value.trim() !== "") {
                        const logVal = String(
                            (log as Record<string, unknown>)[field] ?? ""
                        ).toLowerCase();
                        if (!logVal.includes(value.toLowerCase())) return false;
                    }
                }
                return true;
            });

        const sorted = list.sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : null;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : null;
            if (sortOption === "A-Z") return a.message.localeCompare(b.message);
            if (sortOption === "Z-A") return b.message.localeCompare(a.message);
            if (sortOption === "Oldest") {
                if (ta != null && tb != null) return ta - tb;
                return a.id - b.id;
            }
            // Newest
            if (ta != null && tb != null) return tb - ta;
            return b.id - a.id;
        });

        setDisplayedLogs(sorted.slice(0, logsToShow));
        return sorted;
    }, [logs, query, filters, fieldFilters, dateFrom, dateTo, sortOption, logsToShow]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedLog(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="flex">
            <div className="flex-1 max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl ml-0 mr-4 my-4 p-4 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg">
                <Input
                    value={query}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
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
                        <div className="mt-2 space-y-3 p-3 bg-[hsl(var(--bg))] border border-[hsl(var(--border))] rounded">
                            {filterFields.map((f) => (
                                <div key={f.key}>
                                    <div className="text-sm font-medium mb-1">{f.label}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueValues(f.key)
                                            .slice(0, loadedFilterOptions[f.key])
                                            .map((val) => {
                                                const selected = fieldFilters[f.key] === val;
                                                return (
                                                    <Button
                                                        key={val}
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
                                    {uniqueValues(f.key).length > loadedFilterOptions[f.key] && (
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
                            ))}

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

                <Select value={sortOption} onValueChange={(v) => setSortOption(v)}>
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

                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                    {displayedLogs.length === 0 ? (
                        <div className="text-sm text-gray-500 italic text-center py-4">
                            No more logs.
                        </div>
                    ) : (
                        displayedLogs.map((log) => {
                            const isSelected = selectedLog?.id === log.id;
                            return (
                                <div
                                    key={log.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedLog((prev) =>
                                            prev?.id === log.id ? null : log
                                        );
                                    }}
                                    className={`p-2 border border-[hsl(var(--border))] rounded cursor-pointer truncate ${
                                        isSelected
                                            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                            : "bg-[hsl(var(--bg))] hover:bg-[hsl(var(--muted))]"
                                    }`}
                                    title={log.message}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.stopPropagation();
                                            setSelectedLog((prev) =>
                                                prev?.id === log.id ? null : log
                                            );
                                        }
                                    }}
                                    aria-pressed={isSelected}
                                >
                                    {log.message}
                                </div>
                            );
                        })
                    )}
                </div>

                {logsToShow < filteredLogs.length && (
                    <Button className="w-full mt-2" onClick={loadMoreLogs}>
                        Load More
                    </Button>
                )}
            </div>

            <div className="flex-1 flex items-center justify-center">
                {logs.length === 0 && (
                    <LogUploader
                        onLogsProcessed={handleLogsProcessed}
                        uploading={uploading}
                        uploadProgress={uploadProgress}
                        onUploadStart={handleUploadStart}
                        onUploadProgress={handleUploadProgress}
                        onUploadComplete={handleUploadComplete}
                    />
                )}
            </div>

            <Dialog
                open={!!selectedLog}
                onOpenChange={(open) => {
                    if (!open) setSelectedLog(null);
                }}
            >
                <DialogContent className="w-96 max-h-[70vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle id="log-details-title">Log Details</DialogTitle>
                    </DialogHeader>
                    <div className="mt-2">
                        <p className="mb-4">{selectedLog?.message}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
