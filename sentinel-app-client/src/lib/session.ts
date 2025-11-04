import { addAlert, Alert as AlertType } from "./alertsStore";
import { UserData } from "@/types/types";
import { addPopup as addPopupToStore } from "./popupsStore";

let _baseURL =
    (typeof localStorage !== "undefined" && localStorage.getItem("svh.baseUrl")) ||
    "http://127.0.0.1:5167";
let _token: string | null = null;
let userData: UserData | null = null;

// Try to restore persisted session from localStorage so refreshing the page
// doesn't log the user out. Keys: svh.token, svh.user
if (typeof localStorage !== "undefined") {
    try {
        const saved = localStorage.getItem("svh.token");
        if (saved) _token = saved;

        const u = localStorage.getItem("svh.user");
        if (u) {
            userData = JSON.parse(u) as UserData;
            // If token wasn't stored separately, try to recover it from the saved user object
            if ((!_token || _token === "") && userData?.token) {
                _token = userData.token;
            }
        }
    } catch (e) {
        // ignore parse errors and continue with empty session
        _token = null;
        userData = null;
    }
}

function loadSessionFromStorage() {
    if (typeof localStorage === "undefined") return;
    try {
        // restore base URL too if present
        if (!_baseURL) {
            const savedBase = localStorage.getItem("svh.baseUrl");
            if (savedBase) _baseURL = savedBase;
        }
        if (!_token) {
            const saved = localStorage.getItem("svh.token");
            if (saved) _token = saved;
        }
        if (!userData) {
            const u = localStorage.getItem("svh.user");
            if (u) {
                userData = JSON.parse(u) as UserData;
                if ((!_token || _token === "") && userData?.token) {
                    _token = userData.token;
                }
            }
        }
    } catch {
        _token = null;
        userData = null;
    }
}

/**
 * Restore session values (token, userData, baseURL) into module memory from
 * localStorage. Returns the restored userData (or null).
 */
export function restoreSession(): UserData | null {
    loadSessionFromStorage();
    return userData;
}

function clearSessionStorage() {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem("svh.token");
            localStorage.removeItem("svh.user");
        }
    } catch {
        // ignore
    }
}
function normalizeBaseURL(input: string): string {
    let s = (input || "").trim();
    if (!s) throw new Error("Server address is required");
    if (!/^https?:\/\//i.test(s)) s = "http://" + s; // default http
    const u = new URL(s);
    if (!u.port) u.port = "5167"; // default port
    // strip trailing slash
    return u.toString().replace(/\/+$/, "");
}

export function setBaseURL(url: string) {
    _baseURL = normalizeBaseURL(url);

    localStorage.setItem("svh.baseUrl", _baseURL);
}

export function getBaseURL() {
    return _baseURL;
}

export function getToken() {
    if (!_token) loadSessionFromStorage();
    return _token;
}

export function isAuthenticated() {
    if (!_token) loadSessionFromStorage();
    return !!_token;
}

export function getUserData() {
    if (!userData) loadSessionFromStorage();
    return userData;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(_baseURL + path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) {
        let msg = res.statusText;

        const j: unknown = await res.json();
        if (j && typeof j === "object" && "detail" in j) {
            const d = (j as { detail?: unknown }).detail;
            msg = typeof d === "string" ? d : JSON.stringify(d);
        } else {
            msg = JSON.stringify(j);
        }

        throw new Error(`${res.status} ${msg}`);
    }
    try {
        return (await res.json()) as T;
    } catch {
        return {} as T;
    }
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers || {});
    // make sure in-memory session and base URL are loaded before making request
    loadSessionFromStorage();
    // if token still missing, try reading directly from localStorage
    try {
        if ((!_token || _token === "") && typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("svh.token");
            if (saved) _token = saved;
            else {
                const u = localStorage.getItem("svh.user");
                if (u) {
                    try {
                        const parsed = JSON.parse(u) as UserData;
                        if (parsed?.token) _token = parsed.token;
                    } catch {
                        // ignore
                    }
                }
            }
        }
    } catch {
        // ignore storage errors
    }

    if (_token) headers.set("Authorization", `Bearer ${_token}`);

    // (debug logging removed)

    const res = await fetch(_baseURL + path, { ...init, headers });
    if (res.status === 401) {
        const www = res.headers.get("WWW-Authenticate") || "";
        let invalid = /invalid_token|error="?invalid_token"?/i.test(www);
        // drop invalid token so future calls don't reuse it
        _token = null;
        clearSessionStorage();
        if (!invalid) {
            try {
                const clone = res.clone();
                const j = await clone.json();
                invalid = j?.error === "invalid_token" || j?.code === "token_invalid";
            } catch {
                /* non-JSON or no clue */
            }
        }

        if (invalid) {
            _token = null;
            clearSessionStorage();
        }
    }
    return res;
}

