import { useEffect, useState } from "react";
import {
    connectWebsocket,
    websocketSend,
    onWebsocketMessage,
    onWebsocketOpen,
    isWebsocketOpen,
    getWebsocketDebugUrl,
    getToken,
} from "../lib/session";
import { Popup } from "../components/Popup";
import { useUser } from "@/store/userStore";

type Severity = "critical" | "high" | "medium" | "low";
type PopupMsg = { type: "popup"; text?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}
function isPopupMsg(v: unknown): v is PopupMsg {
    return isRecord(v) && v["type"] === "popup";
}

export default function Socket() {
    const user = useUser();
    const [wsReady, setWsReady] = useState(isWebsocketOpen());
    const [token, setToken] = useState<string | null>(getToken());

    const [popupText, setPopupText] = useState("Hello from Dev custom popup");

    const [title, setTitle] = useState("Test Alert");
    const [severity, setSeverity] = useState<Severity>("high");
    const [description, setDescription] = useState("This is a test alert from Dev page");
    const [tags, setTags] = useState("dev, test");

    const [source, setSource] = useState("dev");
    const [adminsOnly, setAdminsOnly] = useState(false);

    const [popup, setPopup] = useState<string | null>(null);

    useEffect(() => {
        const offOpen = onWebsocketOpen((open) => {
            setWsReady(open);
            setToken(getToken());
        });
        const offMsg = onWebsocketMessage((msg: unknown) => {
            if (isPopupMsg(msg)) {
                setPopup(msg.text ?? JSON.stringify(msg));
            }
        });
        return () => {
            offOpen();
            offMsg();
        };
    }, []);

    function handleConnect() {
        connectWebsocket();
    }

    function parseTags(input: string): string[] {
        return input
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    function sendTestPopup() {
        websocketSend({ type: "dev_popup", text: popupText });
    }

    function sendTestAlert() {
        websocketSend({
            type: "dev_alert", // backend requires this
            title,
            severity,
            source,
            description,
            tags: parseTags(tags),
            admin_only: adminsOnly,
        });
    }

    if (!user?.is_admin) return null;

    return (
        <div style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
            <h1 className="text-2xl font-bold">Socket</h1>

            <div style={{ fontSize: 12 }}>
                Websocket:{" "}
                <b style={{ color: wsReady ? "limegreen" : "red" }}>
                    {wsReady ? "connected" : "disconnected"}
                </b>{" "}
                • Token: <code>{token ? "present" : "none"}</code> • URL:{" "}
                <code>{getWebsocketDebugUrl()}</code>{" "}
                <button onClick={handleConnect} style={{ marginLeft: 8 }}>
                    Connect
                </button>
            </div>

            {/* POPUP SECTION */}
            <fieldset style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
                <legend style={{ padding: "0 8px" }}>Send Test Popup</legend>

                <label style={{ display: "grid", gap: 4 }}>
                    <span>Popup text</span>
                    <input
                        value={popupText}
                        onChange={(e) => setPopupText(e.target.value)}
                        placeholder="Popup text…"
                        style={{
                            padding: 8,
                            background: "#1f1f1f",
                            border: "1px solid #444",
                            color: "#fff",
                        }}
                    />
                </label>

                <div style={{ marginTop: 8 }}>
                    <button onClick={sendTestPopup} disabled={!wsReady}>
                        Send Test Popup
                    </button>
                </div>
            </fieldset>

            {/* ALERT SECTION */}
            <fieldset style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
                <legend style={{ padding: "0 8px" }}>Send Test Alert</legend>

                <label style={{ display: "grid", gap: 4 }}>
                    <span>Title</span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Alert title"
                        style={{
                            padding: 8,
                            background: "#1f1f1f",
                            border: "1px solid #444",
                            color: "#fff",
                        }}
                    />
                </label>

                <div
                    style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "1fr 1fr",
                        marginTop: 8,
                    }}
                >
                    <label style={{ display: "grid", gap: 4 }}>
                        <span>Severity</span>
                        <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as Severity)}
                            style={{
                                padding: 8,
                                background: "#1f1f1f",
                                border: "1px solid #444",
                                color: "#fff",
                            }}
                        >
                            <option value="critical">critical</option>
                            <option value="high">high</option>
                            <option value="medium">medium</option>
                            <option value="low">low</option>
                        </select>
                    </label>

                    <label style={{ display: "grid", gap: 4 }}>
                        <span>Tags (comma-separated)</span>
                        <input
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="dev, test"
                            style={{
                                padding: 8,
                                background: "#1f1f1f",
                                border: "1px solid #444",
                                color: "#fff",
                            }}
                        />
                    </label>
                </div>

                <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                    <span>Source</span>
                    <input
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="dev"
                        style={{
                            padding: 8,
                            background: "#1f1f1f",
                            border: "1px solid #444",
                            color: "#fff",
                        }}
                    />
                </label>

                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 8,
                        fontSize: 14,
                    }}
                >
                    <input
                        type="checkbox"
                        checked={adminsOnly}
                        onChange={(e) => setAdminsOnly(e.target.checked)}
                    />
                    <span>Broadcast to {adminsOnly ? "admins only" : "everyone"}</span>
                </label>

                <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                    <span>Description</span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Describe the alert…"
                        style={{
                            padding: 8,
                            background: "#1f1f1f",
                            border: "1px solid #444",
                            color: "#fff",
                        }}
                    />
                </label>

                <div style={{ marginTop: 8 }}>
                    <button onClick={sendTestAlert} disabled={!wsReady}>
                        Send Test Alert
                    </button>
                </div>
            </fieldset>

            <Popup message={popup} onClose={() => setPopup(null)} />
        </div>
    );
}
