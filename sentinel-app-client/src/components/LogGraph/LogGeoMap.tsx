// src/components/LogGraph/LogGeoMap.tsx
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

import { Log } from "@/types/types";

// ---------- Inline Leaflet layout styles ----------
const LeafletInlineStyles = () => (
    <style>
        {`
    .leaflet-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: #111827;
      outline: 0;
      overflow: hidden;
      touch-action: none;
    }

    .leaflet-pane,
    .leaflet-tile-pane,
    .leaflet-overlay-pane,
    .leaflet-shadow-pane,
    .leaflet-marker-pane,
    .leaflet-tooltip-pane,
    .leaflet-popup-pane,
    .leaflet-map-pane {
      position: absolute;
      left: 0;
      top: 0;
    }

    .leaflet-tile,
    .leaflet-marker-icon,
    .leaflet-shadow {
      position: absolute;
      user-select: none;
      -webkit-user-drag: none;
    }

    .leaflet-tile {
      width: 256px;
      height: 256px;
    }

    .leaflet-container img.leaflet-tile,
    .leaflet-container img.leaflet-image-layer {
      max-width: none !important;
    }

    /* Custom pin style (DivIcon) */
    .log-ip-marker {
      width: 12px;
      height: 12px;
      border-radius: 9999px;
      background-color: #facc15;  /* yellow */
      border: 2px solid #92400e;  /* darker outline */
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    }
  `}
    </style>
);

// Use DivIcon so we are not depending on external images
const dotIcon = L.divIcon({
    className: "log-ip-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

// keep TS happy regardless of react-leaflet version
const AnyMapContainer = MapContainer as any;
const AnyTileLayer = TileLayer as any;
const AnyMarker = Marker as any;
const AnyPopup = Popup as any;

// ---------- Types ----------
type GeoPoint = {
    ip: string;
    lat: number;
    lon: number;
    count: number;
    approximate: boolean;
    isPrivate: boolean;
};

type LogGeoMapProps = {
    logs: Log[];
};

const GEO_CACHE_KEY = "logGeoIpCache_v3";
let memoryCache: Record<
    string,
    { lat: number; lon: number; approximate: boolean; isPrivate: boolean }
> | null = null;

// ---------- Cache helpers ----------
const loadCache = () => {
    if (memoryCache) return memoryCache;
    try {
        const raw =
            typeof window !== "undefined" ? window.localStorage.getItem(GEO_CACHE_KEY) : null;
        memoryCache = raw
            ? (JSON.parse(raw) as Record<
                  string,
                  { lat: number; lon: number; approximate: boolean; isPrivate: boolean }
              >)
            : {};
    } catch {
        memoryCache = {};
    }
    return memoryCache!;
};

const saveCache = (
    cache: Record<string, { lat: number; lon: number; approximate: boolean; isPrivate: boolean }>
) => {
    memoryCache = cache;
    try {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
        }
    } catch {
        // ignore
    }
};

// ---------- IP helpers ----------
const ipv4Regex = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/; // simple IPv4 matcher

const isPrivateIp = (ip: string): boolean => {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    return false;
};

// collect any IP-looking values from an object (log or log.raw)
const collectIpsFromObject = (obj: any): string[] => {
    if (!obj || typeof obj !== "object") return [];
    const result: string[] = [];

    const candidateKeys = [
        "src_ip",
        "dest_ip",
        "ip",
        "ipAddress",
        "client_ip",
        "remote_ip",
        "srcIp",
        "destIp",
        "source_ip",
        "dst_ip",
        "sourceIp",
        "destinationIp",
        "remoteAddr",
        "remoteAddress",
        "destination",
        "dest",
    ];

    for (const key of Object.keys(obj)) {
        const lower = key.toLowerCase();
        const val = obj[key];

        if (candidateKeys.some((ck) => ck.toLowerCase() === lower)) {
            const s = String(val ?? "").trim();
            if (s) result.push(s);
            continue;
        }

        if (lower.includes("ip")) {
            const s = String(val ?? "").trim();
            if (s) result.push(s);
        }
    }

    for (const v of Object.values(obj)) {
        if (typeof v === "string") {
            const m = v.match(ipv4Regex);
            if (m) result.push(m[0]);
        }
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of result) {
        const m = r.match(ipv4Regex);
        const ip = m ? m[0] : r;
        const trimmed = ip.trim();
        if (!trimmed) continue;
        if (!seen.has(trimmed)) {
            seen.add(trimmed);
            out.push(trimmed);
        }
    }
    return out;
};

// tiny deterministic jitter so multiple markers at same city don't overlap 100%
const jitter = (ip: string, magnitude = 0.15): { dLat: number; dLon: number } => {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
        hash = (hash * 31 + ip.charCodeAt(i)) >>> 0;
    }
    const rand1 = (hash & 0xffff) / 0xffff; // [0,1]
    const rand2 = ((hash >>> 16) & 0xffff) / 0xffff;

    const dLat = (rand1 - 0.5) * magnitude; // e.g. ±0.075°
    const dLon = (rand2 - 0.5) * magnitude;
    return { dLat, dLon };
};

