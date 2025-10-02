import { useMemo } from "react";

export type Severity = "critical" | "high" | "medium" | "low";

type Props = {
    id?: string;
    severity: Severity;
    timestamp: string | Date;
    description?: string;
};

export default function AlertNotification({
    severity,
    timestamp,
    description,
}: Props) {
    const since = useMemo(() => formatSince(timestamp), [timestamp]);

    return (
        <div
            className="w-full rounded-lg px-3 py-2 hover:bg-neutral-800/60
                 text-left transition"
            role="button"
            tabIndex={0}
        >
            <div className="flex items-center justify-between gap-3">
                <SeverityPill level={severity} />
                <span className="shrink-0 text-xs text-white/60">{since}</span>
            </div>

            {description && (
                <p className="mt-1 line-clamp-2 text-sm text-white/85">
                    {description}
                </p>
            )}
        </div>
    );
}

function SeverityPill({ level }: { level: Severity }) {
    const label = level.toUpperCase();
    const barOpacity =
        level === "critical"
            ? "100%"
            : level === "high"
            ? "80%"
            : level === "medium"
            ? "60%"
            : "40%";

    return (
        <span
            className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider"
            style={{
                borderColor: "hsl(var(--primary) / 0.35)",
                backgroundColor: "hsl(var(--primary) / 0.12)",
                color: "hsl(var(--primary))",
            }}
        >
            <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{
                    backgroundColor: `hsl(var(--primary) / ${barOpacity})`,
                }}
            />
            {label}
        </span>
    );
}

function formatSince(ts: string | Date) {
    const d = typeof ts === "string" ? new Date(ts) : ts;
    const diffMs = Date.now() - d.getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}
