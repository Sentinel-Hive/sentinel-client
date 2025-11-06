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
import { useDatasets } from "@/store/datasetStore";
import type { DatasetItem } from "@/types/types";
import DatasetViewer from "@/components/DatasetViewer";
import { loadAllDatasets } from "@/lib/dataHandler";

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

type Row = {
    __id: number;
    __datasetId: number;
    __datasetName: string;
    __raw: Record<string, unknown> | null;
    message: string;
    timestamp?: string | number | null;
    type?: string;
};

const ITEMS_PER_LOAD = 20;

export default function Analytics() {
    const datasets = useDatasets();
    const [displayedRows, setDisplayedRows] = useState<Row[]>([]);
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
    const [selectedRow, setSelectedRow] = useState<Row | null>(null);
    const [rowsToShow, setRowsToShow] = useState(500);
    const [loadedFilterOptions, setLoadedFilterOptions] = useState<Record<string, number>>(
        Object.fromEntries(filterFields.map((f) => [f.key, ITEMS_PER_LOAD]))
    );

    useEffect(() => {
        const loadData = async () => {
            await loadAllDatasets();
        };
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const coerceMessage = (o: Record<string, unknown>): string => {
        const cands = ["message", "msg", "log", "description", "event", "detail", "text"];
        for (const k of cands) {
            const v = o[k];
            if (typeof v === "string" && v.trim()) return v;
        }
        try {
            return JSON.stringify(o);
        } catch {
            return String(o);
        }
    };

    const coerceTimestamp = (o: Record<string, unknown>): string | number | null => {
        const cands = ["timestamp", "time", "ts", "date", "datetime", "@timestamp"];
        for (const k of cands) {
            const v = o[k];
            if (typeof v === "string" || typeof v === "number") return v;
        }
        return null;
    };

    const coerceType = (o: Record<string, unknown>): string | undefined => {
        const cands = ["type", "level", "severity"];
        for (const k of cands) {
            const v = o[k];
            if (typeof v === "string") return v.toLowerCase();
        }
        return undefined;
    };

    const parseContentToObjects = (ds: DatasetItem): Record<string, unknown>[] => {
        if (!ds.content) return [];
        const text = ds.content.trim();
        if (!text) return [];
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === "object");
            if (parsed && typeof parsed === "object") return [parsed];
        } catch {}
        const rows: Record<string, unknown>[] = [];
        for (const line of text.split(/\r?\n/)) {
            const ln = line.trim();
            if (!ln) continue;
            try {
                const obj = JSON.parse(ln);
                if (obj && typeof obj === "object") rows.push(obj);
            } catch {}
        }
        return rows;
    };

    const allRows: Row[] = useMemo(() => {
        let idCounter = 1;
        const out: Row[] = [];
        datasets.forEach((ds) => {
            const objs = parseContentToObjects(ds);
            if (objs.length === 0) {
                out.push({
                    __id: ds.id || idCounter++,
                    __datasetId: ds.id,
                    __datasetName: ds.name,
                    __raw: null,
                    message: ds.name || "(empty dataset)",
                    timestamp: null,
                    type: undefined,
                });
            } else {
                objs.forEach((o, idx) => {
                    out.push({
                        __id: Number(`${ds.id}${idx}`) || idCounter++,
                        __datasetId: ds.id,
                        __datasetName: ds.name,
                        __raw: o,
                        message: coerceMessage(o),
                        timestamp: coerceTimestamp(o),
                        type: coerceType(o),
                    });
                });
            }
        });
        return out;
    }, [datasets]);

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
        setRowsToShow(500);
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
                allRows
                    .map((r) => String(((r.__raw ?? {}) as Record<string, unknown>)[field] ?? ""))
                    .filter(Boolean)
            )
        );

    const parseSQLQuery = (query: string): Record<string, string> => {
        const filters: Record<string, string> = {};
        const regex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = regex.exec(query)) !== null) {
            const [, key, value] = match;
            filters[key] = value;
        }
        return filters;
    };

    const filteredRows = useMemo(() => {
        const sqlFilters = parseSQLQuery(query);
        const list = allRows
            .filter((row) => {
                for (const [field, value] of Object.entries(sqlFilters)) {
                    const v = String(
                        ((row.__raw ?? {}) as Record<string, unknown>)[field] ?? ""
                    ).toLowerCase();
                    if (!v.includes(value.toLowerCase())) return false;
                }
                return true;
            })
            .filter((row) =>
                filters.length > 0 ? (row.type ? filters.includes(row.type) : false) : true
            )
            .filter((row) => {
                if (dateFrom || dateTo) {
                    const tsRaw = row.timestamp;
                    const ts =
                        typeof tsRaw === "string" || typeof tsRaw === "number"
                            ? new Date(tsRaw).getTime()
                            : null;
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
                        const v = String(
                            ((row.__raw ?? {}) as Record<string, unknown>)[field] ?? ""
                        ).toLowerCase();
                        if (!v.includes(value.toLowerCase())) return false;
                    }
                }
                return true;
            });

        const sorted = list.sort((a, b) => {
            const ta = a.timestamp != null ? new Date(a.timestamp as any).getTime() : null;
            const tb = b.timestamp != null ? new Date(b.timestamp as any).getTime() : null;
            if (sortOption === "A-Z") return a.message.localeCompare(b.message);
            if (sortOption === "Z-A") return b.message.localeCompare(a.message);
            if (sortOption === "Oldest") {
                if (ta != null && tb != null) return ta - tb;
                return a.__id - b.__id;
            }
            if (ta != null && tb != null) return tb - ta;
            return b.__id - a.__id;
        });

        setDisplayedRows(sorted.slice(0, rowsToShow));
        return sorted;
    }, [allRows, query, filters, fieldFilters, dateFrom, dateTo, sortOption, rowsToShow]);

    const loadMoreRows = () => {
        setRowsToShow((prev) => {
            const newLimit = prev + 500;
            setDisplayedRows(filteredRows.slice(0, newLimit));
            return newLimit;
        });
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedRow(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const selectedDataset = useMemo(() => {
        if (!selectedRow) return null;
        return datasets.find((d) => d.id === selectedRow.__datasetId) ?? null;
    }, [selectedRow, datasets]);

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
                    {displayedRows.length === 0 ? (
                        <div className="text-sm text-gray-500 italic text-center py-4">
                            No more records.
                        </div>
                    ) : (
                        displayedRows.map((row) => {
                            const isSelected = selectedRow?.__id === row.__id;
                            return (
                                <div
                                    key={row.__id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRow((prev) =>
                                            prev?.__id === row.__id ? null : row
                                        );
                                    }}
                                    className={`p-2 border border-[hsl(var(--border))] rounded cursor-pointer truncate ${
                                        isSelected
                                            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                            : "bg-[hsl(var(--bg))] hover:bg-[hsl(var(--muted))]"
                                    }`}
                                    title={row.message}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.stopPropagation();
                                            setSelectedRow((prev) =>
                                                prev?.__id === row.__id ? null : row
                                            );
                                        }
                                    }}
                                    aria-pressed={isSelected}
                                >
                                    {row.message}
                                </div>
                            );
                        })
                    )}
                </div>

                {rowsToShow < filteredRows.length && (
                    <Button className="w-full mt-2" onClick={loadMoreRows}>
                        Load More
                    </Button>
                )}
            </div>

            <div className="flex-1 flex items-center justify-center">
                {allRows.length === 0 && (
                    <div className="text-sm text-muted-foreground p-6 border rounded-md">
                        No parsed records found in uploaded datasets. Add datasets on the Dataset
                        page.
                    </div>
                )}
            </div>

            {selectedDataset && (
                <DatasetViewer
                    open={!!selectedDataset}
                    dataset={selectedDataset}
                    onOpenChange={(open) => {
                        if (!open) setSelectedRow(null);
                    }}
                />
            )}
        </div>
    );
}
