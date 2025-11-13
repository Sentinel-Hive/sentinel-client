// src/lib/session.ts
import { addAlert, Alert as AlertType } from "./alertsStore";
import { UserData } from "@/types/types";
import { addPopup as addPopupToStore } from "./popupsStore";

let _baseURL =
    (typeof localStorage !== "undefined" && localStorage.getItem("svh.baseUrl")) ||
    "http://127.0.0.1:5167";
let _token: string | null = null;
let userData: UserData | null = null;
let _tokenExpiry: number | null = null;
let _lastActivity: number = Date.now();
let _idleCheckInterval: NodeJS.Timeout | null = null;

// initial restore from localStorage
if (typeof localStorage !== "undefined") {
    try {
        const saved = localStorage.getItem("svh.token");
        if (saved) _token = saved;

        const u = localStorage.getItem("svh.user");
        if (u) {
            userData = JSON.parse(u) as UserData;
            if ((!_token || _token === "") && userData?.token) {
                _token = userData.token ?? null;
            }
        }
    } catch {
        _token = null;
        userData = null;
    }
}

function loadSessionFromStorage() {
    if (typeof localStorage === "undefined") return;
    try {
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
                    _token = userData.token ?? null;
                }
            }
        }
    } catch {
        _token = null;
        userData = null;
    }
}

export function restoreSession(): UserData | null {
    loadSessionFromStorage();
    return userData;
}

function clearSessionStorage() {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem("svh.token");
            localStorage.removeItem("svh.user");
            localStorage.removeItem("svh.token_expiry");
            localStorage.removeItem("svh.last_activity");
        }
    } catch {
        // ignore
    }
}

