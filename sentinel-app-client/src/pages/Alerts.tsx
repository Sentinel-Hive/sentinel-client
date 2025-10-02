import AlertCard from "../components/AlertCard";

export default function Alerts() {
    const example = {
        id: "evt-9YH27",
        title: "Spike in 5xx errors on api-gateway",
        severity: "high" as const,
        source: "nginx@edge-us-east-1",
        timestamp: new Date().toISOString(),
        description:
            "Error rate exceeded 3% over 5 minutes. Upstream timeouts likely. Auto-mitigation paused for manual review.",
        tags: ["api", "errors", "gateway"],
    };

    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            <header className="flex items-end justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">
                    Alerts
                </h2>
                <div className="text-sm text-white/60">
                    Example preview
                </div>
            </header>

            <div className="grid gap-4">
            <AlertCard {...example} />
            <AlertCard {...example} />
            <AlertCard {...example} />
            </div>
        </div>
    );
}
