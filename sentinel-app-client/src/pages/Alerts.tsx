import AlertCard from "../components/AlertCard";
import { useAlerts, acknowledge } from "../lib/alertsStore"; // ← import acknowledge
import { useMemo, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low";
const SEV_ORDER: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

export default function Alerts() {
    const alerts = useAlerts(); // live
    const [showAcknowledged, setShowAcknowledged] = useState(false);
    const [sortBy, setSortBy] = useState<"recent" | "severity">("recent");

    const view = useMemo(() => {
        let list = alerts;

        if (!showAcknowledged) {
            list = list.filter((a) => !a.acknowledged);
        }

        if (sortBy === "recent") {
            list = [...list].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
        } else {
            list = [...list].sort((a, b) => {
                const sev = SEV_ORDER[a.severity as Severity] - SEV_ORDER[b.severity as Severity];
                if (sev !== 0) return sev;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
        }

        return list;
    }, [alerts, showAcknowledged, sortBy]);

    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            <header className="flex items-end justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Alerts</h2>

                {/* Controls */}
                <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-2 text-white/80">
                        <input
                            type="checkbox"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                        />
                        Show acknowledged
                    </label>

                    <label className="flex items-center gap-2 text-white/80">
                        Sort:
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as "recent" | "severity")}
                            className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-white/90"
                        >
                            <option value="recent">Most recent</option>
                            <option value="severity">Severity</option>
                        </select>
                    </label>

                    <div className="text-white/60">{view.length} shown</div>
                </div>
            </header>

            {view.length === 0 ? (
                <div className="text-white/70">
                    {alerts.length === 0
                        ? "No alerts yet."
                        : showAcknowledged
                          ? "No alerts (all acknowledged)."
                          : "No unacknowledged alerts."}
                </div>
            ) : (
                <div className="grid gap-4">
                    {view.map((a) => (
                        <AlertCard
                            key={a.id}
                            id={a.id}
                            title={a.title}
                            severity={a.severity}
                            source={a.source}
                            timestamp={a.timestamp}
                            description={a.description}
                            tags={a.tags}
                            acknowledged={a.acknowledged}
                            onAcknowledge={(id) => {
                                if (id) acknowledge(id);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