function normalizeBaseURL(input: string): string {
    let s = (input || "").trim();
    if (!s) throw new Error("Server address is required");
    if (!/^https?:\/\//i.test(s)) s = "http://" + s;
    const u = new URL(s);
    if (!u.port) u.port = "5167";
    return u.toString().replace(/\/+$/, "");
}

export function setBaseURL(url: string) {
    _baseURL = normalizeBaseURL(url);
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("svh.baseUrl", _baseURL);
    }
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
    loadSessionFromStorage();

    try {
        if ((!_token || _token === "") && typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("svh.token");
            if (saved) {
                _token = saved;
            } else {
                const u = localStorage.getItem("svh.user");
                if (u) {
                    try {
                        const parsed = JSON.parse(u) as UserData;
                        if (parsed?.token) _token = parsed.token ?? null;
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

    const res = await fetch(_baseURL + path, { ...init, headers });
    if (res.status === 401) {
        const www = res.headers.get("WWW-Authenticate") || "";
        let invalid = /invalid_token|error="?invalid_token"?/i.test(www);

        _token = null;
        clearSessionStorage();

        if (!invalid) {
            try {
                const clone = res.clone();
                const j = (await clone.json()) as unknown;
                if (j && typeof j === "object") {
                    const obj = j as { error?: string; code?: string };
                    invalid = obj.error === "invalid_token" || obj.code === "token_invalid";
                }
            } catch {
                // ignore
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
    const ttl = opts.ttl ?? 3600;
    const res = await jsonFetch<UserData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
            user_id: opts.userId,
            password: opts.password,
            ttl: ttl,
        }),
    });
    _token = res.token ?? null;
    userData = res;

    // Calculate and store token expiration time
    _tokenExpiry = Date.now() + (ttl * 1000);
    _lastActivity = Date.now();

    try {
        if (typeof localStorage !== "undefined") {
            if (_token) {
                localStorage.setItem("svh.token", _token);
                localStorage.setItem("svh.token_expiry", _tokenExpiry.toString());
                localStorage.setItem("svh.last_activity", _lastActivity.toString());
            } else {
                localStorage.removeItem("svh.token");
                localStorage.removeItem("svh.token_expiry");
                localStorage.removeItem("svh.last_activity");
            }
            localStorage.setItem("svh.user", JSON.stringify(userData));
        }
    } catch {
        // ignore storage errors
    }

    attachLogoutOnClose();
    startIdleTracking();
    startTokenExpirationCheck();

    return res;
}

export async function logout() {
    if (!_token || !userData) {
        loadSessionFromStorage();
    }

    const tokenToSend = _token;
    const userToSend = userData;

    // Stop all tracking intervals
    stopIdleTracking();
    stopTokenExpirationCheck();

    _token = null;
    userData = null;
    _tokenExpiry = null;
    clearSessionStorage();

    if (!tokenToSend || !userToSend) {
        return { response: true };
    }

    try {
        await jsonFetch<{ ok: boolean }>("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ user_id: userToSend.user_id, token: tokenToSend }),
        });
    } catch (err) {
        console.error("logout: server notification failed", err);
    }

    return { response: true };
}

// Constants for idle and token tracking
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const TOKEN_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const IDLE_CHECK_INTERVAL = 60 * 1000; // Check idle every 60 seconds
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh if less than 5 minutes remaining

let _tokenCheckInterval: NodeJS.Timeout | null = null;

/**
 * Update last activity timestamp when user interacts with the app
 */
function updateActivity() {
    _lastActivity = Date.now();
    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem("svh.last_activity", _lastActivity.toString());
        } catch {
            // ignore storage errors
        }
    }
}

/**
 * Start tracking user idle time and automatically logout after 5 minutes of inactivity
 */
function startIdleTracking() {
    // Clear any existing interval
    if (_idleCheckInterval) {
        clearInterval(_idleCheckInterval);
    }

    // Set up activity listeners
    if (typeof window !== "undefined") {
        const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
        events.forEach((event) => {
            window.addEventListener(event, updateActivity, { passive: true });
        });
    }

    // Check idle status periodically
    _idleCheckInterval = setInterval(() => {
        const idleTime = Date.now() - _lastActivity;

        if (idleTime >= IDLE_TIMEOUT) {
            console.log("[SESSION] Idle timeout reached - logging out");
            addPopupToStore("You have been logged out due to inactivity.");

            // Stop tracking before logout
            stopIdleTracking();
            stopTokenExpirationCheck();

            logout().then(() => {
                // Navigation handled by App component when user store is cleared
            });
        }
    }, IDLE_CHECK_INTERVAL);
}

/**
 * Stop tracking user idle time
 */
function stopIdleTracking() {
    if (_idleCheckInterval) {
        clearInterval(_idleCheckInterval);
        _idleCheckInterval = null;
    }

    // Remove activity listeners
    if (typeof window !== "undefined") {
        const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
        events.forEach((event) => {
            window.removeEventListener(event, updateActivity);
        });
    }
}

/**
 * Start checking token expiration and automatically refresh or logout
 */
function startTokenExpirationCheck() {
    // Clear any existing interval
    if (_tokenCheckInterval) {
        clearInterval(_tokenCheckInterval);
    }

    _tokenCheckInterval = setInterval(async () => {
        if (!_tokenExpiry) return;

        const timeUntilExpiry = _tokenExpiry - Date.now();

        // Token has expired
        if (timeUntilExpiry <= 0) {
            console.log("[SESSION] Token expired - logging out");
            addPopupToStore("Your session has expired. Please log in again.");

            stopTokenExpirationCheck();
            stopIdleTracking();

            await logout();
            return;
        }

        // Token is about to expire - attempt refresh
        if (timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD) {
            console.log("[SESSION] Token expiring soon - attempting refresh");
            const refreshed = await attemptTokenRefresh();

            if (!refreshed) {
                console.log("[SESSION] Token refresh failed - logging out");
                addPopupToStore("Unable to refresh your session. Please log in again.");

                stopTokenExpirationCheck();
                stopIdleTracking();

                await logout();
            }
        }
    }, TOKEN_CHECK_INTERVAL);
}

/**
 * Stop checking token expiration
 */
function stopTokenExpirationCheck() {
    if (_tokenCheckInterval) {
        clearInterval(_tokenCheckInterval);
        _tokenCheckInterval = null;
    }
}

/**
 * Attempt to refresh the authentication token
 */
async function attemptTokenRefresh(): Promise<boolean> {
    if (!_token) return false;

    try {
        const response = await authFetch("/auth/refresh", {
            method: "POST",
        });

        if (!response.ok) {
            console.error("[SESSION] Token refresh failed:", response.status);
            return false;
        }

        const data = await response.json() as { token: string; expires_in: number };

        if (data.token) {
            _token = data.token;
            _tokenExpiry = Date.now() + (data.expires_in * 1000);

            // Update localStorage
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("svh.token", _token);
                localStorage.setItem("svh.token_expiry", _tokenExpiry.toString());
            }

            console.log("[SESSION] Token refreshed successfully");
            return true;
        }

        return false;
    } catch (err) {
        console.error("[SESSION] Token refresh error:", err);
        return false;
    }
}

