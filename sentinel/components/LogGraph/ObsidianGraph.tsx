import { useState, useEffect, useRef, useLayoutEffect } from "react";
import * as d3 from "d3";
import { Log, NodeData, LinkData, RelationshipTypes } from "../../types/types";
import { getLogField, getLogTimestamp } from "@/lib/utils";

type SimulationNode = d3.SimulationNodeDatum & NodeData;
type SimulationLink = d3.SimulationLinkDatum<SimulationNode> & LinkData;

interface DragEvent {
    active: boolean;
    subject: SimulationNode;
    x: number;
    y: number;
    sourceEvent: MouseEvent | TouchEvent;
}

type Simulation = d3.Simulation<SimulationNode, SimulationLink>;

interface ObsidianGraphProps {
    logs: Log[];
    selectedRelationship: RelationshipTypes;
    colors: { [key: string]: string };
    shapes: { [key: string]: string };
    colorCriteria?: "event_type" | "severity" | "app_type" | "src_ip" | "dest_ip" | "user";
    // Physics controls
    centerStrength?: number; // strength for x/y centering forces
    repelStrength?: number; // many-body negative strength
    linkStrength?: number; // link force strength [0..1]
    linkDistance?: number; // link preferred distance in px
    onNodeClick?: (node: NodeData) => void;
    onLinkClick?: (link: LinkData) => void;
}

