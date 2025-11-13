import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Log } from "@/types/types";
import { getLogTimestamp } from "@/lib/utils";

type SeriesPoint = { date: Date; count: number };

interface ErrorGraphProps {
  logs: Log[];
}

function isHttpLog(log: Log): boolean {
  const raw: any = (log as any).raw || {};
  return raw.app === "HTTP-App" && typeof raw.http_status_code === "number";
}

function getHttpStatusCode(log: Log): number | undefined {
  const raw: any = (log as any).raw || {};
  const n = Number(raw.http_status_code);
  return Number.isFinite(n) ? n : undefined;
}

function floorToDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

interface Bucket {
  date: Date;
  total: number;
  perCode: Map<number, Log[]>;
}

// Basic mapping of HTTP status codes to reason phrase and broad category
function getHttpStatusInfo(code: number): { phrase: string; category: string } {
  // Common reason phrases
  const phrases: Record<number, string> = {
    100: "Continue",
    101: "Switching Protocols",
    102: "Processing",
    103: "Early Hints",
    200: "OK",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    207: "Multi-Status",
    208: "Already Reported",
    226: "IM Used",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    418: "I'm a teapot",
    421: "Misdirected Request",
    422: "Unprocessable Content",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    507: "Insufficient Storage",
    508: "Loop Detected",
    511: "Network Authentication Required",
  };

  let category = "Unknown";
  if (code >= 100 && code < 200) category = "Informational";
  else if (code >= 200 && code < 300) category = "Success";
  else if (code >= 300 && code < 400) category = "Redirection";
  else if (code >= 400 && code < 500) category = "Client Error";
  else if (code >= 500 && code < 600) category = "Server Error";

  const phrase = phrases[code] || category;
  return { phrase, category };
}

