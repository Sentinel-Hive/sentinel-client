import { useState, useEffect, useMemo } from "react";
import { getLogField } from "@/lib/utils";
import ColorPicker, { EventColor, ColorCriteria } from "../components/LogGraph/ColorPicker";
import ObsidianGraph from "../components/LogGraph/ObsidianGraph";
import GraphControls from "../components/LogGraph/GraphControls";
import AnalyticsHeader from "../components/AnalyticsHeader";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { RelationshipTypes } from "../types/types";
import { useSelectedLogs, useSelectedDatasets } from "@/store/datasetStore";
import LogGeoMap from "../components/LogGraph/LogGeoMap";

interface GraphOption {
    id: string;
    name: string;
    enabled: boolean;
    height: number;
}

const defaultGraphOptions: GraphOption[] = [
    { id: "obsidian", name: "Node Graph", enabled: true, height: 400 },
    { id: "geomap", name: "Geographic Map", enabled: false, height: 300 },
    { id: "error", name: "Error Graph", enabled: false, height: 300 },
];

const DEFAULT_SIDEBAR_WIDTH = 300; // Match analytics page width
const MIN_SIDEBAR_WIDTH = 275; // Prevent panel from getting too small
const MIN_GRAPH_WIDTH = 480; // Always leave room for the graph
const MAX_SIDEBAR_FRACTION = 0.3; // Cap sidebar at 50% of viewport