let _closeHookAttached = false;
function attachLogoutOnClose() {
    if (_closeHookAttached) return;
    _closeHookAttached = true;

    // this keeps TS happy even if your version of @tauri-apps/api/window has no appWindow
    type MaybeTauriWindowModule = typeof import("@tauri-apps/api/window") & {
        appWindow?: {
            onCloseRequested?: (cb: () => void | Promise<void>) => void;
        };
    };

    import("@tauri-apps/api/window")
        .then((mod) => {
            const m = mod as MaybeTauriWindowModule;
            const aw = m.appWindow;
            if (aw?.onCloseRequested) {
                aw.onCloseRequested(async () => {
                    await logout();
                });
            }
        })
        .catch(() => {
            // web build or older tauri: ignore
        });

    if (typeof window !== "undefined") {
        // no-op for browser
    }
}

type PopupMessage = { type: "popup"; text?: string };
type ErrorMessage = { type: "error"; detail: string };
type ServerMessage = PopupMessage | ErrorMessage | AlertType | Record<string, unknown>;

let _websocket: WebSocket | null = null;
let _websocketUrl: string | null = null;

const _wsHandlers = new Set<(msg: unknown) => void>();
const _wsOpenHandlers = new Set<(open: boolean) => void>();
let _wsOpen = false;

let _heartbeatTimeout: NodeJS.Timeout | null = null;
let _serverReachable = true;
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
const PING_INTERVAL = 15000; // 15 seconds

