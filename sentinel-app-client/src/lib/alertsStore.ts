// src/lib/alertsStore.ts
import { useSyncExternalStore } from "react";

export type Severity = "critical" | "high" | "medium" | "low";

export type Alert = {
    id: string;
    title: string;
    severity: Severity;
    source: string;
    timestamp: string; // ISO
    description?: string;
    tags?: string[];
    acknowledged?: boolean;
};

let _alerts: Alert[] = [];
const listeners = new Set<() => void>();

function emit() {
    for (const l of listeners) l();
}

export function addAlert(a: Alert) {
    // de-dupe by id if provided
    if (a.id && _alerts.some((x) => x.id === a.id)) return;
    _alerts = [a, ..._alerts].slice(0, 200); // cap list
    emit();
}

export function acknowledge(id: string) {
    _alerts = _alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
    emit();
}

export function getAlerts() {
    return _alerts;
}

export function subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// React hook
export function useAlerts() {
    return useSyncExternalStore(subscribe, getAlerts, getAlerts);
}