// real geolocation via ipapi.co latlong endpoint, plus approximate fallback for private IPs
const lookupIpLocation = async (
    ip: string
): Promise<{ lat: number; lon: number; approximate: boolean; isPrivate: boolean } | null> => {
    const cache = loadCache();
    if (cache[ip]) return cache[ip];

    const privateFlag = isPrivateIp(ip);

    // For public IPs: attempt real geolocation
    if (!privateFlag) {
        try {
            // Returns plain text "lat,lon"
            const res = await fetch(`https://ipapi.co/${ip}/latlong/`);
            if (res.ok) {
                const txt = (await res.text()).trim();
                const [latStr, lonStr] = txt.split(",");
                const lat = Number(latStr);
                const lon = Number(lonStr);
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    const value = { lat, lon, approximate: false, isPrivate: false };
                    cache[ip] = value;
                    saveCache(cache);
                    return value;
                }
            }
        } catch {
            // fall back to null for public IPs if geolocation fails
            // (we don't want fake locations for public IPs if we care about accuracy)
            return null;
        }
    }

    // For private IPs (or if you still want an approximate view):
    const parts = ip.split(".").map((p) => Number(p));
    while (parts.length < 4) parts.push(0);
    const [a, b, c, d] = parts.map((n) => (Number.isFinite(n) && n >= 0 && n <= 255 ? n : 0));

    const lat = (c / 255) * 140 - 70; // [-70, 70]
    const hash = (a * 256 * 256 + b * 256 + d) % 65535;
    const lon = (hash / 65535) * 360 - 180; // [-180, 180]

    const value = { lat, lon, approximate: true, isPrivate: privateFlag };
    cache[ip] = value;
    saveCache(cache);
    return value;
};

// Map size invalidation
const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const resize = () => map.invalidateSize();
        map.whenReady(resize);
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [map]);
    return null;
};

