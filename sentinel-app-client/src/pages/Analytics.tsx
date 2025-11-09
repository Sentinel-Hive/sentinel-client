// src/pages/Analytics.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "../components/ui/button";
import LogUploader from "../components/LogUploader";
import { Log } from "../types/types";
import { ChevronsLeft, ChevronsRight, PanelTopClose, PanelBottomClose, X } from "lucide-react";
import AnalyticsHeader from "../components/AnalyticsHeader";
import FilterPanel, { FilterField } from "../components/FilterPanel";

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

// helper to read arbitrary field off a log without using any
function getLogField(log: Log | (Log & Record<string, unknown>), field: string): string {
    const record = log as Record<string, unknown>;
    const val = record[field];
    return val == null ? "" : String(val);
}

// helper to get the best timestamp-like field
function getLogTimestamp(log: Log | (Log & Record<string, unknown>)): string | undefined {
    const record = log as Record<string, unknown>;
    return (
        log.timestamp ||
        (typeof record.createdDateTime === "string" ? record.createdDateTime : undefined) ||
        (typeof record._time === "string" ? record._time : undefined) ||
        (typeof record.created_at === "string" ? record.created_at : undefined)
    );
}

export default function Analytics() {
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [filtersHeight, setFiltersHeight] = useState(DEFAULT_FILTERS_HEIGHT);
    const [isResizingFilters, setIsResizingFilters] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [logListCollapsed, setLogListCollapsed] = useState(false);

    const sidebarRef = useRef<HTMLDivElement | null>(null);
    const savedLogSplitRef = useRef<number>(DEFAULT_FILTERS_HEIGHT);

    const [logs, setLogs] = useState<Log[]>([]);
    const [displayedLogs, setDisplayedLogs] = useState<Log[]>([]);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
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
                .concat([["date_range", false] as const, ["type", false] as const])
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
                    .concat([["date_range", true] as const, ["type", true] as const])
            )
        );
    };

    const expandAllFilterSections = () => {
        setCollapsedFilterSections(
            Object.fromEntries(
                filterFields
                    .map((f) => [f.key, false] as const)
                    .concat([["date_range", false] as const, ["type", false] as const])
            )
        );
    };

    const handleLogsProcessed = (processedLogs: Log[]) => {
        setLogs(processedLogs);
        setDisplayedLogs(processedLogs.slice(0, logsToShow));
        setSelectedLog(null);
    };

    const handleUploadStart = () => {
        setUploading(true);
        setUploadProgress(0);
        setLogs([]);
        setDisplayedLogs([]);
        setSelectedLog(null);
    };
    const handleUploadProgress = (progress: number) => setUploadProgress(progress);
    const handleUploadComplete = () => setUploading(false);

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

    const loadMoreFilterOptions = (field: string) => {
        setLoadedFilterOptions((prev) => ({
            ...prev,
            [field]: prev[field] + ITEMS_PER_LOAD,
        }));
    };

    const uniqueValues = (field: string) =>
        Array.from(new Set(logs.map((l) => getLogField(l, field)).filter((s) => s.length > 0)));

    const parseSQLQuery = (q: string): Record<string, string> => {
        const out: Record<string, string> = {};
        const regex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(q)) !== null) {
            out[m[1]] = m[2];
        }
        return out;
    };

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
        setDisplayedLogs(filteredLogs.slice(0, logsToShow));
    }, [filteredLogs, logsToShow]);

    // sidebar vertical resize
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

    // filters/logs horizontal resize
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

    // esc to deselect
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
                // collapsing
                savedLogSplitRef.current = filtersHeight;
                if (sidebarRef.current) {
                    const h = sidebarRef.current.getBoundingClientRect().height;
                    setFiltersHeight(h - TITLE_H);
                }
            } else {
                // reopening
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

    // build filter chips
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

    return (
        <div className="h-full flex flex-col">
            <div className="fixed top-[61px] inset-x-0 bg-neutral-900 z-10">
                <AnalyticsHeader />
            </div>
            <div className="flex-1 bg-black pt-10">
                <div className="fixed inset-x-0 top-24 bottom-0 bg-black text-white flex overflow-hidden">
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
                    {/* FILTERS SECTION */}
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

                    {/* horizontal resizer */}
                    {!filtersCollapsed && !logListCollapsed && (
                        <div
                            onMouseDown={() => setIsResizingFilters(true)}
                            className="absolute left-0 bg-neutral-700/70 hover:bg-yellow-400/70 cursor-row-resize z-30"
                            style={{
                                top: filtersHeight - 2,
                                height: 6,
                                width: "calc(100% - 8px)", // leave room for scrollbar
                            }}
                        />
                    )}

                    {/* LOGS SECTION */}
                    {!logListCollapsed ? (
                        <div className="flex-1 flex flex-col">
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
                            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-2">
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
                                                className={`p-2 rounded border cursor-pointer ${
                                                    isSelected
                                                        ? "bg-yellow-400 text-black border-yellow-300"
                                                        : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                                                }`}
                                            >
                                                {log.message}
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

                    {/* vertical resizer with padding so it doesn't cover scroll bars */}
                    <div
                        onMouseDown={() => setIsResizingSidebar(true)}
                        className="absolute top-0 right-[-3px] h-full w-[6px] bg-neutral-800/80 hover:bg-yellow-400/70 cursor-col-resize z-40"
                    />
                </div>
            )}

            {/* RIGHT SIDE */}
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
                            <LogUploader
                                onLogsProcessed={handleLogsProcessed}
                                uploading={uploading}
                                uploadProgress={uploadProgress}
                                onUploadStart={handleUploadStart}
                                onUploadProgress={handleUploadProgress}
                                onUploadComplete={handleUploadComplete}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 m-4 bg-neutral-900 border border-neutral-700 rounded-lg p-4 overflow-auto">
                        {selectedLog ? (
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-neutral-100">
                                {JSON.stringify(selectedLog, null, 2)}
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
        </div>
    </div>
    );
}