export async function ping(): Promise<boolean> {
    try {
        await jsonFetch<{ ok: boolean }>("/health/ready");
        return true;
    } catch {
        return false;
    }
}

export async function login(opts: {
    baseUrl: string;
    userId: string;
    password: string;
    ttl?: number;
}) {
    setBaseURL(opts.baseUrl);
    const res = await jsonFetch<UserData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
            user_id: opts.userId,
            password: opts.password,
            ttl: opts.ttl ?? 3600,
        }),
    });
    _token = res.token;
    userData = res;
    try {
        if (typeof localStorage !== "undefined") {
            // Only persist a non-empty token. Some responses may omit a token
            // (or include an empty string); don't store empty tokens as that
            // later appears as a falsy value and confuses restore logic.
            if (_token) {
                localStorage.setItem("svh.token", _token);
            } else {
                localStorage.removeItem("svh.token");
            }
            localStorage.setItem("svh.user", JSON.stringify(userData));
        }
    } catch {
        // ignore storage errors
    }
    attachLogoutOnClose();
    return res;
}

export async function logout() {
    // Load persisted session if needed
    if (!_token || !userData) {
        loadSessionFromStorage();
    }

    // Optimistically clear local and in-memory session so the UI and other
    // modules don't rehydrate the session during logout. We will still
    // attempt to notify the server, but treat logout as successful locally
    // regardless of the network result.
    const tokenToSend = _token;
    const userToSend = userData;

    _token = null;
    userData = null;
    clearSessionStorage();

    if (!tokenToSend || !userToSend) {
        // Nothing to send to server; succeed locally
        return { response: true };
    }

    try {
        // best-effort notify server; don't fail the logout locally if this errors
        await jsonFetch<{ ok: boolean }>("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ user_id: userToSend.user_id, token: tokenToSend }),
        });
    } catch (e) {
        // ignore network errors — logout already cleared locally
        console.error("logout: server notification failed", e);
    }

    return { response: true };
}

let _closeHookAttached = false;
function attachLogoutOnClose() {
    if (_closeHookAttached) return;
    _closeHookAttached = true;

    // Tauri close hook (optional)

    // Optional Tauri window API: not present in web builds. Guard access to avoid
    // throwing when the module or `appWindow` is not available.
    import("@tauri-apps/api/window")
        .then((mod) => {
            try {
                const appWindow = (mod as any)?.appWindow;
                if (appWindow && typeof appWindow.onCloseRequested === "function") {
                    appWindow.onCloseRequested(async () => {
                        await logout();
                    });
                }
            } catch {
                // ignore runtime errors from optional API
            }
        })
        .catch(() => {
            // ignore failure to import the optional module
        });

    // Browser/webview fallback
    if (typeof window !== "undefined") {
        // Do not automatically logout or clear persisted session on page unload.
        // Previously we attempted to POST /auth/logout and clear localStorage here
        // which caused the token to be removed on simple page refreshes. That
        // behavior is undesirable for browser reloads. Keep the hook no-op for
        // web builds. Explicit logout should be performed via the UI.
    }
}

