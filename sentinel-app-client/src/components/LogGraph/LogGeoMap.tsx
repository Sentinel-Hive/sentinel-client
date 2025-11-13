// src/components/LogGraph/LogGeoMap.tsx
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

import { Log } from "@/types/types";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import MarkerClusterGroup from "react-leaflet-markercluster";

const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount();

    const size = count < 10 ? 26 : count < 50 ? 32 : count < 200 ? 40 : 48;

    return L.divIcon({
        html: `<span>${count}</span>`,
        className: "log-ip-cluster-marker",
        iconSize: [size, size],
    });
};

const LeafletInlineStyles = () => (
    <style>
        {`
    /* Optional: dark background while tiles load */
    .leaflet-container {
      background: #111827;
    }

    .log-ip-marker {
      width: 12px;
      height: 12px;
      border-radius: 9999px;
      background-color: #facc15;
      border: 2px solid #92400e;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    }

    .log-ip-cluster-marker {
      border-radius: 9999px;
      background: radial-gradient(circle at 30% 30%, #facc15, #b45309);
      color: #111827;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      border: 2px solid #92400e;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.9);
    }

    .log-ip-cluster-marker span {
      font-size: 11px;
      transform: translateY(1px);
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

const GEO_CACHE_KEY = "logGeoIpCache_v4";
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
    const [a, b, c, d] = parts;

    // RFC1918 private ranges
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16

    // Loopback
    if (a === 127) return true; // 127.0.0.0/8

    // Link-local
    if (a === 169 && b === 254) return true; // 169.254.0.0/16

    // Carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10

    // Benchmarking
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15

    // Documentation / test networks (treat as internal)
    if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24

    // 0.0.0.0/8, broadcast, multicast, and other non-routable specials
    if (a === 0) return true;
    if (a === 255) return true; // 255.x.x.x
    if (a >= 224 && a <= 239) return true; // multicast 224.0.0.0/4
    if (a >= 240) return true; // reserved 240.0.0.0/4

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

const lookupIpLocation = async (
    ip: string
): Promise<{ lat: number; lon: number; approximate: boolean; isPrivate: boolean } | null> => {
    const cache = loadCache();
    if (cache[ip]) return cache[ip];

    if (isPrivateIp(ip)) {
        cache[ip] = { lat: 0, lon: 0, approximate: true, isPrivate: true };
        saveCache(cache);
        return null;
    }

    // Validate + sanitize coordinates
    const normalizeCoords = (lat: any, lon: any) => {
        const nLat = Number(lat);
        const nLon = Number(lon);

        if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return null;

        // reject null island, poles, and obviously wrong ranges
        if (nLat === 0 && nLon === 0) return null;
        if (nLat < -60 || nLat > 85) return null;
        if (nLon < -180 || nLon > 180) return null;

        return { lat: nLat, lon: nLon };
    };

    // Providers (ordered by reliability)
    const providers: Array<() => Promise<{ lat: number; lon: number } | null>> = [
        // 1. ipapi.co
        async () => {
            const r = await fetch(`https://ipapi.co/${ip}/json/`);
            if (!r.ok) return null;
            const j = await r.json();
            if (j.error) return null;
            return normalizeCoords(j.latitude, j.longitude);
        },

        // 2. ipwho.is
        async () => {
            const r = await fetch(`https://ipwho.is/${ip}?fields=success,latitude,longitude`);
            if (!r.ok) return null;
            const j = await r.json();
            if (j.success === false) return null;
            return normalizeCoords(j.latitude, j.longitude);
        },

        // 3. ipinfo.io
        async () => {
            const r = await fetch(`https://ipinfo.io/${ip}/geo`);
            if (!r.ok) return null;
            const j = await r.json();
            if (!j.loc) return null;
            const [lat, lon] = j.loc.split(",");
            return normalizeCoords(lat, lon);
        },

        // 4. ipgeolocation.io
        async () => {
            const r = await fetch(`https://api.ipgeolocation.io/ipgeo?ip=${ip}`);
            if (!r.ok) return null;
            const j = await r.json();
            // free tier may not give city, but lat/lng is often provided
            return normalizeCoords(j.latitude, j.longitude);
        },

        // 5. ipstack (works even without key sometimes, but more reliable if you supply one)
        async () => {
            const r = await fetch(`http://api.ipstack.com/${ip}?output=json`);
            if (!r.ok) return null;
            const j = await r.json();
            return normalizeCoords(j.latitude, j.longitude);
        },
    ];

    for (const provider of providers) {
        try {
            const coords = await provider();
            if (coords) {
                const value = {
                    lat: coords.lat,
                    lon: coords.lon,
                    approximate: false,
                    isPrivate: false,
                };
                cache[ip] = value;
                saveCache(cache);
                return value;
            }
        } catch {
            // ignore individual provider failure
        }
    }

    return null;
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

        // Only public IPs are geolocated and plotted
        return { uniqueIps: publicIps, counts, publicIps, privateIps };
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

                        if (isPrivate) return;

                        const count = counts.get(ip) ?? 0;

                        allPoints.push({
                            ip,
                            lat,
                            lon,
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
                maxZoom={50}
                style={{ width: "100%", height: "100%" }}
                worldCopyJump
            >
                <MapResizer />
                <AnyTileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={45}
                    iconCreateFunction={createClusterCustomIcon}
                >
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
                                        {p.approximate ? "approximate" : "geocoded (ipwho.is)"}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Lat/Lon:</span>{" "}
                                        {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
                                    </div>
                                </div>
                            </AnyPopup>
                        </AnyMarker>
                    ))}
                </MarkerClusterGroup>
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