const ErrorGraph = ({ logs }: ErrorGraphProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 300 });

  // manual zoom factor (1 = fit, >1 = zoomed in)
  const [zoomLevel, setZoomLevel] = useState(1);

  // ---------- Aggregate logs ----------
  const {
    buckets,
    seriesByCode,
    maxCount,
    allCodes,
    totalCodes,
    codeTotals,
  } = useMemo(() => {
    const bucketMap = new Map<number, Bucket>(); // dayMs -> Bucket
    const allCodesSet = new Set<number>();
    let globalMax = 0;
    let totalAllCodes = 0;
    const perCodeTotals = new Map<number, number>();

    for (const log of logs || []) {
      if (!isHttpLog(log)) continue;
      const code = getHttpStatusCode(log);
      if (!Number.isFinite(code)) continue;
      if (code! < 100 || code! >= 600) continue;

      const ts =
        getLogTimestamp(log) ||
        (log as any).raw?.timestamp ||
        (log as any).raw?.time;
      if (!ts) continue;
      const t = Date.parse(ts);
      if (!Number.isFinite(t)) continue;

      const dayKey = floorToDay(new Date(t)).getTime();

      let bucket = bucketMap.get(dayKey);
      if (!bucket) {
        bucket = {
          date: new Date(dayKey),
          total: 0,
          perCode: new Map<number, Log[]>(),
        };
        bucketMap.set(dayKey, bucket);
      }

      bucket.total += 1;
      totalAllCodes += 1;
      allCodesSet.add(code!);

  // Track per-code totals
  perCodeTotals.set(code!, (perCodeTotals.get(code!) || 0) + 1);

      const arr = bucket.perCode.get(code!) || [];
      arr.push(log);
      bucket.perCode.set(code!, arr);
    }

    // Densify: make sure bucket for EVERY day between min & max
    const keys = Array.from(bucketMap.keys());
    if (keys.length === 0) {
      return {
        buckets: [],
        seriesByCode: new Map<number, SeriesPoint[]>(),
        maxCount: 0,
        allCodes: [],
        totalCodes: 0,
        codeTotals: new Map<number, number>(),
      };
    }

    const minDay = Math.min(...keys);
    const maxDay = Math.max(...keys);
    const ONE_DAY = 24 * 60 * 60 * 1000;

    for (let ms = minDay; ms <= maxDay; ms += ONE_DAY) {
      if (!bucketMap.has(ms)) {
        bucketMap.set(ms, {
          date: new Date(ms),
          total: 0,
          perCode: new Map<number, Log[]>(),
        });
      }
    }

    const bucketsSorted = Array.from(bucketMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // Compute global max from totals
    for (const bucket of bucketsSorted) {
      globalMax = Math.max(globalMax, bucket.total);
    }

    const codesArray = Array.from(allCodesSet).sort((a, b) => a - b);


    const byCode = new Map<number, SeriesPoint[]>();

    const jitterSpanMs = ONE_DAY * 0.6; // max spread is ±0.3 days around the center

    for (const code of codesArray) {
    const arr: SeriesPoint[] = [];

    const codeIndex = codesArray.indexOf(code);
    const centerIndex = (codesArray.length - 1) / 2;
    const jitterFraction =
        codesArray.length > 1
        ? (codeIndex - centerIndex) / (codesArray.length + 1)
        : 0;

    const jitterMs = jitterFraction * jitterSpanMs;

    for (const bucket of bucketsSorted) {
        const logsForCode = bucket.perCode.get(code);
        const baseTime = bucket.date.getTime();

        arr.push({
        date: new Date(baseTime + jitterMs),
        count: logsForCode ? logsForCode.length : 0,
        });
    }

    byCode.set(code, arr);
    }

    return {
      buckets: bucketsSorted,
      seriesByCode: byCode,
      maxCount: globalMax,
      allCodes: codesArray,
      totalCodes: totalAllCodes,
      codeTotals: perCodeTotals,
    };
  }, [logs]);

  // ---------- Track container size (viewport) ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- Draw chart ----------
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const viewportWidth = size.width;
    const height = size.height;
    // Extra bottom margin so the x-axis isn't obscured by the horizontal scrollbar
    const margin = { top: 26, right: 16, bottom: 44, left: 40 };
    const innerW = Math.max(0, viewportWidth - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    const scaledInnerW = innerW * zoomLevel;
    const svgWidth = scaledInnerW + margin.left + margin.right;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("width", svgWidth).attr("height", height);

    if (buckets.length === 0 || maxCount === 0) {
      return;
    }

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const extent = d3.extent(buckets, (b) => b.date) as [Date, Date];
    const [minDate, maxDate] = extent;

    // Fallback pad: 1 day if all logs are on the same day
    const spanMs = maxDate.getTime() - minDate.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const padMs = spanMs > 0 ? Math.min(spanMs * 0.02, dayMs) : dayMs; // at most 1 day each side

    const x = d3
    .scaleTime()
    .domain([
        new Date(minDate.getTime() - padMs),
        new Date(maxDate.getTime() + padMs),
    ])
    .range([0, scaledInnerW]);

    const y = d3
      .scaleLinear()
      .domain([0, maxCount || 1])
      .nice()
      .range([innerH, 0]);

    const color = d3
      .scaleOrdinal<number, string>()
      .domain(allCodes)
      .range(d3.schemeTableau10 as any);

    const tickCount = Math.round(6 * zoomLevel);
    const dateFormatter =
      zoomLevel >= 3
        ? d3.timeFormat("%b %d") // e.g. "Jan 14"
        : d3.timeFormat("%b"); // e.g. "Jan"

    const xAxis = d3
      .axisBottom<Date>(x)
      .ticks(tickCount)
      .tickFormat(dateFormatter as any)
      .tickSizeOuter(0);

    const yAxis = d3.axisLeft<number>(y).ticks(5).tickSizeOuter(0);

    // Y axis
    g.append("g").call((sel) => {
      const axis = yAxis as any;
      sel.call(axis);
      sel.selectAll("path, line").attr("stroke", "#404040");
      sel.selectAll("text").attr("fill", "#a3a3a3");
    });

    // X axis (single, no xAxisG variable needed)
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call((sel) => {
        const axis = xAxis as any;
        sel.call(axis);
        sel.selectAll("path, line").attr("stroke", "#404040");
        sel.selectAll("text").attr("fill", "#a3a3a3");
      });

    // Gridlines
    g.append("g")
      .attr("stroke", "#2a2a2a")
      .attr("stroke-opacity", 1)
      .call((grid) =>
        grid
          .selectAll("line")
          .data(y.ticks(5))
          .join("line")
          .attr("x1", 0)
          .attr("x2", scaledInnerW)
          .attr("y1", (d) => y(d))
          .attr("y2", (d) => y(d))
      );

    const line = d3
      .line<SeriesPoint>()
      .x((d) => x(d.date))
      .y((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    // Draw per-code series
    allCodes.forEach((code) => {
      const data = seriesByCode.get(code);
      if (!data || data.length === 0) return;
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color(code))
        .attr("stroke-width", 1.5)
        .attr("d", line as any);
    });

    // ---------- Tooltip ----------
    const container = d3.select(containerRef.current!);
    const tooltip = container
    .append("div")
    .attr("class", "pointer-events-none opacity-0 z-50")
    .style("position", "fixed")
    .style("z-index", "9999")
    .style("padding", "6px 8px")
    .style("border-radius", "4px")
    .style("font-size", "11px")
    .style("background", "rgba(23,23,23,0.95)")
    .style("color", "#e5e5e5")
    .style("max-width", "320px");

    const bisectDate = d3
      .bisector<Bucket, Date>((b, d) => b.date.getTime() - d.getTime())
      .center;

    const overlay = g
      .append("rect")
      .attr("fill", "transparent")
      .attr("pointer-events", "all")
      .attr("width", scaledInnerW) // cover full scrollable width
      .attr("height", innerH)
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const xDate = x.invert(mx);
        const idx = bisectDate(buckets, xDate);
        const bucket = buckets[idx];
        if (!bucket) return;

        const dateStr = bucket.date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        let html = `<div><span class="text-neutral-400">Time:</span> ${dateStr}</div>`;
        html += `<div><span class="text-neutral-400">Total:</span> ${bucket.total}</div>`;

        const codesInBucket = Array.from(bucket.perCode.keys()).sort(
          (a, b) => a - b
        );
        for (const code of codesInBucket) {
          const logsHere = bucket.perCode.get(code)!;
          const ids = logsHere.slice(0, 3).map((l) => l.id).join(", ");
          const more =
            logsHere.length > 3 ? `, +${logsHere.length - 3} more` : "";
          html += `<div><span class="text-neutral-400">${code}:</span> ${
            logsHere.length
          } [${ids}${more}]</div>`;
        }

        tooltip.html(html);

       const ev = event as MouseEvent;
        // Position relative to the viewport, not the scrollable container.
        let left = ev.clientX + 10;
        let top  = ev.clientY + 10;

        const tooltipEl = tooltip.node() as HTMLElement;
        const tRect = tooltipEl.getBoundingClientRect();
        const padding = 4;

        if (left + tRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tRect.width - padding;
        }
        if (top + tRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tRect.height - padding;
        }

        tooltip
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .style("opacity", "1");
        })
      .on("mouseleave", () => {
        tooltip.style("opacity", "0");
      });

    return () => {
      overlay.on("mousemove", null).on("mouseleave", null);
      tooltip.remove();
    };
  }, [buckets, seriesByCode, maxCount, allCodes, size.width, size.height, zoomLevel]);

  // ---------- Render ----------
  if (!logs || logs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-400">
        Select datasets on the Analytics page to see HTTP status code counts
      </div>
    );
  }

  const noCodes = totalCodes === 0;

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Header: legend + zoom controls stay fixed */}
      <div className="flex items-center justify-between px-2 pb-1">
        {/* Legend outside SVG so it doesn't scroll */}
        <div className="flex flex-wrap gap-3 text-xs text-neutral-200">
          {allCodes.map((code, idx) => {
            const palette = d3.schemeTableau10 as string[];
            const color = palette[idx % palette.length];
            const count = codeTotals.get(code) || 0;
            const info = getHttpStatusInfo(code);
            const title = `${code} — ${info.phrase} (${info.category})\nTotal entries: ${count.toLocaleString()}`;
            return (
              <div
                key={code}
                className="relative group flex items-center gap-1"
                title={title}
              >
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span>{code}</span>
                {/* Hover tooltip (styled) */}
                <div
                  className="pointer-events-none absolute top-5 left-0 z-50 hidden min-w-44 max-w-72 rounded border border-neutral-700 bg-neutral-900/95 p-2 text-[11px] text-neutral-200 shadow-lg group-hover:block"
                >
                  <div className="font-medium">
                    {code} — {info.phrase}
                  </div>
                  <div className="text-neutral-400">{info.category}</div>
                  <div className="mt-1">
                    Total entries: {count.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Zoom buttons */}
        <div className="flex gap-1">
          <button
            className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            onClick={() => setZoomLevel((z) => Math.min(10, z * 1.5))}
          >
            +
          </button>
          <button
            className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            onClick={() => setZoomLevel((z) => Math.max(1, z / 1.5))}
          >
            −
          </button>
        </div>
      </div>

      {/* Scrollable graph area */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-x-auto"
      >
        <svg ref={svgRef} className="h-full" />
        {/* Spacer to ensure x-axis and labels are not covered by the bottom scrollbar */}
        <div className="h-8" />
        {noCodes && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
            No HTTP status codes found. Load an HTTP dataset or entries with app
            type "HTTP-App".
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorGraph;
