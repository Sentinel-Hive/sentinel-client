// src/pages/Analytics.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "../components/ui/button";
import { DatasetItem, Log } from "../types/types";
import {
    ChevronsLeft,
    ChevronsRight,
    PanelTopClose,
    PanelBottomClose,
    X,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import FilterPanel, { FilterField } from "../components/FilterPanel";
import { useDatasets } from "@/store/datasetStore";
import { Checkbox } from "../components/ui/checkbox";
import {
    getLogField,
    getLogTimestamp,
    parseLogsFromContent,
    parseSQLQuery,
    uniqueFieldValues,
    getDatasetLabel,
} from "@/lib/utils";

const filterFields: FilterField[] = [
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

const TITLE_H = 30;
const DEFAULT_FILTERS_HEIGHT = 260;

export default function Analytics() {
    const datasets = useDatasets();

    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [filtersHeight, setFiltersHeight] = useState(DEFAULT_FILTERS_HEIGHT);
    const [isResizingFilters, setIsResizingFilters] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [logListCollapsed, setLogListCollapsed] = useState(false);

    const sidebarRef = useRef<HTMLDivElement | null>(null);
    const savedLogSplitRef = useRef<number>(DEFAULT_FILTERS_HEIGHT);

    const [selectedDatasets, setSelectedDatasets] = useState<DatasetItem[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [displayedLogs, setDisplayedLogs] = useState<Log[]>([]);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<string[]>([]);
    const [fieldFilters, setFieldFilters] = useState<Record<string, string[]>>(
        Object.fromEntries(filterFields.map((f) => [f.key, []]))
    );
    const [dateFrom, setDateFrom] = useState<string | null>(null);
    const [dateTo, setDateTo] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState("Newest");
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [logsToShow, setLogsToShow] = useState(500);
    const ITEMS_PER_LOAD = 20;
    const [loadedFilterOptions, setLoadedFilterOptions] = useState<Record<string, number>>(
        Object.fromEntries(filterFields.map((f) => [f.key, ITEMS_PER_LOAD]))
    );
    const [collapsedFilterSections, setCollapsedFilterSections] = useState<Record<string, boolean>>(
        Object.fromEntries(
            filterFields
                .map((f) => [f.key, false] as const)
                .concat([
                    ["date_range", false] as const,
                    ["type", false] as const,
                    ["datasets", false] as const,
                ])
        )
    );

    const clearAll = () => {
        setQuery("");
        setFilters([]);
        setFieldFilters(Object.fromEntries(filterFields.map((f) => [f.key, []])));
        setDateFrom(null);
        setDateTo(null);
        setLogsToShow(500);
    };

    const collapseAllFilterSections = () => {
        setCollapsedFilterSections(
            Object.fromEntries(
                filterFields
                    .map((f) => [f.key, true] as const)
                    .concat([
                        ["date_range", true] as const,
                        ["type", true] as const,
                        ["datasets", true] as const,
                    ])
            )
        );
    };

    const expandAllFilterSections = () => {
        setCollapsedFilterSections(
            Object.fromEntries(
                filterFields
                    .map((f) => [f.key, false] as const)
                    .concat([
                        ["date_range", false] as const,
                        ["type", false] as const,
                        ["datasets", false] as const,
                    ])
            )
        );
    };

    const loadMoreLogs = () => setLogsToShow((prev) => prev + 500);

    const toggleTypeFilter = (type: string) => {
        setFilters((prev) =>
            prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type]
        );
    };

    const toggleFieldFilter = (field: string, value: string) => {
        setFieldFilters((prev) => {
            const current = prev[field] || [];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter((v) => v !== value) };
            }
            return { ...prev, [field]: [...current, value] };
        });
    };

    const formatEventType = (evtRaw: string): string => {
        if (!evtRaw) return "";
        // Take last segment after dot if dotted (e.g., http.forbidden -> forbidden)
        // If comma separated, take last non-empty trimmed part.
        const cleaned = evtRaw.trim();
        const commaParts = cleaned
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
        const lastComma = commaParts.length ? commaParts[commaParts.length - 1] : cleaned;
        const dotParts = lastComma.split(".").filter(Boolean);
        const core = dotParts.length ? dotParts[dotParts.length - 1] : lastComma;
        // Replace underscores with space and title-case each word.
        return core
            .replace(/_/g, " ")
            .split(/\s+/)
            .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
            .join(" ");
    };

    const getDisplayName = (log: Record<string, unknown> | undefined): string => {
        const record = log as Record<string, unknown>;
        const app = (record.app ?? record.appDisplayName ?? "").toString();
        const evtRaw = (record.evt_type ?? record.event_type ?? record.eventtype ?? "").toString();
        const evtDisplay = formatEventType(evtRaw);
        if (app && evtDisplay) return app + " " + evtDisplay;
        if (app) return app;
        if (evtDisplay) return evtDisplay;
        // fallback to id then message
        return (record.message ?? record.id ?? "").toString();
    };

    const loadMoreFilterOptions = (field: string) => {
        setLoadedFilterOptions((prev) => ({
            ...prev,
            [field]: prev[field] + ITEMS_PER_LOAD,
        }));
    };

    const uniqueValues = (field: string) => uniqueFieldValues(logs, field);

    const filteredLogs = useMemo(() => {
        const sqlFilters = parseSQLQuery(query);
        const list = logs
            .filter((log) => {
                for (const [field, value] of Object.entries(sqlFilters)) {
                    const v = getLogField(log, field).toLowerCase();
                    if (!v.includes(value.toLowerCase())) return false;
                }
                return true;
            })
            .filter((log) => (filters.length ? filters.includes(log.type) : true))
            .filter((log) => {
                if (dateFrom || dateTo) {
                    const tsRaw = getLogTimestamp(log);
                    const ts = tsRaw ? new Date(tsRaw).getTime() : null;
                    if (ts) {
                        if (dateFrom && ts < new Date(dateFrom).getTime()) return false;
                        if (dateTo) {
                            const d = new Date(dateTo);
                            d.setHours(23, 59, 59, 999);
                            if (ts > d.getTime()) return false;
                        }
                    }
                }

                for (const ff of filterFields) {
                    const selections = fieldFilters[ff.key] || [];
                    if (selections.length > 0) {
                        const logVal = getLogField(log, ff.key).toLowerCase();
                        const matched = selections.some((sel) => logVal === sel.toLowerCase());
                        if (!matched) return false;
                    }
                }
                return true;
            });

        const sorted = list.sort((a, b) => {
            const taRaw = getLogTimestamp(a);
            const tbRaw = getLogTimestamp(b);
            const ta = taRaw ? new Date(taRaw).getTime() : null;
            const tb = tbRaw ? new Date(tbRaw).getTime() : null;
            if (sortOption === "A-Z") return a.message.localeCompare(b.message);
            if (sortOption === "Z-A") return b.message.localeCompare(a.message);
            if (sortOption === "Oldest") {
                if (ta != null && tb != null) return ta - tb;
                return 0;
            }
            if (ta != null && tb != null) return tb - ta;
            return 0;
        });

        return sorted;
    }, [logs, query, filters, fieldFilters, dateFrom, dateTo, sortOption]);

    useEffect(() => {
        const nextLogs: Log[] = [];
        selectedDatasets.forEach((dataset) => {
            const fromDataset = parseLogsFromContent(dataset.content ?? null);
            nextLogs.push(...fromDataset);
        });
        setLogs(nextLogs);
    }, [selectedDatasets]);

    useEffect(() => {
        setDisplayedLogs(filteredLogs.slice(0, logsToShow));
    }, [filteredLogs, logsToShow]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isResizingSidebar || sidebarCollapsed) return;
            const min = 220;
            const max = window.innerWidth - 160;
            const w = Math.min(Math.max(e.clientX, min), max);
            setSidebarWidth(w);
        };
        const onUp = () => setIsResizingSidebar(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isResizingSidebar, sidebarCollapsed]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isResizingFilters || !sidebarRef.current) return;
            const top = sidebarRef.current.getBoundingClientRect().top;
            const h = sidebarRef.current.getBoundingClientRect().height;
            const y = e.clientY - top;
            const min = TITLE_H + 2;
            const max = h - (TITLE_H + 2);
            setFiltersHeight(Math.min(Math.max(y, min), max));
        };
        const onUp = () => setIsResizingFilters(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isResizingFilters]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedLog(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const handleCollapseFiltersPane = () => {
        setFiltersCollapsed((prev) => {
            const next = !prev;
            if (!next) {
                setFiltersHeight((h) => (h < TITLE_H + 10 ? DEFAULT_FILTERS_HEIGHT : h));
            }
            if (next) setLogListCollapsed(false);
            return next;
        });
    };

    const handleCollapseLogList = () => {
        setLogListCollapsed((prev) => {
            const next = !prev;
            if (next) {
                savedLogSplitRef.current = filtersHeight;
                if (sidebarRef.current) {
                    const h = sidebarRef.current.getBoundingClientRect().height;
                    setFiltersHeight(h - TITLE_H);
                }
            } else {
                const restored = savedLogSplitRef.current;
                setFiltersHeight(() => {
                    const min = TITLE_H + 10;
                    return restored < min ? DEFAULT_FILTERS_HEIGHT : restored;
                });
            }
            return next;
        });
    };

    const handleToggleSidebar = () => setSidebarCollapsed((prev) => !prev);

    const resizing = isResizingSidebar || isResizingFilters;

    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    for (const ff of filterFields) {
        const selectedVals = fieldFilters[ff.key] || [];
        selectedVals.forEach((val) => {
            chips.push({
                id: `field:${ff.key}:${val}`,
                label: `${ff.label}: ${val}`,
                onRemove: () => toggleFieldFilter(ff.key, val),
            });
        });
    }
    if (dateFrom || dateTo) {
        chips.push({
            id: "date_range",
            label: `Date: ${dateFrom ?? "any"} → ${dateTo ?? "any"}`,
            onRemove: () => {
                setDateFrom(null);
                setDateTo(null);
            },
        });
    }
    filters.forEach((t) => {
        chips.push({
            id: `type:${t}`,
            label: `Type: ${t}`,
            onRemove: () => toggleTypeFilter(t),
        });
    });
    if (query.trim() !== "") {
        chips.push({
            id: "query",
            label: `Query: ${query.trim()}`,
            onRemove: () => setQuery(""),
        });
    }

    const toggleDataset = (dataset: DatasetItem) => {
        setSelectedDatasets((prev) => {
            const exists = prev.some((d) => d.id === dataset.id);
            if (exists) {
                return prev.filter((d) => d.id !== dataset.id);
            }
            return [...prev, dataset];
        });
    };

    const clearDatasets = () => {
        setSelectedDatasets([]);
    };

    return (
        <div className="fixed inset-x-0 top-[64px] bottom-0 bg-black text-white flex overflow-hidden z-10">
            {resizing && (
                <div
                    className={`fixed inset-0 z-[9999] bg-transparent ${
                        isResizingSidebar ? "cursor-col-resize" : "cursor-row-resize"
                    } select-none`}
                />
            )}

            {!sidebarCollapsed && (
                <div
                    ref={sidebarRef}
                    className="relative h-full bg-neutral-900 border-r border-neutral-700 flex flex-col transition-all duration-150 pr-[6px]"
                    style={{ width: sidebarWidth }}
                >
                    {!filtersCollapsed ? (
                        <div
                            className="flex flex-col"
                            style={{
                                height: logListCollapsed
                                    ? `calc(100% - ${TITLE_H}px)`
                                    : filtersHeight,
                            }}
                        >
                            <div className="flex items-center justify-between h-[30px] px-3 bg-neutral-900/95 border-b border-neutral-700 sticky top-0 z-10">
                                <span className="text-xs font-semibold text-yellow-400">
                                    Filters
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={collapseAllFilterSections}
                                        className="h-6 px-2 text-[10px] bg-black border border-neutral-700 rounded text-yellow-400"
                                    >
                                        Collapse All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={expandAllFilterSections}
                                        className="h-6 px-2 text-[10px] bg-black border border-neutral-700 rounded text-yellow-400"
                                    >
                                        Expand All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCollapseFiltersPane}
                                        className="h-6 w-6 flex items-center justify-center rounded bg-black border border-neutral-700"
                                    >
                                        <PanelTopClose className="w-4 h-4 text-yellow-400" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="px-3 pt-2 pb-1">
                                    <div className="bg-neutral-800 border border-neutral-700 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCollapsedFilterSections((prev) => ({
                                                    ...prev,
                                                    datasets: !prev.datasets,
                                                }))
                                            }
                                            className="flex items-center justify-between w-full bg-black text-yellow-400 rounded-t-lg px-2 py-1"
                                        >
                                            <span className="text-sm font-semibold">Datasets</span>
                                            {collapsedFilterSections.datasets ? (
                                                <ChevronDown className="w-4 h-4" />
                                            ) : (
                                                <ChevronUp className="w-4 h-4" />
                                            )}
                                        </button>
                                        {!collapsedFilterSections.datasets && (
                                            <div className="p-2 flex flex-col gap-2 text-sm max-h-40 overflow-y-auto">
                                                {datasets.length === 0 ? (
                                                    <span className="text-xs text-neutral-400">
                                                        No datasets.
                                                    </span>
                                                ) : (
                                                    datasets.map((ds) => {
                                                        const selected = selectedDatasets.some(
                                                            (d) => d.id === ds.id
                                                        );
                                                        return (
                                                            <label
                                                                key={ds.id}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Checkbox
                                                                    checked={selected}
                                                                    onCheckedChange={() =>
                                                                        toggleDataset(ds)
                                                                    }
                                                                />
                                                                <span>{getDatasetLabel(ds)}</span>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                                {selectedDatasets.length > 0 && (
                                                    <div className="pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={clearDatasets}
                                                            className="text-[11px] text-yellow-400 hover:underline"
                                                        >
                                                            Clear selection
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <FilterPanel
                                    query={query}
                                    onQueryChange={setQuery}
                                    sortOption={sortOption}
                                    onSortChange={setSortOption}
                                    onClearAll={clearAll}
                                    onCollapseAll={collapseAllFilterSections}
                                    filterFields={filterFields}
                                    collapsedSections={collapsedFilterSections}
                                    toggleSection={(key) =>
                                        setCollapsedFilterSections((prev) => ({
                                            ...prev,
                                            [key]: !prev[key],
                                        }))
                                    }
                                    uniqueValues={uniqueValues}
                                    fieldFilters={fieldFilters}
                                    toggleFieldValue={toggleFieldFilter}
                                    dateFrom={dateFrom}
                                    dateTo={dateTo}
                                    onDateFromChange={setDateFrom}
                                    onDateToChange={setDateTo}
                                    typeFilters={filters}
                                    toggleTypeFilter={toggleTypeFilter}
                                    loadedFilterOptions={loadedFilterOptions}
                                    loadMoreFilterOptions={loadMoreFilterOptions}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between h-[30px] px-3 bg-neutral-900/95 border-b border-neutral-700">
                            <span className="text-xs font-semibold text-yellow-400">Filters</span>
                            <button
                                type="button"
                                onClick={handleCollapseFiltersPane}
                                className="h-6 w-6 flex items-center justify-center rounded bg-black border border-neutral-700"
                            >
                                <PanelTopClose className="w-4 h-4 text-yellow-400 rotate-180" />
                            </button>
                        </div>
                    )}

                    {!filtersCollapsed && !logListCollapsed && (
                        <div
                            onMouseDown={() => setIsResizingFilters(true)}
                            className="absolute left-0 bg-neutral-700/70 hover:bg-yellow-400/70 cursor-row-resize z-30"
                            style={{
                                top: filtersHeight - 2,
                                height: 6,
                                width: "calc(100% - 8px)",
                            }}
                        />
                    )}

                    {!logListCollapsed ? (
                        <div className="flex-1 min-h-0 flex flex-col">
                            <div className="flex items-center justify-between h-[30px] px-3 bg-neutral-900/95 border-b border-neutral-700 sticky top-0 z-10">
                                <span className="text-xs font-semibold text-yellow-400">Logs</span>
                                <button
                                    type="button"
                                    onClick={handleCollapseLogList}
                                    className="h-6 w-6 flex items-center justify-center rounded bg-black border border-neutral-700"
                                >
                                    <PanelBottomClose className="w-4 h-4 text-yellow-400" />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-2">
                                {displayedLogs.length === 0 ? (
                                    <div className="text-sm text-neutral-400 text-center py-4">
                                        No logs.
                                    </div>
                                ) : (
                                    displayedLogs.map((log) => {
                                        const isSelected = selectedLog?.id === log.id;
                                        return (
                                            <div
                                                key={log.id}
                                                onClick={() =>
                                                    setSelectedLog((prev) =>
                                                        prev?.id === log.id ? null : log
                                                    )
                                                }
                                                className={`p-2 rounded border overflow-hidden cursor-pointer ${
                                                    isSelected
                                                        ? "bg-yellow-400 text-black border-yellow-300"
                                                        : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                                                }`}
                                            >
                                                {getDisplayName(log.raw)}
                                            </div>
                                        );
                                    })
                                )}
                                {logsToShow < filteredLogs.length && (
                                    <Button
                                        onClick={loadMoreLogs}
                                        className="w-full bg-neutral-800 border border-neutral-600 hover:bg-neutral-700"
                                    >
                                        Load More
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between h-[30px] px-3 bg-neutral-900/95 border-t border-neutral-700">
                            <span className="text-xs font-semibold text-yellow-400">Logs</span>
                            <button
                                type="button"
                                onClick={handleCollapseLogList}
                                className="h-6 w-6 flex items-center justify-center rounded bg-black border border-neutral-700"
                            >
                                <PanelBottomClose className="w-4 h-4 text-yellow-400 rotate-180" />
                            </button>
                        </div>
                    )}

                    <div
                        onMouseDown={() => setIsResizingSidebar(true)}
                        className="absolute top-0 right-[-3px] h-full w-[6px] bg-neutral-800/80 hover:bg-yellow-400/70 cursor-col-resize z-40"
                    />
                </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col bg-black">
                <div className="px-4 py-2 text-sm text-neutral-400 flex items-center gap-3 border-b border-neutral-800">
                    <button
                        type="button"
                        onClick={handleToggleSidebar}
                        className="h-8 px-3 rounded bg-neutral-900 border border-neutral-700 flex items-center gap-2"
                    >
                        {sidebarCollapsed ? (
                            <>
                                <ChevronsRight className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs text-yellow-400">Show panel</span>
                            </>
                        ) : (
                            <>
                                <ChevronsLeft className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs text-yellow-400">Hide panel</span>
                            </>
                        )}
                    </button>
                    <span>
                        {filteredLogs.length} filtered / {logs.length} total
                    </span>
                    <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                        {chips.map((chip) => (
                            <div
                                key={chip.id}
                                className="flex items-center gap-1 bg-neutral-900 border border-yellow-400/50 rounded-full px-3 py-1 text-xs whitespace-nowrap"
                            >
                                <span className="text-yellow-400">{chip.label}</span>
                                <button
                                    type="button"
                                    onClick={chip.onRemove}
                                    className="h-4 w-4 flex items-center justify-center rounded-full bg-black border border-yellow-400/60"
                                    aria-label="Remove filter"
                                >
                                    <X className="w-3 h-3 text-yellow-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {logs.length === 0 ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                        <div className="w-full max-w-md">
                            <p>
                                Please SYNC with the server using the <strong>Sync</strong> button
                                in the header.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 m-4 bg-neutral-900 border border-neutral-700 rounded-lg p-4 overflow-auto">
                        {selectedLog ? (
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-neutral-100">
                                {JSON.stringify(selectedLog.raw, null, 2)}
                            </pre>
                        ) : (
                            <div className="text-sm text-neutral-400">
                                Select a log to view JSON.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
