// src/components/FilterPanel.tsx
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";

export type FilterField = {
    key: string;
    label: string;
};

interface FilterPanelProps {
    query: string;
    onQueryChange: (v: string) => void;
    sortOption: string;
    onSortChange: (v: string) => void;
    onClearAll: () => void;
    onCollapseAll: () => void;
    filterFields: FilterField[];
    collapsedSections: Record<string, boolean>;
    toggleSection: (key: string) => void;
    uniqueValues: (field: string) => string[];
    fieldFilters: Record<string, string[]>;
    toggleFieldValue: (field: string, value: string) => void;
    dateFrom: string | null;
    dateTo: string | null;
    onDateFromChange: (v: string | null) => void;
    onDateToChange: (v: string | null) => void;
    typeFilters: string[];
    toggleTypeFilter: (val: string) => void;
    loadedFilterOptions: Record<string, number>;
    loadMoreFilterOptions: (field: string) => void;
}

export default function FilterPanel({
    query,
    onQueryChange,
    sortOption,
    onSortChange,
    onClearAll,
    onCollapseAll,
    filterFields,
    collapsedSections,
    toggleSection,
    uniqueValues,
    fieldFilters,
    toggleFieldValue,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    typeFilters,
    toggleTypeFilter,
    loadedFilterOptions,
    loadMoreFilterOptions,
}: FilterPanelProps) {
    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-3 pr-4">
            <Input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="src_ip='10.1.1.1'"
                className="bg-neutral-800 border-neutral-700 text-white"
            />

            <Select value={sortOption} onValueChange={onSortChange}>
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                    <SelectItem value="Newest">Newest</SelectItem>
                    <SelectItem value="Oldest">Oldest</SelectItem>
                    <SelectItem value="A-Z">A-Z</SelectItem>
                    <SelectItem value="Z-A">Z-A</SelectItem>
                </SelectContent>
            </Select>

            <div className="flex gap-2">
                <Button
                    onClick={onClearAll}
                    className="bg-yellow-400 text-black hover:bg-yellow-300"
                >
                    View All
                </Button>
                <Button
                    variant="outline"
                    onClick={onCollapseAll}
                    className="bg-neutral-900 text-yellow-400 border-neutral-700 hover:bg-neutral-800"
                >
                    Collapse all
                </Button>
            </div>

            {/* Date range */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg">
                <button
                    type="button"
                    onClick={() => toggleSection("date_range")}
                    className="flex items-center justify-between w-full bg-black text-yellow-400 rounded-t-lg px-2 py-1"
                >
                    <span className="text-sm font-semibold">Date Range</span>
                    {collapsedSections["date_range"] ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronUp className="w-4 h-4" />
                    )}
                </button>
                {!collapsedSections["date_range"] && (
                    <div className="p-2 flex gap-2 text-xs">
                        <input
                            type="date"
                            value={dateFrom ?? ""}
                            onChange={(e) => onDateFromChange(e.target.value || null)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                        />
                        <input
                            type="date"
                            value={dateTo ?? ""}
                            onChange={(e) => onDateToChange(e.target.value || null)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                        />
                    </div>
                )}
            </div>

            {/* Field filters */}
            {filterFields.map((f) => {
                const selectedVals = fieldFilters[f.key] || [];
                return (
                    <div
                        key={f.key}
                        className="bg-neutral-800 border border-neutral-700 rounded-lg"
                    >
                        <button
                            type="button"
                            onClick={() => toggleSection(f.key)}
                            className="flex items-center justify-between w-full bg-black text-yellow-400 rounded-t-lg px-2 py-1"
                        >
                            <span className="text-sm font-semibold">{f.label}</span>
                            {collapsedSections[f.key] ? (
                                <ChevronDown className="w-4 h-4" />
                            ) : (
                                <ChevronUp className="w-4 h-4" />
                            )}
                        </button>
                        {!collapsedSections[f.key] && (
                            <div className="p-2 flex flex-wrap gap-2 overflow-x-hidden">
                                {uniqueValues(f.key)
                                    .slice(0, loadedFilterOptions[f.key])
                                    .map((val) => {
                                        const selected = selectedVals.includes(val);
                                        return (
                                            <Button
                                                key={val}
                                                size="sm"
                                                variant="outline"
                                                className={
                                                    selected
                                                        ? "bg-yellow-400 text-black hover:bg-yellow-300"
                                                        : "bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                                                }
                                                onClick={() => toggleFieldValue(f.key, val)}
                                            >
                                                {val}
                                            </Button>
                                        );
                                    })}
                                {uniqueValues(f.key).length > loadedFilterOptions[f.key] && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-neutral-900 text-white border-neutral-700"
                                        onClick={() => loadMoreFilterOptions(f.key)}
                                    >
                                        Load More
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Type filter */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg">
                <button
                    type="button"
                    onClick={() => toggleSection("type")}
                    className="flex items-center justify-between w-full bg-black text-yellow-400 rounded-t-lg px-2 py-1"
                >
                    <span className="text-sm font-semibold">Type</span>
                    {collapsedSections["type"] ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronUp className="w-4 h-4" />
                    )}
                </button>
                {!collapsedSections["type"] && (
                    <div className="p-2 flex gap-3 flex-wrap text-sm">
                        {["info", "error", "warning", "high", "low"].map((type) => (
                            <label key={type} className="inline-flex items-center gap-2">
                                <Checkbox
                                    checked={typeFilters.includes(type)}
                                    onCheckedChange={() => toggleTypeFilter(type)}
                                />
                                {type}
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
