// Simple in-memory event store for popups (broadcast or otherwise)
import { useSyncExternalStore } from "react";

export type PopupItem = {
    id: string; // optional unique id; we’ll generate client-side
    text: string;
    timestamp: string; // ISO
};

let _popups: PopupItem[] = [];
const listeners = new Set<() => void>();
const newPopupListeners = new Set<(p: PopupItem) => void>();

function emit() {
    for (const l of listeners) l();
}
function emitNew(p: PopupItem) {
    for (const l of newPopupListeners) l(p);
}

export function onPopupAdded(fn: (p: PopupItem) => void) {
    newPopupListeners.add(fn);
    return () => {
        newPopupListeners.delete(fn);
    };
}

export function addPopup(text: string) {
    const p: PopupItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        text,
        timestamp: new Date().toISOString(),
    };
    _popups = [p, ..._popups].slice(0, 200);
    emit();
    emitNew(p);
}

export function getPopups() {
    return _popups;
}

export function subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function usePopups() {
    return useSyncExternalStore(subscribe, getPopups, getPopups);
}
