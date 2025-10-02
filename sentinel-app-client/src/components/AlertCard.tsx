import { useMemo, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low";

type Props = {
    id?: string;
    title: string;
    severity: Severity;
    source: string;
    timestamp: string | Date;
    description?: string;
    tags?: string[];
    acknowledged?: boolean;
    onAcknowledge?: (id?: string) => void;
};

export default function AlertCard({
    id,
    title,
    severity,
    source,
    timestamp,
    description,
    tags = [],
    acknowledged: acknowledgedProp = false,
    onAcknowledge,
}: Props) {
    const [ack, setAck] = useState(acknowledgedProp);

    const when = useMemo(() => {
        const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
        return d.toLocaleString();
    }, [timestamp]);

    return (
        <article
            className="group relative overflow-hidden rounded-2xl border bg-[hsl(var(--muted))] p-4 transition
                 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/60"
            role="region"
            aria-label={`Alert ${title}`}
        >
            {/* accent stripe */}
            <div className="pointer-events-none absolute left-0 top-0 h-full w-1.5 bg-[hsl(var(--primary))]" />

            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <SeverityPill level={severity} />
                        <h3 className="truncate text-lg font-semibold">{title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-white/70">
                        <span className="font-medium text-white/80">{source}</span>
                        <span className="mx-2 opacity-40">•</span>
                        <time dateTime={new Date(timestamp).toISOString()}>{when}</time>
                    </p>
                </div>

                <button
                    onClick={() => {
                        setAck(true);
                        onAcknowledge?.(id);
                    }}
                    disabled={ack}
                    className="rounded-xl border border-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium
                     text-[hsl(var(--primary-foreground))] bg-[hsl(var(--primary))] disabled:opacity-50
                     shadow-[0_0_0_0_rgba(0,0,0,0)] transition active:translate-y-[1px]"
                    aria-pressed={ack}
                >
                    {ack ? "Acknowledged" : "Acknowledge"}
                </button>
            </header>

            {description && (
                <p className="mt-3 text-sm leading-relaxed text-white/85">{description}</p>
            )}

            {tags.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                    {tags.map((t) => (
                        <li
                            key={t}
                            className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs uppercase
                         tracking-wide text-white/70"
                        >
                            {t}
                        </li>
                    ))}
                </ul>
            )}

            {/* hover glow */}
            <div
                className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                style={{
                    boxShadow:
                        "inset 0 0 0 1px hsl(var(--primary)/0.15), 0 0 24px hsl(var(--primary)/0.08)",
                }}
            />
        </article>
    );
}

function SeverityPill({ level }: { level: Severity }) {
    const label = level.toUpperCase();
    // keep it black/yellow by varying intensity/opacity, not hue
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
            className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-bold tracking-wider"
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
