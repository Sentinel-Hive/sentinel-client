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

const newAlertListeners = new Set<(a: Alert) => void>();
function emitNew(a: Alert) {
    for (const l of newAlertListeners) l(a);
}

export function onAlertAdded(fn: (a: Alert) => void) {
    newAlertListeners.add(fn);
    return () => newAlertListeners.delete(fn);
}

export function addAlert(a: Alert) {
    if (a.id && _alerts.some((x) => x.id === a.id)) return;
    _alerts = [a, ..._alerts].slice(0, 200);
    emit();
    emitNew(a);
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