type PopupMessage = { type: "popup"; text: string };
type ErrorMessage = { type: "error"; detail: string };
type ServerMessage = PopupMessage | ErrorMessage | AlertType | Record<string, unknown>;

let _websocket: WebSocket | null = null;
let _websocketUrl: string | null = null;

const _wsHandlers = new Set<(msg: unknown) => void>();
const _wsOpenHandlers = new Set<(open: boolean) => void>();
let _wsOpen = false;

function _emitWsOpen(open: boolean) {
    _wsOpen = open;
    for (const fn of _wsOpenHandlers) {
        try {
            fn(open);
        } catch (e) {
            // no-op: avoid failing other handlers
            console.error(e);
        }
    }
}

export function isWebsocketOpen() {
    return _wsOpen;
}
export function onWebsocketOpen(fn: (open: boolean) => void) {
    _wsOpenHandlers.add(fn);
    return () => _wsOpenHandlers.delete(fn);
}

function makeWebsocketUrl(base: string, token: string) {
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/websocket";
    u.search = `token=${encodeURIComponent(token)}`;
    return u.toString();
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function isAlertMessage(v: unknown): v is AlertType {
    return isRecord(v) && v["type"] === "alert";
}

export function connectWebsocket() {
    if (!_token) {
        console.warn("[WS] No token — cannot connect");
        return;
    }

    const url = makeWebsocketUrl(_baseURL, _token);
    console.log("[WS] Attempting connection:", url);

    try {
        _websocket?.close();
    } catch {
        // no-op
    }

    const ws = new WebSocket(url);
    _websocket = ws;
    _websocketUrl = url;

    ws.onopen = () => {
        console.log("[WS] onopen");
        _emitWsOpen(true);
        // intentionally NOT sending a "hello" message
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBufferLike | Blob>) => {
        console.log("[WS] onmessage raw:", ev.data);

        let delivered: unknown = ev.data;

        if (typeof ev.data === "string") {
            try {
                const parsed = JSON.parse(ev.data) as ServerMessage;
                delivered = parsed;

                // Alerts: feed alert store (already present)
                if (isAlertMessage(parsed)) {
                    try {
                        addAlert(parsed);
                    } catch {}

                    // NEW: Popups — feed global popup store so every client reacts
                } else if ((parsed as any)?.type === "popup") {
                    const txt = (parsed as any)?.text ?? "";
                    try {
                        addPopupToStore(String(txt));
                    } catch {}
                }
            } catch {
                // non-JSON; ignore
            }
        }

        for (const fn of _wsHandlers) {
            try {
                fn(delivered);
            } catch (e) {
                console.error(e);
            }
        }
    };

    ws.onclose = (e: CloseEvent) => {
        console.log("[WS] onclose code=", e.code, "reason=", e.reason);
        _emitWsOpen(false);
    };

    ws.onerror = (e: Event) => {
        console.error("[WS] onerror:", e);
    };
}

export function websocketSend(message: unknown) {
    if (!_websocket || _websocket.readyState !== WebSocket.OPEN) {
        console.warn("[WS] send() called but socket not open");
        return;
    }
    console.log("[WS] sending:", message);
    _websocket.send(JSON.stringify(message));
}

export function onWebsocketMessage(fn: (msg: unknown) => void) {
    _wsHandlers.add(fn);
    return () => _wsHandlers.delete(fn);
}

export function closeWebsocket() {
    console.log("[WS] manual close");
    try {
        _websocket?.close();
    } catch {
        // no-op
    }
    _emitWsOpen(false);
}

export function getWebsocketDebugUrl(): string {
    if (_websocketUrl) return _websocketUrl;
    if (_baseURL && _token) {
        const u = new URL(_baseURL);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        u.pathname = "/websocket";
        u.search = `token=${encodeURIComponent(_token)}`;
        return u.toString();
    }
    return "(not initialized)";
}
