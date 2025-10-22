import { addAlert, Alert as AlertType } from "./alertsStore";

let _baseURL =
    (typeof localStorage !== "undefined" && localStorage.getItem("svh.baseUrl")) ||
    "http://127.0.0.1:5167";
let _token: string | null = null;

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
    return _token;
}

export function isAuthenticated() {
    return !!_token;
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
    if (_token) headers.set("Authorization", `Bearer ${_token}`);
    const res = await fetch(_baseURL + path, { ...init, headers });
    if (res.status === 401) _token = null; // drop invalid token
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

type LoginResult = { token: string };

export async function login(opts: {
    baseUrl: string;
    userId: string;
    password: string;
    ttl?: number;
}) {
    setBaseURL(opts.baseUrl);
    const out = await jsonFetch<LoginResult>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
            user_id: opts.userId,
            password: opts.password,
            ttl: opts.ttl ?? 3600,
        }),
    });
    _token = out.token;
    attachLogoutOnClose();
    return out;
}

export async function logout() {
    if (!_token) return;
    try {
        await jsonFetch<{ ok: boolean }>("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ token: _token }),
        });
    } catch {
        // ignore network errors on best-effort logout
    } finally {
        _token = null;
    }
}

let _closeHookAttached = false;
function attachLogoutOnClose() {
    if (_closeHookAttached) return;
    _closeHookAttached = true;

    // Tauri close hook (optional)

    // @ts-expect-error Optional Tauri window API: not present in web builds TODO: Kaliegh tell me if this is wrong.
    import("@tauri-apps/api/window").then(({ appWindow }) => {
        appWindow.onCloseRequested(async () => {
            await logout();
        });
    });

    // Browser/webview fallback
    if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => {
            if (!_token) return;

            fetch(_baseURL + "/auth/logout", {
                method: "POST",
                keepalive: true,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: _token }),
            });

            _token = null;
        });
    }
}

let _websocket: WebSocket | null = null;
let _websocketUrl: string | null = null;
const _wsHandlers = new Set<(msg: any) => void>();
let _wsOpenHandlers = new Set<(open: boolean) => void>();
let _wsOpen = false;

function _emitWsOpen(open: boolean) {
    _wsOpen = open;
    for (const fn of _wsOpenHandlers)
        try {
            fn(open);
        } catch (e) {
            console.error(e);
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

export function connectWebsocket() {
    if (!_token) {
        console.warn("[WS] No token — cannot connect");
        return;
    }

    const url = makeWebsocketUrl(_baseURL, _token);
    console.log("[WS] Attempting connection:", url);

    try {
        _websocket?.close();
    } catch {}

    const ws = new WebSocket(url);
    _websocket = ws;
    _websocketUrl = url;

    ws.onopen = () => {
        console.log("[WS] onopen");
        _emitWsOpen(true);
        try {
            ws.send(JSON.stringify({ type: "hello", client: "sentinel-client" }));
            console.log("[WS] sent hello");
        } catch (e) {
            console.error("[WS] send hello failed:", e);
        }
    };

    ws.onmessage = (ev) => {
        console.log("[WS] onmessage raw:", ev.data);
        let msg: any;
        try {
            msg = JSON.parse(ev.data);
            if (msg && msg.type === "alert") {
                // Basic runtime shape check; trust server fields
                const alert = msg as AlertType;
                try {
                    addAlert(alert);
                } catch {}
            }
        } catch {
            msg = ev.data;
        }
        for (const fn of _wsHandlers) {
            try {
                fn(msg);
            } catch (e) {
                console.error(e);
            }
        }
    };

    ws.onclose = (e) => {
        console.log("[WS] onclose code=", e.code, "reason=", e.reason);
        _emitWsOpen(false);
    };

    ws.onerror = (e) => {
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

export function onWebsocketMessage(fn: (msg: any) => void) {
    _wsHandlers.add(fn);
    return () => _wsHandlers.delete(fn);
}

export function closeWebsocket() {
    console.log("[WS] manual close");
    try {
        _websocket?.close();
    } catch {}
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
