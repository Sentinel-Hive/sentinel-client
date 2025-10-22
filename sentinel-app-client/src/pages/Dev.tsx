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

export default function Dev() {
    const [text, setText] = useState("");
    const [popup, setPopup] = useState<string | null>(null);
    const [wsReady, setWsReady] = useState(isWebsocketOpen());
    const [token, setToken] = useState<string | null>(getToken());

    useEffect(() => {
        // subscribe to message events
        const offMsg = onWebsocketMessage((msg: any) => {
            console.log("[DEV] onWebsocketMessage:", msg);
            if (!msg) return;
            if (msg.type === "popup" || msg.type === "server_message" || msg.type === "echo") {
                const text = msg.text ?? msg.payload?.text ?? msg.content ?? JSON.stringify(msg);
                setPopup(text);
            }
        });

        // subscribe to open/close events
        const offOpen = onWebsocketOpen((open) => {
            console.log("[DEV] onWebsocketOpen:", open);
            setWsReady(open);
            setToken(getToken());
        });

        return () => {
            offMsg?.();
            offOpen?.();
        };
    }, []);

    function handleConnect() {
        console.log("[DEV] Connect button clicked");
        connectWebsocket();
    }

    function handleSend() {
        console.log("[DEV] Send clicked:", text);
        websocketSend({ type: "dev_popup", text });
        setText("");
    }

    function testPopup() {
        console.log("[DEV] Test popup manually");
        setPopup(text || "This is a local popup test!");
    }

    return (
        <div style={{ padding: 16 }}>
            <h1>Dev</h1>

            <div style={{ marginBottom: 8, fontSize: 12 }}>
                Websocket:{" "}
                <b style={{ color: wsReady ? "limegreen" : "red" }}>
                    {wsReady ? "connected" : "disconnected"}
                </b>{" "}
                • Token: <code>{token ? "present" : "none"}</code> • URL:{" "}
                <code>{getWebsocketDebugUrl()}</code>{" "}
                <button onClick={handleConnect}>Connect</button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type something…"
                    style={{
                        flex: 1,
                        padding: 8,
                        background: "#222",
                        border: "1px solid #444",
                        color: "white",
                    }}
                />
                <button onClick={handleSend} disabled={!wsReady}>
                    Send
                </button>
                <button onClick={testPopup}>Test Popup</button>
            </div>

            <Popup message={popup} onClose={() => setPopup(null)} />
        </div>
    );
}
