import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import { Log, NodeData, LinkData, RelationshipTypes } from '../../types/types';
import { getLogField } from '@/lib/utils';

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
  colorCriteria?: 'event_type' | 'severity' | 'app_type' | 'src_ip' | 'dest_ip';
  // Physics controls
  centerStrength?: number; // strength for x/y centering forces
  repelStrength?: number; // many-body negative strength
  linkStrength?: number;  // link force strength [0..1]
  linkDistance?: number;  // link preferred distance in px
  onNodeClick?: (node: NodeData) => void;
  onLinkClick?: (link: LinkData) => void;
}

const ObsidianGraph = ({
  logs,
  selectedRelationship,
  colors,
  shapes,
  colorCriteria = 'event_type',
  centerStrength = 0.05,
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
    const field = colorCriteria === 'app_type' ? 'app' : colorCriteria;
    let value = getLogField(log, field);
    // Fallbacks for older or raw shapes
    if (!value) {
      if (field === 'event_type') {
        value = log.event_type || log.type || '';
      } else if (field === 'src_ip') {
        value = log.src_ip || log.ipAddress || '';
      } else if (field === 'dest_ip') {
        value = log.dest_ip || (log as any).dest || '';
      } else if (field === 'app') {
        value = log.app || log.appDisplayName || (log as any).resourceDisplayName || '';
      }
      // As a last resort, try raw field if present
      if (!value && log.raw && typeof log.raw[field] !== 'undefined') {
        const rawVal = log.raw[field];
        if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') {
          value = String(rawVal);
        }
      }
    }
    return value || '';
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
      .force('center', d3.forceCenter<SimulationNode>(width / 2, height / 2))
      .force('x', d3.forceX<SimulationNode>(width / 2).strength(centerStrength))
      .force('y', d3.forceY<SimulationNode>(height / 2).strength(centerStrength));
    simulation.alpha(0.2).restart();
  }, [dimensions.width, dimensions.height, simulation, centerStrength]);

    useEffect(() => {
    const handle = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: rect.height
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

      if (rect.width !== dimsRef.current.width ||
          rect.height !== dimsRef.current.height) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    }, 150); // small polling

    return () => clearInterval(id);
  }, []);


  // Also update the SVG's width/height attributes to the latest dimensions
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.setAttribute('width', String(dimensions.width));
    el.setAttribute('height', String(dimensions.height));
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
      const newNodes: NodeData[] = logs.map((log, idx) => ({
        id: String(log.id ?? `log-${idx}`),
        type: log.type || 'unknown',
        value:
          (log.app || log.appDisplayName || '') && (log.event_type || (log as any).evt_type)
            ? `${log.app || log.appDisplayName} ${(log.event_type || (log as any).evt_type) as string}`
            : (log.message || log.id || `log-${idx}`),
        // Use dataset id string as the grouping key for shapes; fallback to name or 'unknown'
        dataset: String(log.datasetId ?? log.datasetName ?? 'unknown'),
        details: log,
      }));

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

      const by = (getter: (l: Log) => string | undefined) => {
        const map = new Map<string, number[]>();
        logs.forEach((l, i) => {
          const k = getter(l);
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
        const bySrc = by((l) => l.src_ip);
        const byDst = by((l) => l.dest_ip || (l as any).dest);
        // For any IP that appears as a src in some logs and as a dest in others, connect cross-pairs
        const ips = new Set<string>([...bySrc.keys(), ...byDst.keys()]);
        ips.forEach((ip) => {
          const srcIdxs = bySrc.get(ip) || [];
          const dstIdxs = byDst.get(ip) || [];
          for (const i of srcIdxs) {
            for (const j of dstIdxs) addPair(i, j, linkSet, linksOut);
          }
          // vice versa is naturally covered by cross-product above
        });
      } else if (selectedRelationship === RelationshipTypes.USER_EVENT) {
        const groups = by((l) => l.user || (l as any).userPrincipalName);
        groups.forEach((idxs, key) => {
          if (idxs.length > 6) {
            const centerIdx = pickCenterIndex(idxs, key);
            if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
            idxs.forEach((other) => { if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut); });
          } else {
            for (let a = 0; a < idxs.length; a++) {
              for (let b = a + 1; b < idxs.length; b++) addPair(idxs[a], idxs[b], linkSet, linksOut);
            }
          }
        });
      } else if (selectedRelationship === RelationshipTypes.APP_EVENT) {
        const groups = by((l) => (l.event_type || (l as any).evt_type || (l as any).eventtype) as string | undefined);
        groups.forEach((idxs, key) => {
          if (idxs.length > 6) {
            const centerIdx = pickCenterIndex(idxs, key);
            if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
            idxs.forEach((other) => { if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut); });
          } else {
            for (let a = 0; a < idxs.length; a++) {
              for (let b = a + 1; b < idxs.length; b++) addPair(idxs[a], idxs[b], linkSet, linksOut);
            }
          }
        });
      } else if (selectedRelationship === RelationshipTypes.HOST_EVENT) {
        const groups = by((l) => l.host);
        groups.forEach((idxs, key) => {
          if (idxs.length > 6) {
            const centerIdx = pickCenterIndex(idxs, key);
            if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
            idxs.forEach((other) => { if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut); });
          } else {
            for (let a = 0; a < idxs.length; a++) {
              for (let b = a + 1; b < idxs.length; b++) addPair(idxs[a], idxs[b], linkSet, linksOut);
            }
          }
        });
      } else if (selectedRelationship === RelationshipTypes.SEVERITY_LEVEL) {
        // Group strictly by severity string; if entirely absent, fall back to threatIndicator.
        const bySeverity = by((l) => l.severity);
        const sourceMap = bySeverity.size > 0 ? bySeverity : by((l) => (l as any).threatIndicator);
        sourceMap.forEach((idxs) => {
          // Star topology if large group
          if (idxs.length > 6) {
            const centerIdx = pickCenterIndex(idxs, 'severity');
            if (centerIdx >= 0) newNodes[centerIdx].isStarCenter = true;
            idxs.forEach((other) => {
              if (other !== centerIdx) addPair(centerIdx, other, linkSet, linksOut);
            });
          } else {
            for (let a = 0; a < idxs.length; a++) {
              for (let b = a + 1; b < idxs.length; b++) addPair(idxs[a], idxs[b], linkSet, linksOut);
            }
          }
        });
      }

      setNodes(newNodes);
      setLinks(linksOut);
      setInitialized(false); // new data, re-init soon
    } catch (e) {
      console.error('Error processing logs:', e);
      setNodes([]);
      setLinks([]);
    }
  }, [logs, selectedRelationship]);

  // ---- D3 init ----
  // 1) ---- D3 init ----
