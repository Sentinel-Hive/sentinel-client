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

type Severity = "critical" | "high" | "medium" | "low";

export default function Dev() {
    const [wsReady, setWsReady] = useState(isWebsocketOpen());
    const [token, setToken] = useState<string | null>(getToken());

    // Alert form state
    const [title, setTitle] = useState("Test Alert");
    const [severity, setSeverity] = useState<Severity>("high");
    const [description, setDescription] = useState("This is a test alert from Dev page");
    const [tags, setTags] = useState("dev, test");

    // Optional popup preview
    const [popup, setPopup] = useState<string | null>(null);

    useEffect(() => {
        // keep status in sync
        const offOpen = onWebsocketOpen((open) => {
            setWsReady(open);
            setToken(getToken());
        });
        // log any incoming messages (and surface popups)
        const offMsg = onWebsocketMessage((msg: any) => {
            if (msg?.type === "popup") {
                setPopup(msg.text ?? JSON.stringify(msg));
            }
        });
        return () => {
            offOpen?.();
            offMsg?.();
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

    function sendTestAlert() {
        websocketSend({
            type: "dev_alert",
            title,
            severity,
            source: "dev",
            description,
            tags: parseTags(tags),
        });
    }

    function testPopup() {
        setPopup("Local popup test from Dev page");
    }

    return (
        <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 720 }}>
            <h1>Dev</h1>

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

            <fieldset
                style={{
                    border: "1px solid #333",
                    borderRadius: 12,
                    padding: 16,
                    display: "grid",
                    gap: 12,
                }}
            >
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

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
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

                <label style={{ display: "grid", gap: 4 }}>
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

                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={sendTestAlert} disabled={!wsReady}>
                        Send Test Alert
                    </button>
                    <button onClick={testPopup}>Test Popup</button>
                </div>
            </fieldset>

            <Popup message={popup} onClose={() => setPopup(null)} />
        </div>
    );
}