// ---------- Component ----------
const LogGeoMap = ({ logs }: LogGeoMapProps) => {
    const [points, setPoints] = useState<GeoPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { uniqueIps, counts, publicIps, privateIps } = useMemo(() => {
        const counts = new Map<string, number>();

        logs.forEach((log) => {
            const anyLog = log as any;
            const ips: string[] = [];

            ips.push(...collectIpsFromObject(anyLog));
            if (anyLog.raw) {
                ips.push(...collectIpsFromObject(anyLog.raw));
            }

            ips.forEach((ip) => counts.set(ip, (counts.get(ip) ?? 0) + 1));
        });

        const allIps = Array.from(counts.keys());
        const publicIps = allIps.filter((ip) => !isPrivateIp(ip));
        const privateIps = allIps.filter((ip) => isPrivateIp(ip));

        return { uniqueIps: allIps, counts, publicIps, privateIps };
    }, [logs]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);

            if (!uniqueIps.length) {
                setPoints([]);
                setLoading(false);
                return;
            }

            const allPoints: GeoPoint[] = [];
            const batchSize = 8;

            for (let i = 0; i < uniqueIps.length; i += batchSize) {
                const batch = uniqueIps.slice(i, i + batchSize);
                const settled = await Promise.allSettled(batch.map((ip) => lookupIpLocation(ip)));

                settled.forEach((res, idx) => {
                    const ip = batch[idx];
                    if (res.status === "fulfilled" && res.value) {
                        const { lat, lon, approximate, isPrivate } = res.value;
                        const count = counts.get(ip) ?? 0;

                        // apply small jitter so markers don't completely overlap
                        const { dLat, dLon } = jitter(ip);
                        const jitteredLat = lat + dLat;
                        const jitteredLon = lon + dLon;

                        allPoints.push({
                            ip,
                            lat: jitteredLat,
                            lon: jitteredLon,
                            count,
                            approximate,
                            isPrivate,
                        });
                    }
                });

                if (cancelled) return;
            }

            if (!cancelled) {
                setPoints(allPoints);
                setLoading(false);
            }
        };

        run().catch((e) => {
            if (!cancelled) {
                console.error("Geo map lookup failed", e);
                setError("Failed to geolocate some IPs");
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [uniqueIps, counts]);

    // Center map on mean of public IPs if available; otherwise any
    const center: [number, number] = useMemo(() => {
        const publicPoints = points.filter((p) => !p.isPrivate && !p.approximate);
        const usePoints = publicPoints.length ? publicPoints : points;

        if (!usePoints.length) return [20, 0];

        const sumLat = usePoints.reduce((s, p) => s + p.lat, 0);
        const sumLon = usePoints.reduce((s, p) => s + p.lon, 0);
        return [sumLat / usePoints.length, sumLon / usePoints.length] as [number, number];
    }, [points]);

    if (!logs.length) {
        return (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                No logs loaded
            </div>
        );
    }

    if (!points.length && loading) {
        return (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                Geolocating IPs…
            </div>
        );
    }

    if (!points.length && !loading && !error) {
        return (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                No IP addresses found in current logs
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[320px] relative">
            <LeafletInlineStyles />

            <AnyMapContainer
                center={center}
                zoom={3}
                minZoom={1}
                maxZoom={8}
                style={{ width: "100%", height: "100%" }}
                worldCopyJump
            >
                <MapResizer />
                <AnyTileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {points.map((p) => (
                    <AnyMarker key={p.ip} position={[p.lat, p.lon]} icon={dotIcon}>
                        <AnyPopup>
                            <div className="text-xs space-y-0.5">
                                <div>
                                    <span className="font-semibold">IP:</span> {p.ip}
                                </div>
                                <div>
                                    <span className="font-semibold">Logs:</span> {p.count}
                                </div>
                                <div>
                                    <span className="font-semibold">Type:</span>{" "}
                                    {p.isPrivate ? "private / internal" : "public"}
                                </div>
                                <div>
                                    <span className="font-semibold">Location:</span>{" "}
                                    {p.approximate
                                        ? "approximate (fallback)"
                                        : "geocoded (ipapi.co lat/long)"}
                                </div>
                                <div>
                                    <span className="font-semibold">Lat/Lon:</span>{" "}
                                    {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
                                </div>
                            </div>
                        </AnyPopup>
                    </AnyMarker>
                ))}
            </AnyMapContainer>

            {/* Debug overlay */}
            <div className="absolute top-2 left-2 px-2 py-1 text-[10px] rounded bg-neutral-900/80 text-neutral-200 space-y-0.5">
                <div>logs: {logs.length}</div>
                <div>unique IPs: {uniqueIps.length}</div>
                <div>public IPs: {publicIps.length}</div>
                <div>private IPs: {privateIps.length}</div>
                <div>markers: {points.length}</div>
                <div>
                    geocoded: {points.filter((p) => !p.approximate).length} / approx:{" "}
                    {points.filter((p) => p.approximate).length}
                </div>
                {points[0] && (
                    <div>
                        first: {points[0].lat.toFixed(2)}, {points[0].lon.toFixed(2)}
                    </div>
                )}
            </div>

            {loading && (
                <div className="absolute bottom-2 left-2 px-2 py-1 text-xs rounded bg-neutral-900/80 text-neutral-200">
                    Updating IP locations…
                </div>
            )}
            {error && (
                <div className="absolute bottom-2 right-2 px-2 py-1 text-xs rounded bg-red-900/80 text-red-100">
                    {error}
                </div>
            )}
        </div>
    );
};

export default LogGeoMap;
