let _baseURL =
    (typeof localStorage !== "undefined" && localStorage.getItem("svh.baseUrl")) ||
    "http://127.0.0.1:8000";
let _token: string | null = null;

function normalizeBaseURL(input: string): string {
    let s = (input || "").trim();
    if (!s) throw new Error("Server address is required");
    if (!/^https?:\/\//i.test(s)) s = "http://" + s; // default http
    const u = new URL(s);
    if (!u.port) u.port = "8000"; // default port
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
