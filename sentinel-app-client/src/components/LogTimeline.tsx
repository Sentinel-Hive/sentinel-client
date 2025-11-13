// src/components/LogTimeline.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Log } from "@/types/types";
import { getLogTimestamp } from "@/lib/utils";

type Props = {
    logs: Log[];
    height?: number;
    className?: string;
    onRefresh?: () => void;
};

const MIN_SPAN_MS = 60_000; // 1 minute
const MAX_SPAN_MS = 365 * 24 * 60 * 60_000; // 1 year
const SCROLL_H = 22;
const MARGINS = { top: 6, right: 8, bottom: 14, left: 10 };

const M = 60_000;
const H = 60 * M;
const D = 24 * H;

// ---------- time helpers (LOCAL time) ----------
function startOfDayLocal(t: number) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return +d;
}
function startOfNextDayLocal(t: number) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return +d;
}

// Robust timestamp extraction for current Log shape and raw data
function getStamp(log: Log | (Log & Record<string, unknown>)) {
    const anyLog = log as any;

    const primary = getLogTimestamp(log as any);

    const candidates: Array<string | number | undefined | null> = [
        primary,
        anyLog.timestamp,
        anyLog.created_at,
        anyLog.date,
        anyLog.time,
        anyLog["@timestamp"],
        anyLog.raw?.timestamp,
        anyLog.raw?._time,
        anyLog.raw?.createdDateTime,
        anyLog.raw?.time,
    ];

    for (const c of candidates) {
        if (c == null) continue;

        if (typeof c === "number") {
            if (Number.isFinite(c)) return c;
            continue;
        }

        if (typeof c === "string") {
            const trimmed = c.trim();
            if (!trimmed) continue;
            const t = Date.parse(trimmed);
            if (Number.isFinite(t)) return t;
        }
    }

    return null;
}

// ---------- bin-size selection ----------
function pickBinSize(spanMs: number): number {
    const m = 60_000;
    const h = 60 * m;
    const d = 24 * h;
    if (spanMs > 180 * d) return 24 * h;
    if (spanMs > 30 * d) return 12 * h;
    if (spanMs > 7 * d) return 6 * h;
    if (spanMs > 2 * d) return 2 * h;
    if (spanMs > 12 * h) return 1 * h;
    if (spanMs > 6 * h) return 30 * m;
    if (spanMs > 2 * h) return 15 * m;
    if (spanMs > 30 * m) return 5 * m;
    if (spanMs > 10 * m) return 2 * m;
    return 1 * m; // minute
}

// Label function:
// - If bin >= 1 day: only dates (no times).
// - If bin < 1 day and span > 1 day: date + time (MM-DD HH:MM).
// - If bin < 1 day and span <= 1 day: time only (HH:MM).
const labelFmt = (ms: number, binMs: number, spanMs: number) => {
    const d = new Date(ms);
    const p2 = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const mo = p2(d.getMonth() + 1);
    const da = p2(d.getDate());
    const hh = p2(d.getHours());
    const mm = p2(d.getMinutes());

    if (binMs >= D) {
        if (spanMs > 180 * D) return `${y}-${mo}`;
        return `${y}-${mo}-${da}`;
    }

    return `${mo}-${da} ${hh}:${mm}`;
};

const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    return (
        <div className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
            <div className="text-neutral-400">Logs</div>
            <div className="font-semibold">{p.count}</div>
            <div className="text-neutral-400 mt-1">{new Date(p.start).toLocaleString()} →</div>
            <div className="text-neutral-400">{new Date(p.end).toLocaleString()}</div>
        </div>
    );
};

// binary search helpers
function lowerBound(a: number[], x: number) {
    let l = 0,
        r = a.length;
    while (l < r) {
        const m = (l + r) >> 1;
        if (a[m] < x) l = m + 1;
        else r = m;
    }
    return l;
}
function upperBound(a: number[], x: number) {
    let l = 0,
        r = a.length;
    while (l < r) {
        const m = (l + r) >> 1;
        if (a[m] <= x) l = m + 1;
        else r = m;
    }
    return l;
}