function _emitWsOpen(open: boolean) {
    _wsOpen = open;
    for (const fn of _wsOpenHandlers) {
        try {
            fn(open);
        } catch (err) {
            console.error(err);
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

function isPopupMessage(v: unknown): v is PopupMessage {
    return isRecord(v) && v["type"] === "popup";
}

function resetHeartbeatTimeout() {
    if (_heartbeatTimeout) {
        clearTimeout(_heartbeatTimeout);
    }
    _heartbeatTimeout = setTimeout(() => {
        console.error("[WS] Heartbeat timeout - server not responding");
        addPopupToStore("Server connection lost. Logging out...");

        logout().then(() => {
            if (typeof window !== "undefined") {
                window.location.href = "/login";
            }
        });
    }, HEARTBEAT_TIMEOUT);
}

function startConnectionMonitoring() {
    const healthCheckInterval = setInterval(async () => {
        try {
            const reachable = await ping();

            if (!reachable && _serverReachable) {
                _serverReachable = false;
                console.error("[CONNECTION] Server unreachable - forcing logout");

                addPopupToStore("Server connection lost. Logging out...");

                await logout();

                if (typeof window !== "undefined") {
                    window.location.href = "/login";
                }
            } else if (reachable && !_serverReachable) {
                _serverReachable = true;
            }
        } catch (e) {
            console.error("[CONNECTION] Health check error:", e);
            if (_serverReachable) {
                _serverReachable = false;
                console.error ("[CONNECTION] Health check failed - forcing logout");
                addPopupToStore("Server connection lost. Logging out ...");
                await logout();

                if (typeof window !== "undefined") {
                    window.location.href = "/login";
                }
            }
        }
    }, PING_INTERVAL)

    return healthCheckInterval;
}

let _connectionMonitorInterval: NodeJS.Timeout | null = null;
    
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

    // Clear previous heartbeat timeout if any
    if (_heartbeatTimeout) {
        clearTimeout(_heartbeatTimeout);
        _heartbeatTimeout = null;
    }

    const ws = new WebSocket(url);
    _websocket = ws;
    _websocketUrl = url;

    ws.onopen = () => {
        console.log("[WS] onopen");
        _emitWsOpen(true);
        _serverReachable = true;
        // intentionally NOT sending a "hello" message

        // Start connection monitoring
        if (!_connectionMonitorInterval) {
            _connectionMonitorInterval = startConnectionMonitoring();
        }
        
        // Start heartbeat timeout
        resetHeartbeatTimeout();
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBufferLike | Blob>) => {
        console.log("[WS] onmessage raw:", ev.data);

        let delivered: unknown = ev.data;

        if (typeof ev.data === "string") {
            try {
                const parsed = JSON.parse(ev.data) as ServerMessage;
                delivered = parsed;

                // Handle server shutdown notification
                if ((parsed as any)?.type === "server_shutdown") {
                    console.error("[WS] Server is shutting down");
                    const message = (parsed as any)?.message || "Server is shutting down";

                    // Show notification to user
                    addPopupToStore(message);

                    // Close the websocket connection
                    try{
                        _websocket?.close();
                    } catch {}

                    // Force logout
                    setTimeout(async () => {
                        await logout();
                        if (typeof window !== "undefined") {
                            window.location.href = "/login?reason=server_shutdown";
                        }
                    }, 2000);

                    return;
                }

                // Handle heartbeat response from server
                if ((parsed as any)?.type === 'heartbeat') {
                    console.log("[WS] Heartbeat received from server");
                    resetHeartbeatTimeout();
                    
                    // Respond to heartbeat
                    try {
                        websocketSend({ type: "pong", timestamp: new Date().toISOString() });
                    } catch (e) {
                        console.error("[WS] Failed to respond to heartbeat:", e);
                    }
                    return; // no further processing needed
                }

                // Alerts: feed alert store (already present)
                if (isAlertMessage(parsed)) {
                    try {
                        addAlert(parsed);
                    } catch (err) {
                        console.error("alert store push failed", err);
                    }
                } else if (isPopupMessage(parsed)) {
                    const txt = parsed.text ?? "";
                    try {
                        addPopupToStore(String(txt));
                    } catch (err) {
                        console.error("popup store push failed", err);
                    }
                }
            } catch {
                // non-JSON; ignore
            }
        }

        for (const fn of _wsHandlers) {
            try {
                fn(delivered);
            } catch (err) {
                console.error(err);
            }
        }
    };

    ws.onclose = (e: CloseEvent) => {
        console.log("[WS] onclose code=", e.code, "reason=", e.reason);
        _emitWsOpen(false);

        // Clear heartbeat timeout
        if (_heartbeatTimeout) {
            clearTimeout(_heartbeatTimeout);
            _heartbeatTimeout = null;
        }

        // If auth issue(4401), force logout
        if (e.code === 4401) {
            console.error("[WS] Connection closed: Token expired or invalid");
            addPopupToStore("Session expired. Please log in again.");

            logout().then(() => {
                if (typeof window !== "undefined") {
                    window.location.href = "/login";
                }
            });
        }

        // Server shutting down
        if (e.code === 1001) {            
            console.error('[WS] Connection closed: Server is shutting down.');
            addPopupToStore('Server is shutting down.  Please log in again later.');

            logout().then(() => {
                if (typeof window !== "undefined") {
                    window.location.href = "/login?reason=server_shutdown";
                }
            });
        }

        // Abnormal closure - possible network issues
        if (e.code === 1006){
            console.error('[WS] Connection closed abnormally. Possible network issues.');
            addPopupToStore('Connection lost due to network issues. Please check your connection.');

            logout().then(() => {
                if (typeof window !== "undefined") {
                    window.location.href = "/login?reason=network_issue";
                }
            });
        }
    };

    ws.onerror = (e: Event) => {
        console.error("[WS] onerror:", e);
        _serverReachable = false;

        // Clear heartbeat timeout
        if (_heartbeatTimeout) {
            clearTimeout(_heartbeatTimeout);
            _heartbeatTimeout = null;
        }
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

    // Clear heartbeat timeout
    if (_heartbeatTimeout) {
        clearTimeout(_heartbeatTimeout);
        _heartbeatTimeout = null;
    }

    // Clear connection monitoring interval
    if (_connectionMonitorInterval) {
        clearInterval(_connectionMonitorInterval);
        _connectionMonitorInterval = null;
    }
    
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
