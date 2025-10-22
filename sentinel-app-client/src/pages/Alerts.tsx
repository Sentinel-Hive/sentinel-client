import AlertCard from "../components/AlertCard";
import { useAlerts } from "../lib/alertsStore";

export default function Alerts() {
    const alerts = useAlerts(); // live

    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            <header className="flex items-end justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Alerts</h2>
                <div className="text-sm text-white/60">{alerts.length} total</div>
            </header>

            {alerts.length === 0 ? (
                <div className="text-white/70">No alerts yet.</div>
            ) : (
                <div className="grid gap-4">
                    {alerts.map((a) => (
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
                                // optional: update store; server-side ack can come later
                                // import { acknowledge } from "../lib/alertsStore" if you want
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