// CHANGE the dependency list: remove colors, shapes, onNodeClick, and links/nodes *objects*.
// Depend only on isReady and the *sizes* (length) of nodes/links.
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
      svg.selectAll('*').remove();
      svg.attr('width', width).attr('height', height);

  const g = svg.append('g');

      // Create tooltip inside the outer container (with relative positioning)
      const containerEl = containerRef.current || el.parentElement as HTMLElement;
      const container = d3.select(containerEl);
      const tooltip = container
        .append('div')
        .attr('class', 'absolute pointer-events-none opacity-0 z-50')
        .style('position', 'absolute')
        .style('z-index', '10')
        .style('max-width', '320px')
        .style('overflow', 'hidden');

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
        tooltip.style('left', left + 'px').style('top', top + 'px');
      };

      const baseRadius = 8; // visual radius for regular nodes
      const centerRadius = 14; // larger radius for star-center nodes

      const newSimulation = d3
        .forceSimulation<SimulationNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<SimulationNode, SimulationLink>(links)
            .id((d) => d.id)
            .distance(linkDistance)
            .strength(linkStrength)
        )
        .force('charge', d3.forceManyBody<SimulationNode>().strength(repelStrength))
        .force('collide', d3.forceCollide<SimulationNode>().radius((d: any) => ((d.isStarCenter ? centerRadius : baseRadius) * 1.5)).iterations(1))
        .force('x', d3.forceX<SimulationNode>(width / 2).strength(centerStrength))
        .force('y', d3.forceY<SimulationNode>(height / 2).strength(centerStrength))
        .force('center', d3.forceCenter<SimulationNode>(width / 2, height / 2)) as Simulation;

      setSimulation(newSimulation);

      const link = g
        .append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#666')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .style('pointer-events', 'stroke')
        .style('cursor', 'help')
        .on('mouseover', function (_event: MouseEvent, d: any) {
          d3.select(this).attr('stroke-opacity', 0.95).attr('stroke-width', 3);
          tooltip.transition().duration(150).style('opacity', 0.9);
          const s: any = d.source; // simulation node
          const t: any = d.target;
          const srcVal = s?.value || s?.id || '';
          const tgtVal = t?.value || t?.id || '';
          const rel = d.type || 'link';
          tooltip
            .html(`
              <div class="bg-neutral-800 p-2 rounded text-xs space-y-0.5">
                <div><span class="text-neutral-400">relationship:</span> ${rel}</div>
                <div><span class="text-neutral-400">source:</span> ${srcVal}</div>
                <div><span class="text-neutral-400">target:</span> ${tgtVal}</div>
              </div>
            `)
            .call(() => {
              // Position at midpoint of link using simulation coordinates
              const midX = (s?.x + t?.x) / 2;
              const midY = (s?.y + t?.y) / 2;
              placeTooltip(midX, midY);
            });
        })
        .on('mousemove', function (event: MouseEvent, d: any) {
          // Re-align in case simulation moved slightly during drag/tick
          const s: any = d.source;
          const t: any = d.target;
          const midX = (s?.x + t?.x) / 2;
          const midY = (s?.y + t?.y) / 2;
          placeTooltip(midX, midY);
        })
        .on('mouseout', function () {
          d3.select(this).attr('stroke-opacity', 0.6).attr('stroke-width', 2);
          tooltip.transition().duration(300).style('opacity', 0);
        })
        .on('click', function (_, d: any) {
          onLinkClick?.(d);
        });

      const node = g
        .append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .call(drag(newSimulation) as any);

      // Robust default for shape + pentagon helper (keep your existing shape code if you already added it)
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
        elem.append('path').attr('d', d).attr('fill', fill).attr('stroke', 'none');
      };

      node.each(function (d: any) {
        const shape =
          shapes[d.dataset] ?? shapes['default'] ?? shapes['Default'] ?? 'circle';
        const element = d3.select(this);
        const r = d.isStarCenter ? centerRadius : baseRadius;
        // Compute color key based on selected criteria using robust parser
        const det = (d.details || {}) as Log;
        const colorKey = getCriteriaValue(det);
        const nodeColor = (colorKey && colors[colorKey]) || '#999';

        switch (shape) {
          case 'circle':
            element.append('circle').attr('r', r).attr('fill', nodeColor);
            break;
          case 'square':
            element
              .append('rect')
              .attr('x', -r)
              .attr('y', -r)
              .attr('width', r * 2)
              .attr('height', r * 2)
              .attr('fill', nodeColor);
            break;
          case 'triangle':
            element
              .append('path')
              .attr('d', d3.symbol().type(d3.symbolTriangle).size(100 * (r / baseRadius) ** 2) as any)
              .attr('fill', nodeColor);
            break;
          case 'diamond':
            element
              .append('path')
              .attr('d', d3.symbol().type(d3.symbolDiamond).size(100 * (r / baseRadius) ** 2) as any)
              .attr('fill', nodeColor);
            break;
          case 'pentagon':
            drawPolygon(element as any, 5, r, nodeColor);
            break;
          default:
            element.append('circle').attr('r', r).attr('fill', nodeColor);
            break;
        }
      });

      node
        .on('mouseover', function (_event, d: any) {
          d3.select(this)
            .select('circle, rect, path')
            .transition()
            .duration(200)
            .attr('transform', 'scale(1.2)');

          tooltip.transition().duration(200).style('opacity', 0.9);
          const log = d.details || {};
          const evtTypeRaw = log.event_type || log.evt_type || log.eventtype || '';
          const evtType = evtTypeRaw || 'n/a';
          const ts = log.timestamp || log._time || log.createdDateTime || 'n/a';
          const formatEvt = (raw: string) => {
            if (!raw) return '';
            const cleaned = raw.trim();
            const commaParts = cleaned.split(',').map((p: string) => p.trim()).filter(Boolean);
            const lastComma = commaParts.length ? commaParts[commaParts.length - 1] : cleaned;
            const dotParts = lastComma.split('.').filter(Boolean);
            const core = dotParts.length ? dotParts[dotParts.length - 1] : lastComma;
            return core.replace(/_/g, ' ').split(/\s+/).map((w: string) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
          };
          const dispName = `${(log.app || log.appDisplayName || 'n/a')}${evtType ? ' ' + formatEvt(evtType) : ''}`;
          tooltip
            .html(`
              <div class="bg-neutral-800 p-2 rounded text-xs space-y-0.5">
                <div><span class="text-neutral-400">id:</span> ${log.id || d.id}</div>
                <div><span class="text-neutral-400">message:</span> ${dispName}</div>
                <div><span class="text-neutral-400">type:</span> ${log.type || 'n/a'}</div>
                <div><span class="text-neutral-400">timestamp:</span> ${ts}</div>
                <div><span class="text-neutral-400">src_ip:</span> ${log.src_ip || 'n/a'}</div>
                <div><span class="text-neutral-400">dest_ip:</span> ${log.dest_ip || log.dest || 'n/a'}</div>
                <div><span class="text-neutral-400">user:</span> ${log.user || log.userPrincipalName || 'n/a'}</div>
                <div><span class="text-neutral-400">event_type:</span> ${evtType}</div>
                <div><span class="text-neutral-400">severity:</span> ${log.severity || ''}</div>
                <div><span class="text-neutral-400">app:</span> ${log.app || log.appDisplayName || 'n/a'}</div>
                <div><span class="text-neutral-400">dest_port:</span> ${log.dest_port || 'n/a'}</div>
                <div><span class="text-neutral-400">src_port:</span> ${log.src_port || 'n/a'}</div>
                <div><span class="text-neutral-400">status:</span> ${log.status || 'n/a'}</div>
                <div><span class="text-neutral-400">host:</span> ${log.host || 'n/a'}</div>
              </div>
            `)
            .call(() => {
              // Use node coordinates (d.x, d.y)
              const nx = d.x ?? 0;
              const ny = d.y ?? 0;
              placeTooltip(nx, ny);
            });
        })
        .on('mousemove', function (event: MouseEvent, d: any) {
          // keep tooltip anchored to node while dragging or simulation moves
          const nx = d?.x ?? 0;
          const ny = d?.y ?? 0;
          placeTooltip(nx, ny);
        })
        .on('mouseout', function () {
          d3.select(this)
            .select('circle, rect, path')
            .transition()
            .duration(200)
            .attr('transform', 'scale(1)');
          tooltip.transition().duration(500).style('opacity', 0);
        })
        .on('click', function (_, d: any) {
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

        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });

      console.log('✅ D3 initialized — setting initialized=true');
      setInitialized(true);

      cleanup = () => {
        newSimulation.stop();
        console.log('🧹 D3 cleaned up');
        setInitialized(false);
      };
    } catch (err) {
      console.error('Error initializing graph:', err);
      setError('Failed to initialize graph visualization');
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
    const linkF = simulation.force('link') as d3.ForceLink<SimulationNode, SimulationLink> | undefined;
    if (linkF) {
      linkF.distance(linkDistance).strength(linkStrength);
    }
    // Update repel force
    const chargeF = simulation.force('charge') as d3.ForceManyBody<SimulationNode> | undefined;
    if (chargeF) {
      chargeF.strength(repelStrength);
    }
    // Update x/y centering forces
    const xF = simulation.force('x') as d3.ForceX<SimulationNode> | undefined;
    const yF = simulation.force('y') as d3.ForceY<SimulationNode> | undefined;
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
    svg.selectAll('g.nodes > g').each(function (d: any) {
      const det = (d.details || {}) as Log;
      const colorKey = getCriteriaValue(det);
      const nodeColor = (colorKey && colors[colorKey]) || '#999';
      d3.select(this).select('circle').attr('fill', nodeColor);
      d3.select(this).select('rect').attr('fill', nodeColor);
      d3.select(this).select('path').attr('fill', nodeColor); // covers triangle/diamond/pentagon
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
    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  };

  // Keep prior initialization unless the topology size changes; the D3 effect will
  // re-run on nodes/links length changes and handle cleanup/re-init there.

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

  // Note: don't early-return here; keep the SVG in the DOM so D3 can attach to it.

  // 3) Make sure the container has a real height (so layout never measures 0x0)
return (
  <div ref={containerRef} className="w-full h-full relative min-h-0">
    <div className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-neutral-900" />
    </div>
    {/* Overlay states */}
    {!isReady && nodes.length > 0 && (
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/70 backdrop-blur-sm">
        <button
          onClick={() => {
            const el = svgRef.current;
            if (el) {
              const r = el.getBoundingClientRect();
              console.log('Generate clicked; svg:', { w: r.width, h: r.height });
              if (r.width === 0 || r.height === 0) {
                console.warn('SVG has zero size; parent might be collapsed/height=0');
              }
              setIsReady(true);
            } else {
              console.error('SVG ref not available');
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