const Graphs = () => {
    const [eventColors, setEventColors] = useState<EventColor[]>([]);
    const [colorCriteria, setColorCriteria] = useState<ColorCriteria>("event_type");
    const [selectedRelationship, setSelectedRelationship] = useState(
        RelationshipTypes.IP_CONNECTION
    );
    const rawLogs = useSelectedLogs();
    const rawSelectedDatasets = useSelectedDatasets();

    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [graphOptions, setGraphOptions] = useState<GraphOption[]>(defaultGraphOptions);
    const [isResizingGraph, setIsResizingGraph] = useState<string | null>(null);
    // Physics controls
    const [centerStrength, setCenterStrength] = useState(0.05);
    const [repelStrength, setRepelStrength] = useState(-100);
    const [linkStrength, setLinkStrength] = useState(1);
    const [linkDistance, setLinkDistance] = useState(30);

    const logs = useMemo(() => (Array.isArray(rawLogs) ? rawLogs : []), [rawLogs]);

    const selectedDatasets = useMemo(
        () => (Array.isArray(rawSelectedDatasets) ? rawSelectedDatasets : []),
        [rawSelectedDatasets]
    );

    const graphLogs = useMemo(
        () =>
            logs.map((log, index) => {
                const safe = (log ?? {}) as any;
                return {
                    ...safe,
                    id: safe.id || `log-${index}`,
                    type: safe.type || safe.event_type || "unknown",
                };
            }),
        [logs]
    );

    const handleColorChange = (eventType: string, color: string) => {
        setEventColors((colors) =>
            colors.map((c) => (c.eventType === eventType ? { ...c, color } : c))
        );
    };

    const handleRemoveColor = (eventType: string) => {
        setEventColors((colors) => colors.filter((c) => c.eventType !== eventType));
    };

    const handleAddColor = (eventType: string, color: string) => {
        setEventColors((colors) => [...colors, { eventType, color }]);
    };

    const availableValues = useMemo(() => {
        const values = {
            event_type: new Set<string>(),
            severity: new Set<string>(),
            app_type: new Set<string>(),
            src_ip: new Set<string>(),
            dest_ip: new Set<string>(),
            user: new Set<string>(),
        } as const;

        const addIf = (set: Set<string>, v?: string) => {
            if (v && String(v).trim().length > 0) set.add(String(v));
        };

        logs.forEach((log) => {
            addIf(values.event_type, getLogField(log, "event_type"));
            addIf(values.severity, getLogField(log, "severity"));
            addIf(values.app_type, getLogField(log, "app"));
            addIf(values.src_ip, getLogField(log, "src_ip"));
            addIf(values.dest_ip, getLogField(log, "dest_ip"));
            addIf(values.user, getLogField(log, "user"));
        });

        return {
            event_type: Array.from(values.event_type),
            severity: Array.from(values.severity),
            app_type: Array.from(values.app_type),
            src_ip: Array.from(values.src_ip),
            dest_ip: Array.from(values.dest_ip),
            user: Array.from(values.user),
        };
    }, [logs]);

    // Sidebar resize handler
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isResizingSidebar || sidebarCollapsed) return;
            // Compute dynamic max: leave at least MIN_GRAPH_WIDTH for graph and cap by fraction
            const maxByMinGraph = window.innerWidth - MIN_GRAPH_WIDTH;
            const maxByFraction = Math.floor(window.innerWidth * MAX_SIDEBAR_FRACTION);
            const max = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxByMinGraph, maxByFraction));
            const w = Math.min(Math.max(e.clientX, MIN_SIDEBAR_WIDTH), max);
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

    // Keep sidebar width within constraints on window resize or collapse toggle
    useEffect(() => {
        const clampSidebar = () => {
            const maxByMinGraph = window.innerWidth - MIN_GRAPH_WIDTH;
            const maxByFraction = Math.floor(window.innerWidth * MAX_SIDEBAR_FRACTION);
            const max = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxByMinGraph, maxByFraction));
            setSidebarWidth((prev) => {
                const next = Math.min(Math.max(prev, MIN_SIDEBAR_WIDTH), max);
                return sidebarCollapsed ? prev : next;
            });
        };
        clampSidebar();
        window.addEventListener("resize", clampSidebar);
        return () => window.removeEventListener("resize", clampSidebar);
    }, [sidebarCollapsed]);

    // Graph height resize handler
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isResizingGraph) return;

            const rect = document.getElementById(isResizingGraph)?.getBoundingClientRect();
            if (!rect) return;

            setGraphOptions((prev) => {
                const enabledGraphs = prev.filter((g) => g.enabled);
                if (enabledGraphs.length <= 1) return prev;

                return prev.map((graph) => {
                    if (graph.id === isResizingGraph) {
                        const newHeight = Math.max(200, e.clientY - rect.top);
                        return {
                            ...graph,
                            height: newHeight,
                        };
                    }
                    return graph;
                });
            });
        };

        const onUp = () => setIsResizingGraph(null);

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isResizingGraph]);

    const handleToggleSidebar = () => setSidebarCollapsed((prev) => !prev);

    const handleToggleGraph = (graphId: string) => {
        setGraphOptions((prev) =>
            prev.map((graph) =>
                graph.id === graphId ? { ...graph, enabled: !graph.enabled } : graph
            )
        );
    };

    // Compute once to control layout behavior
    const enabledCount = graphOptions.filter((g) => g.enabled).length;

    // Build a consistent shapes mapping keyed by dataset id string
    const shapeOptions = ["circle", "square", "triangle", "diamond", "pentagon"];
    const datasetShapes = Object.fromEntries(
        selectedDatasets.map((ds, i) => [String(ds.id), shapeOptions[i % shapeOptions.length]])
    );

    // Inline shape mark for dataset legend
    const ShapeMark = ({ shape }: { shape?: string }) => {
        const s = shape || "circle";
        const size = 14;
        const half = size / 2;
        const r = 6;
        if (s === "square") {
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="text-yellow-400"
                >
                    <rect
                        x={half - r}
                        y={half - r}
                        width={r * 2}
                        height={r * 2}
                        fill="currentColor"
                    />
                </svg>
            );
        }
        if (s === "triangle") {
            const points = [
                [half, half - r],
                [half - r, half + r],
                [half + r, half + r],
            ]
                .map((p) => p.join(","))
                .join(" ");
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="text-yellow-400"
                >
                    <polygon points={points} fill="currentColor" />
                </svg>
            );
        }
        if (s === "diamond") {
            const points = [
                [half, half - r],
                [half - r, half],
                [half, half + r],
                [half + r, half],
            ]
                .map((p) => p.join(","))
                .join(" ");
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="text-yellow-400"
                >
                    <polygon points={points} fill="currentColor" />
                </svg>
            );
        }
        if (s === "pentagon") {
            const sides = 5;
            const pts: Array<[number, number]> = [];
            for (let i = 0; i < sides; i++) {
                const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
                pts.push([half + Math.cos(a) * r, half + Math.sin(a) * r]);
            }
            const d = pts.map((p) => p.join(",")).join(" ");
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="text-yellow-400"
                >
                    <polygon points={d} fill="currentColor" />
                </svg>
            );
        }
        // default circle
        return (
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="text-yellow-400"
            >
                <circle cx={half} cy={half} r={r} fill="currentColor" />
            </svg>
        );
    };

    return (
        <div className="h-full flex flex-col">
            {/* Sub-navigation header for Logs/Graphs */}
            <div className="fixed top-[61.5px] inset-x-0 bg-neutral-900 z-10">
                <AnalyticsHeader />
            </div>

            {/* Main content under the sub-header */}
            <div className="fixed inset-x-0 top-[96px] bottom-0 bg-black text-white flex z-0">
                {/* Left Panel - Completely Separate */}
                <div
                    className="h-full bg-neutral-800 overflow-hidden"
                    style={{
                        width: sidebarCollapsed ? "0" : `${sidebarWidth}px`,
                        transition: isResizingSidebar ? "none" : "width 200ms ease-out",
                        pointerEvents: sidebarCollapsed ? "none" : "auto",
                    }}
                >
                    <div className="h-full overflow-y-auto" style={{ width: "100%" }}>
                        <div className="p-3 space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">
                                    Graph Views
                                </h3>
                                {graphOptions.map((graph) => (
                                    <div key={graph.id} className="flex flex-col gap-1">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={graph.enabled}
                                                onChange={() => handleToggleGraph(graph.id)}
                                                className="rounded border-neutral-700 bg-neutral-800 text-yellow-400 focus:ring-yellow-400/30"
                                            />
                                            {graph.name}
                                        </label>
                                        {graph.enabled &&
                                            graphOptions.filter((g) => g.enabled).length > 1 && (
                                                <div className="ml-6 flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setGraphOptions((prev) =>
                                                                prev.map((g) =>
                                                                    g.id === graph.id
                                                                        ? {
                                                                              ...g,
                                                                              height:
                                                                                  window.innerHeight -
                                                                                  200,
                                                                          }
                                                                        : g
                                                                )
                                                            );
                                                        }}
                                                        className="text-xs px-2 py-1 rounded bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-yellow-400"
                                                    >
                                                        Maximize Height
                                                    </button>
                                                </div>
                                            )}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 border-t border-neutral-700">
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">
                                    Selected Datasets
                                </h3>
                                {selectedDatasets.length === 0 ? (
                                    <div className="text-xs text-neutral-400">
                                        No datasets selected on Analytics page.
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {selectedDatasets.map((ds) => (
                                            <div
                                                key={ds.id}
                                                className="rounded bg-neutral-900 border border-neutral-700 px-3 py-1 text-sm text-neutral-200 flex items-center gap-2"
                                            >
                                                <ShapeMark shape={datasetShapes[String(ds.id)]} />
                                                <span>{ds.name}</span>
                                            </div>
                                        ))}
                                        <div className="text-xs text-neutral-400 pt-1">
                                            {logs.length} logs loaded from {selectedDatasets.length}{" "}
                                            dataset{selectedDatasets.length > 1 ? "s" : ""}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-neutral-700">
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">
                                    Log Colors
                                </h3>
                                <div className="space-y-1">
                                    <ColorPicker
                                        colors={eventColors}
                                        onColorChange={handleColorChange}
                                        onRemoveColor={handleRemoveColor}
                                        onAddColor={handleAddColor}
                                        availableValues={availableValues}
                                        selectedCriteria={colorCriteria}
                                        onCriteriaChange={(c) => {
                                            setColorCriteria(c);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-neutral-700">
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">
                                    Set Node Graph Relationship
                                </h3>
                                <div className="space-y-1">
                                    <GraphControls
                                        selectedRelationship={selectedRelationship}
                                        onRelationshipChange={setSelectedRelationship}
                                    />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-neutral-700">
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">
                                    Graph Physics
                                </h3>
                                <div className="space-y-3 text-xs">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-neutral-300">Center</span>
                                            <span className="text-neutral-400">
                                                {centerStrength.toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={0.5}
                                            step={0.01}
                                            value={centerStrength}
                                            onChange={(e) =>
                                                setCenterStrength(parseFloat(e.target.value))
                                            }
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-neutral-300">Repel</span>
                                            <span className="text-neutral-400">
                                                {repelStrength}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={-500}
                                            max={-10}
                                            step={5}
                                            value={repelStrength}
                                            onChange={(e) =>
                                                setRepelStrength(parseInt(e.target.value, 10))
                                            }
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-neutral-300">Link</span>
                                            <span className="text-neutral-400">
                                                {linkStrength.toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={linkStrength}
                                            onChange={(e) =>
                                                setLinkStrength(parseFloat(e.target.value))
                                            }
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-neutral-300">Link distance</span>
                                            <span className="text-neutral-400">
                                                {linkDistance}px
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10}
                                            max={200}
                                            step={5}
                                            value={linkDistance}
                                            onChange={(e) =>
                                                setLinkDistance(parseInt(e.target.value, 10))
                                            }
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resize Handle */}
                {!sidebarCollapsed && (
                    <div
                        className="w-1 h-full bg-neutral-700 hover:bg-yellow-400 cursor-col-resize transition-colors"
                        onMouseDown={() => setIsResizingSidebar(true)}
                    />
                )}

                {/* Main Content Area */}
                <div
                    className="flex-1 h-full flex flex-col min-h-0"
                    style={{ minWidth: MIN_GRAPH_WIDTH }}
                >
                    {/* Graph Header */}
                    <div className="px-4 py-2 border-b border-neutral-800">
                        <div className="flex items-center gap-x-4">
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
                            <span className="text-sm text-neutral-400">
                                {logs.length} logs loaded
                            </span>
                        </div>
                    </div>

                    {/* Graphs Area */}
                    <div
                        className={`flex-1 min-h-0 ${enabledCount > 1 ? "overflow-y-auto" : "overflow-hidden"}`}
                    >
                        <div className={`${enabledCount > 1 ? "pb-96" : ""} h-full space-y-1 p-1`}>
                            {graphOptions
                                .filter((graph) => graph.enabled)
                                .map((graph, index, enabledGraphs) => (
                                    <div
                                        key={graph.id}
                                        id={graph.id}
                                        className="relative bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden"
                                        style={{
                                            height:
                                                enabledGraphs.length === 1
                                                    ? "100%"
                                                    : `${graph.height}px`,
                                            minHeight: enabledGraphs.length > 1 ? "200px" : "100%",
                                        }}
                                    >
                                        {/* Placeholder content for each graph type */}
                                        {graph.id === "obsidian" && (
                                            <ObsidianGraph
                                                logs={graphLogs}
                                                selectedRelationship={selectedRelationship}
                                                colors={Object.fromEntries(
                                                    eventColors.map((c) => [c.eventType, c.color])
                                                )}
                                                colorCriteria={colorCriteria}
                                                shapes={{
                                                    ...datasetShapes,
                                                    default: "circle",
                                                }}
                                                centerStrength={centerStrength}
                                                repelStrength={repelStrength}
                                                linkStrength={linkStrength}
                                                linkDistance={linkDistance}
                                                onNodeClick={(node) =>
                                                    console.log("Node clicked:", node)
                                                }
                                            />
                                        )}
                                        {graph.id === "geomap" && <LogGeoMap logs={graphLogs} />}

                                        {graph.id === "error" && (
                                            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                                Error Graph Placeholder
                                            </div>
                                        )}

                                        {/* Resize handle - show for all graphs when multiple are present */}
                                        {enabledGraphs.length > 1 && (
                                            <div
                                                className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700 hover:bg-yellow-400 cursor-row-resize"
                                                onMouseDown={() => setIsResizingGraph(graph.id)}
                                            />
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Graphs;