export default function LogTimeline({ logs, height = 168, className = "", onRefresh }: Props) {
    if (!logs || logs.length === 0) return null;

    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const chartWrapRef = useRef<HTMLDivElement>(null);

    // sorted timestamps once; max zoom-out = full-day bounds
    const { ts, globalMin, globalMax } = useMemo(() => {
        const ts0 = logs
            .map(getStamp)
            .filter((n): n is number => n !== null)
            .sort((a, b) => a - b);
        if (ts0.length === 0) return { ts: [] as number[], globalMin: 0, globalMax: 0 };
        const rawMin = ts0[0];
        const rawMax = ts0[ts0.length - 1];
        const minDay = startOfDayLocal(rawMin);
        const maxDayNext = startOfNextDayLocal(rawMax);
        return { ts: ts0, globalMin: minDay, globalMax: maxDayNext };
    }, [logs]);

    const [vMin, setVMin] = useState(globalMin);
    const [vMax, setVMax] = useState(globalMax);

    useEffect(() => {
        setVMin(globalMin);
        setVMax(globalMax);
    }, [globalMin, globalMax]);

    // Current visible span
    const spanNow = Math.max(1, vMax - vMin);

    // clamp visible window
    const clampWindow = useCallback(
        (min: number, max: number) => {
            let span = Math.max(1, max - min);
            const total = Math.max(1, globalMax - globalMin);
            span = Math.min(Math.max(span, MIN_SPAN_MS), Math.min(MAX_SPAN_MS, total));
            const mid = (min + max) / 2;
            let nMin = Math.round(mid - span / 2);
            let nMax = Math.round(mid + span / 2);
            if (nMin < globalMin) {
                const d = globalMin - nMin;
                nMin += d;
                nMax += d;
            }
            if (nMax > globalMax) {
                const d = nMax - globalMax;
                nMin -= d;
                nMax -= d;
            }
            if (nMax <= nMin) nMax = nMin + 1;
            return [nMin, nMax] as const;
        },
        [globalMin, globalMax]
    );

    const panBy = useCallback(
        (ms: number) => {
            const [nMin, nMax] = clampWindow(vMin + ms, vMax + ms);
            setVMin(nMin);
            setVMax(nMax);
        },
        [vMin, vMax, clampWindow]
    );

    const zoom = (factor: number) => {
        const mid = (vMin + vMax) / 2;
        const half = (vMax - vMin) / 2 / factor;
        const [nMin, nMax] = clampWindow(Math.floor(mid - half), Math.ceil(mid + half));
        setVMin(nMin);
        setVMax(nMax);
    };

    const pan = (dir: -1 | 1, magnitude = 1) => {
        const span = vMax - vMin;
        const base = Math.max(pickBinSize(span), Math.floor(span * 0.2));
        panBy(dir * Math.round(base * magnitude));
    };

    // wheel pans horizontally
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        let accum = 0;
        let ticking = false;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            accum += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const mag = Math.min(2, Math.max(0.2, Math.abs(accum) / 200));
                const dir = accum > 0 ? 1 : -1;
                pan(dir as 1 | -1, mag);
                accum = 0;
                ticking = false;
            });
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel as any);
    }, [pan]);

    // chart width for pixel math
    const [chartW, setChartW] = useState(600);
    useEffect(() => {
        const el = chartWrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setChartW(Math.max(1, el.clientWidth)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ---------- bins & ticks, aligned to LOCAL midnight ----------
    const { rows, step, firstBoundary } = useMemo(() => {
        if (ts.length === 0) {
            return {
                rows: [] as {
                    start: number;
                    end: number;
                    mid: number;
                    count: number;
                }[],
                step: MIN_SPAN_MS,
                firstBoundary: vMin,
            };
        }

        let step = pickBinSize(spanNow);

        const MIN_BIN_PX = 12;
        const MAX_BIN_PX = 40;
        const TARGET_BIN_PX = 24;

        if (chartW > 0 && spanNow > 0) {
            for (let i = 0; i < 8; i++) {
                const bins = spanNow / step;
                const pxPerBin = chartW / Math.max(1, bins);

                if (pxPerBin < MIN_BIN_PX && step < spanNow) {
                    step = Math.min(spanNow, step * 2);
                } else if (pxPerBin > MAX_BIN_PX && step > MIN_SPAN_MS) {
                    const next = Math.max(MIN_SPAN_MS, Math.floor(step / 2));
                    if (next === step) break;
                    step = next;
                } else {
                    if (pxPerBin < TARGET_BIN_PX && step < spanNow) {
                        step = Math.min(spanNow, step * 1.5);
                    } else if (pxPerBin > TARGET_BIN_PX && step > MIN_SPAN_MS) {
                        const next = Math.max(MIN_SPAN_MS, Math.floor(step / 1.5));
                        if (next === step) break;
                        step = next;
                    }
                    break;
                }
            }
        }

        const baseDay = startOfDayLocal(vMin);
        const diff = vMin - baseDay;
        const k = Math.floor(diff / step);
        let first = baseDay + k * step;
        while (first > vMin) first -= step;

        const endLimit = vMax;
        const bins: number[] = [];
        let tCursor = first;
        while (tCursor < endLimit + step) {
            bins.push(tCursor);
            tCursor += step;
        }

        const counts = new Array(bins.length).fill(0);
        const pad = step;
        const i0 = Math.max(0, lowerBound(ts, vMin - pad));
        const i1 = Math.min(ts.length, upperBound(ts, vMax + pad));

        let j = 0;
        for (let i = i0; i < i1; i++) {
            const t = ts[i];
            while (j + 1 < bins.length && t >= bins[j + 1]) j++;
            if (j >= 0 && j < counts.length) counts[j] += 1;
        }

        const rows = bins.map((b, i) => ({
            start: b,
            end: b + step,
            mid: b + step / 2,
            count: counts[i] || 0,
        }));

        return { rows, step, firstBoundary: first };
    }, [ts, vMin, vMax, chartW, spanNow]);

    const ticks: number[] = useMemo(() => {
        const out: number[] = [];
        let t = firstBoundary;
        const limit = vMax + step;
        while (t <= limit) {
            out.push(t);
            t += step;
        }
        return out;
    }, [firstBoundary, step, vMax]);

    // scrollbar state
    const total = Math.max(1, globalMax - globalMin);
    const win = Math.max(1, vMax - vMin);
    const maxPos = Math.max(0, total - win);
    const pos = Math.min(maxPos, Math.max(0, vMin - globalMin));
    const thumbLeftPct = (pos / total) * 100;
    const thumbWidthPct = (win / total) * 100;

    const refs = useRef({
        dragging: false,
        dragOffsetPx: 0,
        win,
        total,
        globalMin,
    });
    refs.current.win = win;
    refs.current.total = total;
    refs.current.globalMin = globalMin;

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        const onPointerDown = (e: PointerEvent) => {
            const rect = track.getBoundingClientRect();
            const thumbLeftPx = (thumbLeftPct / 100) * rect.width;
            const thumbWpx = (thumbWidthPct / 100) * rect.width;
            const x = e.clientX - rect.left;

            if (x >= thumbLeftPx && x <= thumbLeftPx + thumbWpx) {
                refs.current.dragging = true;
                refs.current.dragOffsetPx = x - thumbLeftPx;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                e.preventDefault();
            } else {
                const clicked = Math.max(0, Math.min(rect.width, x));
                const clickTime =
                    refs.current.globalMin +
                    Math.round((clicked / rect.width) * refs.current.total);
                const half = Math.floor(refs.current.win / 2);
                let nMin = clickTime - half;
                let nMax = clickTime + half;
                [nMin, nMax] = clampWindow(nMin, nMax);
                setVMin(nMin);
                setVMax(nMax);
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!refs.current.dragging) return;
            const rect = track.getBoundingClientRect();
            const newLeftPx = Math.max(
                0,
                Math.min(rect.width - 1, e.clientX - rect.left - refs.current.dragOffsetPx)
            );
            const newLeftTime =
                refs.current.globalMin + Math.round((newLeftPx / rect.width) * refs.current.total);
            let nMin = newLeftTime;
            let nMax = newLeftTime + refs.current.win;
            [nMin, nMax] = clampWindow(nMin, nMax);
            setVMin(nMin);
            setVMax(nMax);
            e.preventDefault();
        };

        const onPointerUp = (e: PointerEvent) => {
            refs.current.dragging = false;
            (e.target as Element).releasePointerCapture?.(e.pointerId);
        };

        track.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        return () => {
            track.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        };
    }, [thumbLeftPct, thumbWidthPct, clampWindow]);

    const canZoomIn = vMax - vMin > MIN_SPAN_MS + 1000;
    const chartHeight = Math.max(72, height - SCROLL_H);
    const controlSpan = Math.min(height, chartHeight + SCROLL_H); // vertical span for buttons

    return (
        <div ref={containerRef} className={`w-full ${className}`} style={{ height }}>
            <div className="w-full h-full flex">
                <div className="shrink-0 flex items-start justify-start h-full pr-1">
                    <div
                        className="grid grid-cols-2 grid-rows-3 gap-1 pb-5"
                        style={{
                            // square container so 3x2 grid of 3:2 buttons fits exactly
                            height: controlSpan,
                            width: controlSpan,
                        }}
                    >
                        <button
                            className="w-full h-full rounded bg-neutral-800 border border-neutral-700 text-yellow-400"
                            style={{ aspectRatio: "3 / 2" }}
                            title="Zoom out"
                            onClick={() => zoom(1 / 1.5)}
                        >
                            –
                        </button>
                        <button
                            className="w-full h-full rounded bg-neutral-800 border border-neutral-700 text-yellow-400 disabled:opacity-40"
                            style={{ aspectRatio: "3 / 2" }}
                            title="Zoom in"
                            onClick={() => canZoomIn && zoom(1.5)}
                            disabled={!canZoomIn}
                        >
                            +
                        </button>
                        <button
                            className="w-full h-full rounded bg-neutral-800 border border-neutral-700 text-yellow-400"
                            style={{ aspectRatio: "3 / 2" }}
                            title="Pan left"
                            onClick={() => pan(-1)}
                        >
                            ⟵
                        </button>
                        <button
                            className="w-full h-full rounded bg-neutral-800 border border-neutral-700 text-yellow-400"
                            style={{ aspectRatio: "3 / 2" }}
                            title="Pan right"
                            onClick={() => pan(1)}
                        >
                            ⟶
                        </button>
                        <button
                            className="w-full h-full rounded bg-neutral-800 border border-neutral-700 text-yellow-400"
                            style={{ aspectRatio: "3 / 2" }}
                            title="Fit"
                            onClick={() => {
                                setVMin(globalMin);
                                setVMax(globalMax);
                            }}
                        >
                            Fit
                        </button>
                        <button
                            className="w-full h-full rounded bg-neutral-800 border border-neutral-700 text-yellow-400"
                            style={{ aspectRatio: "3 / 2" }}
                            title="Refresh"
                            onClick={() => onRefresh?.()}
                        >
                            ⟳
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                    <div ref={chartWrapRef} className="w-full" style={{ height: chartHeight }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rows} margin={MARGINS} barCategoryGap="0%" barGap={0}>
                                <CartesianGrid vertical={false} stroke="#262626" />
                                <XAxis
                                    dataKey="mid"
                                    type="number"
                                    domain={[vMin, vMax]}
                                    allowDataOverflow
                                    ticks={ticks}
                                    tickFormatter={(v) => labelFmt(Number(v), step, spanNow)}
                                    tick={{
                                        fontSize: 10,
                                        fill: "#9ca3af",
                                    }}
                                    tickMargin={6}
                                    axisLine={{ stroke: "#4b5563" }}
                                    tickLine={{ stroke: "#4b5563" }}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    width={36}
                                    tick={{
                                        fontSize: 10,
                                        fill: "#9ca3af",
                                    }}
                                    axisLine={{ stroke: "#4b5563" }}
                                    tickLine={{ stroke: "#4b5563" }}
                                />
                                <Tooltip content={<Tip />} />
                                <Bar
                                    dataKey="count"
                                    isAnimationActive={false}
                                    fill="#facc15"
                                    fillOpacity={0.85}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="w-full px-3 -mt-2 mb-2" style={{ height: SCROLL_H }}>
                        <div
                            ref={trackRef}
                            role="scrollbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(
                                ((vMin - globalMin) / Math.max(1, Math.max(0, total - win))) * 100
                            )}
                            className="relative w-full h-[10px] rounded bg-neutral-800 border border-neutral-700"
                            title="Drag the yellow bar to pan. Click track to recenter."
                        >
                            <div
                                className="absolute top-0 h-full rounded bg-yellow-400/90 border border-yellow-300 cursor-grab active:cursor-grabbing"
                                style={{
                                    left: `${
                                        (Math.min(
                                            Math.max(0, vMin - globalMin),
                                            Math.max(0, total - win)
                                        ) /
                                            total) *
                                        100
                                    }%`,
                                    width: `${(win / total) * 100}%`,
                                    minWidth: `${(MIN_SPAN_MS / Math.max(1, total)) * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