const ObsidianGraph = ({
    logs,
    selectedRelationship,
    colors,
    shapes,
    colorCriteria = "event_type",
    centerStrength = 0.35,
    repelStrength = -100,
    linkStrength = 1,
    linkDistance = 30,
    onNodeClick,
    onLinkClick,
}: ObsidianGraphProps) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const dimsRef = useRef({ width: 800, height: 600 });
    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [links, setLinks] = useState<LinkData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [simulation, setSimulation] = useState<Simulation | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Helper: read the value for the selected color criteria from a Log, with fallbacks
    const getCriteriaValue = (log: Log): string => {
        // Map UI criteria to actual Log fields used by our parser
        const field = colorCriteria === "app_type" ? "app" : colorCriteria;
        let value = getLogField(log, field);
        // Fallbacks for older or raw shapes
        if (!value) {
            if (field === "event_type") {
                value = log.event_type || log.type || "";
            } else if (field === "src_ip") {
                value = log.src_ip || log.ipAddress || "";
            } else if (field === "dest_ip") {
                value = log.dest_ip || (log as any).dest || "";
            } else if (field === "app") {
                value = log.app || log.appDisplayName || (log as any).resourceDisplayName || "";
            }
            // As a last resort, try raw field if present
            if (!value && log.raw && typeof log.raw[field] !== "undefined") {
                const rawVal = log.raw[field];
                if (
                    typeof rawVal === "string" ||
                    typeof rawVal === "number" ||
                    typeof rawVal === "boolean"
                ) {
                    value = String(rawVal);
                }
            }
        }
        return value || "";
    };

    // Helper to robustly extract a display value for common fields with raw fallbacks
    const valueFromLog = (log: Log, field: string): string => {
        // First, try centralized parser
        let v = getLogField(log, field);
        const asString = (x: unknown): string => {
            if (x == null) return "";
            if (typeof x === "string" || typeof x === "number" || typeof x === "boolean")
                return String(x);
            try {
                return JSON.stringify(x);
            } catch {
                return String(x);
            }
        };

        if (!v || v.trim() === "") {
            // Direct field on normalized log
            const direct = (log as any)[field];
            if (direct != null) v = asString(direct);
        }
        if (!v || v.trim() === "") {
            // Fallback to raw content
            const raw = (log as any).raw || {};
            if (field === "dest_ip") {
                v = asString(
                    raw.dest ??
                        raw.destination ??
                        raw.dst_ip ??
                        raw.destinationIp ??
                        raw.destination_ip ??
                        raw.destinationAddress ??
                        raw?.destination?.ip ??
                        raw?.target?.ip
                );
            } else if (field === "src_ip") {
                v = asString(
                    raw.src_ip ??
                        raw.ipAddress ??
                        raw.source_ip ??
                        raw.client_ip ??
                        raw.ip ??
                        raw.sourceIp ??
                        raw?.source?.ip
                );
            } else if (field === "timestamp") {
                v = asString(
                    raw.timestamp ??
                        raw["@timestamp"] ??
                        raw.time ??
                        raw.date ??
                        (log as any).timestamp
                );
            } else if (field === "app" || field === "app_type") {
                v = asString(
                    raw.app ??
                        raw.appDisplayName ??
                        raw.resourceDisplayName ??
                        raw.application ??
                        raw?.service?.name
                );
            } else if (field === "event_type") {
                v = asString(
                    raw.event_type ??
                        raw.evt_type ??
                        raw.eventtype ??
                        raw.eventType ??
                        raw.operationName ??
                        raw.type
                );
            } else if (field === "user") {
                v = asString(raw.user ?? raw.userPrincipalName);
            } else if (field === "status") {
                const st = raw.status;
                if (typeof st === "string" || typeof st === "number" || typeof st === "boolean") {
                    v = asString(st);
                } else if (st && typeof st === "object") {
                    v = asString(
                        (st as any).failureReason ??
                            (st as any).message ??
                            (st as any).state ??
                            (st as any).code ??
                            JSON.stringify(st)
                    );
                }
                if (!v || v.trim() === "") {
                    v = asString(raw.outcome ?? raw.result ?? raw?.event?.outcome);
                }
            } else if (field in raw) {
                v = asString(raw[field]);
            }
        }
        return (v || "").trim();
    };

    // Measure once at mount
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setDimensions({
            width: r.width || 800,
            height: r.height || 600,
        });
    }, []);

    // Keep a live ref of dimensions for use in simulation tick
    useEffect(() => {
        dimsRef.current = dimensions;
    }, [dimensions]);

    // Keep the simulation centered after container resizes
    useEffect(() => {
        if (!simulation) return;
        const { width, height } = dimensions;
        simulation
            .force("center", d3.forceCenter<SimulationNode>(width / 2, height / 2))
            .force("x", d3.forceX<SimulationNode>(width / 2).strength(centerStrength))
            .force("y", d3.forceY<SimulationNode>(height / 2).strength(centerStrength));
        simulation.alpha(0.2).restart();
    }, [dimensions.width, dimensions.height, simulation, centerStrength]);

    useEffect(() => {
        const handle = () => {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            setDimensions({
                width: rect.width,
                height: rect.height,
            });
        };

        window.addEventListener("resize", handle);
        return () => window.removeEventListener("resize", handle);
    }, []);

    useEffect(() => {
        const id = setInterval(() => {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();

            if (rect.width !== dimsRef.current.width || rect.height !== dimsRef.current.height) {
                setDimensions({ width: rect.width, height: rect.height });
            }
        }, 150);

        return () => clearInterval(id);
    }, []);

    // Also update the SVG's width/height attributes to the latest dimensions
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        el.setAttribute("width", String(dimensions.width));
        el.setAttribute("height", String(dimensions.height));
    }, [dimensions.width, dimensions.height]);

    // Observe container size changes (both width and height) to react to sidebar and vertical resizes
    useEffect(() => {
        const target = containerRef.current;
        if (!target) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const cr = entry.contentRect;
                setDimensions({ width: cr.width || 800, height: cr.height || 600 });
            }
        });
        ro.observe(target);
        return () => ro.disconnect();
    }, []);

    // Build nodes (one per log) + links (based on selected relationship rule)
    useEffect(() => {
        if (!logs || logs.length === 0) {
            setNodes([]);
            setLinks([]);
            return;
        }

        try {
            // 1) Create one node per log (even if it becomes an orphan)
            const newNodes: NodeData[] = logs.map((log, idx) => {
                // Build a dataset-scoped unique node id to avoid collisions across datasets
                const datasetKey = String(log.datasetId ?? log.datasetName ?? "unknown");
                const localId = String(log.id ?? idx);
                const uniqueId = `${datasetKey}:${localId}`;

                return {
                    id: uniqueId,
                    type: log.type || "unknown",
                    value:
                        (log.app || log.appDisplayName || "") &&
                        (log.event_type || (log as any).evt_type)
                            ? `${log.app || log.appDisplayName} ${(log.event_type || (log as any).evt_type) as string}`
                            : log.message || log.id || `log-${idx}`,
                    // Use dataset id string as the grouping key for shapes; fallback to name or 'unknown'
                    dataset: datasetKey,
                    details: log,
                };
            });

            // 2) Build links based on relationship rules
            const idAt = (i: number) => newNodes[i].id;
            const addPair = (a: number, b: number, addTo: Set<string>, out: LinkData[]) => {
                if (a === b) return;
                const ida = idAt(a);
                const idb = idAt(b);
                const key = ida < idb ? `${ida}|${idb}` : `${idb}|${ida}`;
                if (!addTo.has(key)) {
                    addTo.add(key);
                    out.push({ source: ida, target: idb, type: selectedRelationship });
                }
            };

            const linkSet = new Set<string>();
            const linksOut: LinkData[] = [];

            // Group logs by a robust field value (using normalized + raw fallbacks)
            const byField = (field: string) => {
                const map = new Map<string, number[]>();
                logs.forEach((l, i) => {
                    const rawKey = valueFromLog(l, field);
                    const k = (rawKey || "").toString().trim();
                    if (!k) return;
                    if (!map.has(k)) map.set(k, []);
                    map.get(k)!.push(i);
                });
                return map;
            };
            const byGetter = (getter: (l: Log) => string | undefined) => {
                const map = new Map<string, number[]>();
                logs.forEach((l, i) => {
                    const k = (getter(l) || "").toString().trim();
                    if (!k) return;
                    if (!map.has(k)) map.set(k, []);
                    map.get(k)!.push(i);
                });
                return map;
            };

            // Deterministic center selector for star topology: hash group key + length
            const hashString = (s: string) => {
                let h = 0;
                for (let i = 0; i < s.length; i++) {
                    h = (h * 31 + s.charCodeAt(i)) >>> 0;
                }
                return h;
            };
            const pickCenterIndex = (indices: number[], groupKey: string) => {
                if (indices.length === 0) return -1;
                const h = hashString(groupKey);
                return indices[h % indices.length];
            };

            if (selectedRelationship === RelationshipTypes.IP_CONNECTION) {
                // Request/Response linking STRICTLY by flow_id (exact match) AND per-dataset.
                // Build composite groups: `${dataset}|${flow_id}` so flows never cross datasets.
                const flows = new Map<string, number[]>();
                logs.forEach((l, i) => {
                    const flow = valueFromLog(l, "flow_id");
                    const kFlow = (flow || "").toString().trim();
                    if (!kFlow) return; // require explicit flow_id
                    const datasetKey = String(
                        (l as any).datasetId ?? (l as any).datasetName ?? "unknown"
                    ).trim();
                    const key = `${datasetKey}|${kFlow}`;
                    if (!flows.has(key)) flows.set(key, []);
                    flows.get(key)!.push(i);
                });

                // Helper to compute ordering within a flow
                const getSeq = (l: Log): number | undefined => {
                    const direct = (l as any).flow_seq;
                    const fromVal = direct ?? valueFromLog(l, "flow_seq");
                    const n = Number(fromVal);
                    return Number.isFinite(n) ? n : undefined;
                };
                const getTsNum = (l: Log): number => {
                    const ts = getLogTimestamp(l);
                    const t = ts ? Date.parse(ts) : NaN;
                    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
                };

                flows.forEach((idxs, flowKey) => {
                    if (idxs.length < 2) return; // cannot form a pair
                    const sorted = [...idxs].sort((a, b) => {
                        const la = logs[a];
                        const lb = logs[b];
                        const sa = getSeq(la);
                        const sb = getSeq(lb);
                        if (sa != null && sb != null && sa !== sb) return sa - sb;
                        if (sa != null && sb == null) return -1; // sequence has priority
                        if (sa == null && sb != null) return 1;
                        // fallback to timestamp order
                        return getTsNum(la) - getTsNum(lb);
                    });
                    for (let i = 0; i < sorted.length - 1; i++) {
                        addPair(sorted[i], sorted[i + 1], linkSet, linksOut);
                    }
                });
            } else if (selectedRelationship === RelationshipTypes.USER_EVENT) {
                const groups = byField("user");
                groups.forEach((idxs, key) => {
                    if (idxs.length > 6) {
                        const centerIdx = pickCenterIndex(idxs, key);
                        if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
                        idxs.forEach((other) => {
                            if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut);
                        });
                    } else {
                        for (let a = 0; a < idxs.length; a++) {
                            for (let b = a + 1; b < idxs.length; b++)
                                addPair(idxs[a], idxs[b], linkSet, linksOut);
                        }
                    }
                });
            } else if (selectedRelationship === RelationshipTypes.APP_EVENT) {
                // Connect logs that share the same application
                const groups = byField("app");
                groups.forEach((idxs, key) => {
                    if (idxs.length > 6) {
                        const centerIdx = pickCenterIndex(idxs, key);
                        if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
                        idxs.forEach((other) => {
                            if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut);
                        });
                    } else {
                        for (let a = 0; a < idxs.length; a++) {
                            for (let b = a + 1; b < idxs.length; b++)
                                addPair(idxs[a], idxs[b], linkSet, linksOut);
                        }
                    }
                });
            } else if (selectedRelationship === RelationshipTypes.HOST_EVENT) {
                const groups = byField("host");
                groups.forEach((idxs, key) => {
                    if (idxs.length > 6) {
                        const centerIdx = pickCenterIndex(idxs, key);
                        if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
                        idxs.forEach((other) => {
                            if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut);
                        });
                    } else {
                        for (let a = 0; a < idxs.length; a++) {
                            for (let b = a + 1; b < idxs.length; b++)
                                addPair(idxs[a], idxs[b], linkSet, linksOut);
                        }
                    }
                });
            } else if (selectedRelationship === RelationshipTypes.SEVERITY_LEVEL) {
                // Connect all logs that share the same severity (complete linkage)
                const groups = byField("severity");
                groups.forEach((idxs, key) => {
                    if (idxs.length > 6) {
                        const centerIdx = pickCenterIndex(idxs, key);
                        if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
                        idxs.forEach((other) => {
                            if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut);
                        });
                    } else {
                        for (let a = 0; a < idxs.length; a++) {
                            for (let b = a + 1; b < idxs.length; b++)
                                addPair(idxs[a], idxs[b], linkSet, linksOut);
                        }
                    }
                });
            }

            setNodes(newNodes);
            setLinks(linksOut);
            setInitialized(false);
        } catch (e) {
            console.error("Error processing logs:", e);
            setNodes([]);
            setLinks([]);
        }
    }, [logs, selectedRelationship]);

    useLayoutEffect(() => {
        if (!isReady || nodes.length === 0) {
            return;
        }

        let raf1 = 0;
        let raf2 = 0;
        let cleanup: (() => void) | undefined;

        const tryInit = () => {
            const el = svgRef.current;
            if (!el) {
                raf2 = requestAnimationFrame(tryInit);
                return;
            }

            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                raf2 = requestAnimationFrame(tryInit);
                return;
            }

            const width = rect.width;
            const height = rect.height;
            setDimensions({ width, height });

            try {
                const svg = d3.select(el);
                svg.selectAll("*").remove();
                svg.attr("width", width).attr("height", height);

                const g = svg.append("g");

                // Create tooltip inside the outer container (with relative positioning)
                const containerEl = containerRef.current || (el.parentElement as HTMLElement);
                const container = d3.select(containerEl);
                const tooltip = container
                    .append("div")
                    .attr("class", "absolute pointer-events-none opacity-0 z-50")
                    .style("position", "absolute")
                    .style("z-index", "10")
                    .style("max-width", "320px")
                    .style("overflow", "hidden");

                // Helper: place tooltip tightly next to a point (x,y) with smart side-switching
                const placeTooltip = (x: number, y: number) => {
                    const cRect = (container.node() as HTMLElement).getBoundingClientRect();
                    const tip = tooltip.node() as HTMLElement;
                    const tipRect = tip.getBoundingClientRect();
                    const gap = 10;
                    // Prefer right-middle of the anchor
                    let left = x + gap;
                    let top = y - tipRect.height / 2;
                    // If it would overflow on the right, flip to the left side of the anchor
                    if (left + tipRect.width + 4 > cRect.width) {
                        left = x - tipRect.width - gap;
                    }
                    // Clamp inside container
                    left = Math.max(0, Math.min(cRect.width - tipRect.width - 4, left));
                    top = Math.max(0, Math.min(cRect.height - tipRect.height - 4, top));
                    tooltip.style("left", left + "px").style("top", top + "px");
                };

                const baseRadius = 8; // visual radius for regular nodes
                const centerRadius = 14; // larger radius for star-center nodes

                const newSimulation = d3
                    .forceSimulation<SimulationNode>(nodes)
                    .force(
                        "link",
                        d3
                            .forceLink<SimulationNode, SimulationLink>(links)
                            .id((d) => d.id)
                            .distance(linkDistance)
                            .strength(linkStrength)
                    )
                    .force("charge", d3.forceManyBody<SimulationNode>().strength(repelStrength))
                    .force(
                        "collide",
                        d3
                            .forceCollide<SimulationNode>()
                            .radius((d: any) => (d.isStarCenter ? centerRadius : baseRadius) * 1.5)
                            .iterations(1)
                    )
                    .force("x", d3.forceX<SimulationNode>(width / 2).strength(centerStrength))
                    .force("y", d3.forceY<SimulationNode>(height / 2).strength(centerStrength))
                    .force(
                        "center",
                        d3.forceCenter<SimulationNode>(width / 2, height / 2)
                    ) as Simulation;

                setSimulation(newSimulation);

                const link = g
                    .append("g")
                    .attr("class", "links")
                    .selectAll("line")
                    .data(links)
                    .join("line")
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2)
                    .attr("stroke-opacity", 0.6)
                    .style("pointer-events", "stroke")
                    .style("cursor", "help")
                    .on("mouseover", function (_event: MouseEvent, d: any) {
                        d3.select(this).attr("stroke-opacity", 0.95).attr("stroke-width", 3);
                        tooltip.transition().duration(150).style("opacity", 0.9);
                        const s: any = d.source; // simulation node
                        const t: any = d.target;
                        // Choose values based on relationship type
                        let srcVal = s?.value || s?.id || "";
                        let tgtVal = t?.value || t?.id || "";
                        let extraRow = "";

                        const sLog = (s?.details || {}) as Log;
                        const tLog = (t?.details || {}) as Log;
                        switch (selectedRelationship) {
                            case RelationshipTypes.USER_EVENT: {
                                const su = valueFromLog(sLog, "user");
                                const tu = valueFromLog(tLog, "user");
                                srcVal = su || srcVal;
                                tgtVal = tu || tgtVal;
                                break;
                            }
                            case RelationshipTypes.IP_CONNECTION: {
                                // Request/Response: show endpoints plus flow metadata
                                // For IP connections, take source/target IPs from the REQUEST event specifically
                                const dirOf = (l: Log) =>
                                    (valueFromLog(l, "direction") || "").toLowerCase();
                                const isRequest = (l: Log) => {
                                    const d = dirOf(l);
                                    return d === "request" || d === "req" || d.includes("request");
                                };
                                let reqLog: Log | undefined = isRequest(sLog)
                                    ? sLog
                                    : isRequest(tLog)
                                      ? tLog
                                      : undefined;
                                if (!reqLog) {
                                    // Fallback: use smaller flow_seq as request
                                    const sa = Number(valueFromLog(sLog, "flow_seq"));
                                    const sb = Number(valueFromLog(tLog, "flow_seq"));
                                    if (Number.isFinite(sa) && Number.isFinite(sb)) {
                                        reqLog = sa <= sb ? sLog : tLog;
                                    }
                                }
                                if (!reqLog) reqLog = sLog; // final fallback

                                const reqSrcIp =
                                    valueFromLog(reqLog, "src_ip") || valueFromLog(reqLog, "ip");
                                const reqDstIp =
                                    valueFromLog(reqLog, "dest_ip") ||
                                    valueFromLog(reqLog, "destination");
                                srcVal = reqSrcIp || srcVal;
                                tgtVal = reqDstIp || tgtVal;

                                const flowId =
                                    valueFromLog(sLog, "flow_id") || valueFromLog(tLog, "flow_id");
                                const sDir = valueFromLog(sLog, "direction");
                                const tDir = valueFromLog(tLog, "direction");
                                const arrow = sDir && tDir ? `${sDir} → ${tDir}` : "";
                                const seqInfo = (() => {
                                    const sa = valueFromLog(sLog, "flow_seq");
                                    const sb = valueFromLog(tLog, "flow_seq");
                                    return sa && sb ? `seq ${sa} → ${sb}` : "";
                                })();
                                const parts = [
                                    flowId
                                        ? `<div><span class=\"text-neutral-400\">flow_id:</span> ${flowId}</div>`
                                        : "",
                                    arrow
                                        ? `<div><span class=\"text-neutral-400\">direction:</span> ${arrow}</div>`
                                        : "",
                                    seqInfo
                                        ? `<div><span class=\"text-neutral-400\">order:</span> ${seqInfo}</div>`
                                        : "",
                                ].filter(Boolean);
                                extraRow = parts.join("");
                                break;
                            }
                            case RelationshipTypes.APP_EVENT: {
                                const sapp = valueFromLog(sLog, "app");
                                const tapp = valueFromLog(tLog, "app");
                                srcVal = sapp || srcVal;
                                tgtVal = tapp || tgtVal;
                                break;
                            }
                            case RelationshipTypes.HOST_EVENT: {
                                const shost = valueFromLog(sLog, "host");
                                const thost = valueFromLog(tLog, "host");
                                srcVal = shost || srcVal;
                                tgtVal = thost || tgtVal;
                                break;
                            }
                            case RelationshipTypes.SEVERITY_LEVEL: {
                                const ssev = valueFromLog(sLog, "severity");
                                const tsev = valueFromLog(tLog, "severity");
                                srcVal = ssev || srcVal;
                                tgtVal = tsev || tgtVal;
                                break;
                            }
                        }
                        const rel =
                            selectedRelationship === RelationshipTypes.APP_EVENT
                                ? "APP TYPE"
                                : d.type || "link";
                        tooltip
                            .html(
                                `
              <div class="bg-neutral-800 p-2 rounded text-xs space-y-0.5">
                <div><span class="text-neutral-400">relationship:</span> ${rel}</div>
                <div><span class="text-neutral-400">source:</span> ${srcVal}</div>
                <div><span class="text-neutral-400">target:</span> ${tgtVal}</div>
                ${extraRow}
              </div>
            `
                            )
                            .call(() => {
                                // Position at midpoint of link using simulation coordinates
                                const midX = (s?.x + t?.x) / 2;
                                const midY = (s?.y + t?.y) / 2;
                                placeTooltip(midX, midY);
                            });
                    })
                    .on("mousemove", function (event: MouseEvent, d: any) {
                        // Re-align in case simulation moved slightly during drag/tick
                        const s: any = d.source;
                        const t: any = d.target;
                        const midX = (s?.x + t?.x) / 2;
                        const midY = (s?.y + t?.y) / 2;
                        placeTooltip(midX, midY);
                    })
                    .on("mouseout", function () {
                        d3.select(this).attr("stroke-opacity", 0.6).attr("stroke-width", 2);
                        tooltip.transition().duration(300).style("opacity", 0);
                    })
                    .on("click", function (_, d: any) {
                        onLinkClick?.(d);
                    });

                const node = g
                    .append("g")
                    .attr("class", "nodes")
                    .selectAll("g")
                    .data(nodes)
                    .join("g")
                    .call(drag(newSimulation) as any);

                const drawPolygon = (
                    elem: d3.Selection<SVGGElement, any, SVGGElement | null, unknown>,
                    sides: number,
                    radius: number,
                    fill: string
                ) => {
                    const pts: [number, number][] = [];
                    for (let i = 0; i < sides; i++) {
                        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
                        pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
                    }
                    const d = d3.line()(pts.concat([pts[0]]))!;
                    elem.append("path").attr("d", d).attr("fill", fill).attr("stroke", "none");
                };

                node.each(function (d: any) {
                    const shape =
                        shapes[d.dataset] ?? shapes["default"] ?? shapes["Default"] ?? "circle";
                    const element = d3.select(this);
                    const r = d.isStarCenter ? centerRadius : baseRadius;
                    // Compute color key based on selected criteria using robust parser
                    const det = (d.details || {}) as Log;
                    const colorKey = getCriteriaValue(det);
                    const nodeColor = (colorKey && colors[colorKey]) || "#999";

                    switch (shape) {
                        case "circle":
                            element.append("circle").attr("r", r).attr("fill", nodeColor);
                            break;
                        case "square":
                            element
                                .append("rect")
                                .attr("x", -r)
                                .attr("y", -r)
                                .attr("width", r * 2)
                                .attr("height", r * 2)
                                .attr("fill", nodeColor);
                            break;
                        case "triangle":
                            element
                                .append("path")
                                .attr(
                                    "d",
                                    d3
                                        .symbol()
                                        .type(d3.symbolTriangle)
                                        .size(100 * (r / baseRadius) ** 2) as any
                                )
                                .attr("fill", nodeColor);
                            break;
                        case "diamond":
                            element
                                .append("path")
                                .attr(
                                    "d",
                                    d3
                                        .symbol()
                                        .type(d3.symbolDiamond)
                                        .size(100 * (r / baseRadius) ** 2) as any
                                )
                                .attr("fill", nodeColor);
                            break;
                        case "pentagon":
                            drawPolygon(element as any, 5, r, nodeColor);
                            break;
                        default:
                            element.append("circle").attr("r", r).attr("fill", nodeColor);
                            break;
                    }
                });

                node.on("mouseover", function (_event, d: any) {
                    d3.select(this)
                        .select("circle, rect, path")
                        .transition()
                        .duration(200)
                        .attr("transform", "scale(1.2)");

                    tooltip.transition().duration(200).style("opacity", 0.9);
                    const log = (d.details || {}) as Log;
                    const evtTypeRaw = valueFromLog(log, "event_type");
                    const evtType = evtTypeRaw || "n/a";
                    const ts = getLogTimestamp(log) || valueFromLog(log, "timestamp") || "n/a";
                    const formatEvt = (raw: string) => {
                        if (!raw) return "";
                        const cleaned = raw.trim();
                        const commaParts = cleaned
                            .split(",")
                            .map((p: string) => p.trim())
                            .filter(Boolean);
                        const lastComma = commaParts.length
                            ? commaParts[commaParts.length - 1]
                            : cleaned;
                        const dotParts = lastComma.split(".").filter(Boolean);
                        const core = dotParts.length ? dotParts[dotParts.length - 1] : lastComma;
                        return core
                            .replace(/_/g, " ")
                            .split(/\s+/)
                            .map((w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w))
                            .join(" ");
                    };
                    const appVal = valueFromLog(log, "app") || "n/a";
                    const dispName = `${appVal}${evtType ? " " + formatEvt(evtType) : ""}`;
                    const srcIp = valueFromLog(log, "src_ip") || "n/a";
                    const destIp = valueFromLog(log, "dest_ip") || "n/a";
                    const user = valueFromLog(log, "user") || "n/a";
                    const severity = valueFromLog(log, "severity") || "";
                    const app = appVal;
                    const dest_port = valueFromLog(log, "dest_port") || "n/a";
                    const src_port = valueFromLog(log, "src_port") || "n/a";
                    const status =
                        valueFromLog(log, "status") || valueFromLog(log, "outcome") || "n/a";
                    const direction = valueFromLog(log, "direction") || "n/a";
                    const flow_id = valueFromLog(log, "flow_id") || "n/a";
                    const flow_seq = valueFromLog(log, "flow_seq") || "";
                    const host = valueFromLog(log, "host") || "n/a";
                    const latency_ms = valueFromLog(log, "latency_ms") || "";
                    tooltip
                        .html(
                            `
              <div class="bg-neutral-800 p-2 rounded text-xs space-y-0.5">
                <div><span class="text-neutral-400">id:</span> ${log.id || d.id}</div>
                <div><span class="text-neutral-400">message:</span> ${dispName}</div>
                <div><span class="text-neutral-400">type:</span> ${log.type || "n/a"}</div>
                <div><span class="text-neutral-400">timestamp:</span> ${ts}</div>
                <div><span class="text-neutral-400">src_ip:</span> ${srcIp}</div>
                <div><span class="text-neutral-400">dest_ip:</span> ${destIp}</div>
                <div><span class="text-neutral-400">user:</span> ${user}</div>
                <div><span class="text-neutral-400">event_type:</span> ${evtType}</div>
                <div><span class="text-neutral-400">severity:</span> ${severity}</div>
                <div><span class="text-neutral-400">app:</span> ${app}</div>
                <div><span class="text-neutral-400">dest_port:</span> ${dest_port}</div>
                <div><span class="text-neutral-400">src_port:</span> ${src_port}</div>
                <div><span class="text-neutral-400">status:</span> ${status}</div>
                <div><span class="text-neutral-400">host:</span> ${host}</div>
                <div><span class="text-neutral-400">direction:</span> ${direction}</div>
                <div><span class="text-neutral-400">flow_id:</span> ${flow_id}</div>
                ${flow_seq ? `<div><span class=\"text-neutral-400\">flow_seq:</span> ${flow_seq}</div>` : ""}
              </div>
            `
                        )
                        .call(() => {
                            // Use node coordinates (d.x, d.y)
                            const nx = d.x ?? 0;
                            const ny = d.y ?? 0;
                            placeTooltip(nx, ny);
                        });
                })
                    .on("mousemove", function (event: MouseEvent, d: any) {
                        // keep tooltip anchored to node while dragging or simulation moves
                        const nx = d?.x ?? 0;
                        const ny = d?.y ?? 0;
                        placeTooltip(nx, ny);
                    })
                    .on("mouseout", function () {
                        d3.select(this)
                            .select("circle, rect, path")
                            .transition()
                            .duration(200)
                            .attr("transform", "scale(1)");
                        tooltip.transition().duration(500).style("opacity", 0);
                    })
                    .on("click", function (_, d: any) {
                        onNodeClick?.(d);
                    });

                newSimulation.on("tick", () => {
                    // Keep nodes inside the viewport bounds
                    const { width: curW, height: curH } = dimsRef.current;
                    let kicked = false;
                    nodes.forEach((nd: any) => {
                        if (nd.x == null || nd.y == null) return;
                        const rr = nd.isStarCenter ? centerRadius : baseRadius;

                        const beforeX = nd.x;
                        const beforeY = nd.y;

                        nd.x = Math.max(rr, Math.min(curW - rr, nd.x));
                        nd.y = Math.max(rr, Math.min(curH - rr, nd.y));

                        if (beforeX !== nd.x || beforeY !== nd.y) kicked = true;
                    });

                    if (kicked) newSimulation.alpha(0.3);

                    link.attr("x1", (d: any) => d.source.x)
                        .attr("y1", (d: any) => d.source.y)
                        .attr("x2", (d: any) => d.target.x)
                        .attr("y2", (d: any) => d.target.y);

                    node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
                });

                setInitialized(true);

                cleanup = () => {
                    newSimulation.stop();
                    setInitialized(false);
                };
            } catch (err) {
                console.error("Error initializing graph:", err);
                setError("Failed to initialize graph visualization");
                setInitialized(false);
            }
        };

        raf1 = requestAnimationFrame(tryInit);

        return () => {
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
            if (cleanup) cleanup();
        };
        // Only re-run when "ready" state flips or counts of nodes/links change
    }, [isReady, nodes.length, links.length]);

    // Apply force parameter updates without tearing down the simulation
    useEffect(() => {
        if (!isReady || !simulation) return;
        // Update link force
        const linkF = simulation.force("link") as
            | d3.ForceLink<SimulationNode, SimulationLink>
            | undefined;
        if (linkF) {
            linkF.distance(linkDistance).strength(linkStrength);
        }
        // Update repel force
        const chargeF = simulation.force("charge") as d3.ForceManyBody<SimulationNode> | undefined;
        if (chargeF) {
            chargeF.strength(repelStrength);
        }
        // Update x/y centering forces
        const xF = simulation.force("x") as d3.ForceX<SimulationNode> | undefined;
        const yF = simulation.force("y") as d3.ForceY<SimulationNode> | undefined;
        if (xF) xF.strength(centerStrength);
        if (yF) yF.strength(centerStrength);
        simulation.alpha(0.3).restart();
    }, [isReady, simulation, centerStrength, repelStrength, linkStrength, linkDistance]);

    // Dynamic color update without tearing down simulation
    useEffect(() => {
        if (!isReady || nodes.length === 0) return;
        const el = svgRef.current;
        if (!el) return;
        const svg = d3.select(el);
        svg.selectAll("g.nodes > g").each(function (d: any) {
            const det = (d.details || {}) as Log;
            const colorKey = getCriteriaValue(det);
            const nodeColor = (colorKey && colors[colorKey]) || "#999";
            d3.select(this).select("circle").attr("fill", nodeColor);
            d3.select(this).select("rect").attr("fill", nodeColor);
            d3.select(this).select("path").attr("fill", nodeColor);
        });
    }, [colors, colorCriteria, isReady, nodes.length]);

    // Drag
    const drag = (sim: Simulation) => {
        function dragstarted(event: DragEvent) {
            if (!event.active) sim.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event: DragEvent) {
            // Clamp dragged position within bounds
            const el = svgRef.current;
            if (el) {
                const r = el.getBoundingClientRect();
                const w = r.width || 800;
                const h = r.height || 600;
                const clampX = Math.max(12, Math.min(w - 12, event.x));
                const clampY = Math.max(12, Math.min(h - 12, event.y));
                event.subject.fx = clampX;
                event.subject.fy = clampY;
            } else {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }
        }
        function dragended(event: DragEvent) {
            if (!event.active) sim.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    };

    // ---------- Render ----------
    if (!logs || logs.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 min-h-0">
                Select datasets on the Analytics page to visualize relationships
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center text-red-400 min-h-0">
                {error}
            </div>
        );
    }

    if (nodes.length === 0 && logs.length > 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 min-h-0">
                Processing {logs.length} logs...
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full relative min-h-0">
            <div className="w-full h-full">
                <svg ref={svgRef} className="w-full h-full bg-neutral-900" />
            </div>
            {!isReady && nodes.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/70 backdrop-blur-sm">
                    <button
                        onClick={() => {
                            const el = svgRef.current;
                            if (el) {
                                const r = el.getBoundingClientRect();
                                if (r.width === 0 || r.height === 0) {
                                    console.warn(
                                        "SVG has zero size; parent might be collapsed/height=0"
                                    );
                                }
                                setIsReady(true);
                            } else {
                                console.error("SVG ref not available");
                            }
                        }}
                        className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition-colors shadow"
                    >
                        Initialize Graph ({nodes.length} nodes / {links.length} links)
                    </button>
                </div>
            )}
            {isReady && !initialized && (
                <div className="absolute top-2 left-2 px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-300 animate-pulse">
                    Initializing force simulation...
                </div>
            )}
        </div>
    );
};

export default ObsidianGraph;
