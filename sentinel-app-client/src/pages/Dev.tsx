import { useEffect, useState } from "react";
import {
    connectWebsocket,
    websocketSend,
    onWebsocketMessage,
    onWebsocketOpen,
    isWebsocketOpen,
    getToken,
    getWebsocketDebugUrl,
} from "../lib/session";
import { Popup } from "../components/Popup";

export default function Dev() {
    const [text, setText] = useState("");
    const [popup, setPopup] = useState<string | null>(null);
    const [wsReady, setWsReady] = useState(isWebsocketOpen());
    const [token, setToken] = useState<string | null>(getToken());

    useEffect(() => {
        const offMsg = onWebsocketMessage((msg: any) => {
            if (msg?.type === "popup" || msg?.type === "echo") {
                const content = msg.text ?? msg.payload?.text ?? JSON.stringify(msg);
                setPopup(content);
            }
        });
        const offOpen = onWebsocketOpen((open) => {
            setWsReady(open);
            setToken(getToken());
        });
        return () => {
            offMsg?.();
            offOpen?.();
        };
    }, []);

    function send() {
        websocketSend({ type: "dev_popup", text });
        setText("");
    }

    return (
        <div style={{ padding: 16 }}>
            <h1>Dev</h1>

            <div style={{ marginBottom: 8, fontSize: 12 }}>
                Websocket: <b>{wsReady ? "connected" : "disconnected"}</b> • Token:{" "}
                <code>{token ? "present" : "none"}</code> • URL:{" "}
                <code>{getWebsocketDebugUrl()}</code>
                {!wsReady && (
                    <button onClick={connectWebsocket} style={{ marginLeft: 8 }}>
                        Connect
                    </button>
                )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type something…"
                    style={{ flex: 1, padding: 8 }}
                />
                <button onClick={send}>Send</button>
                <button onClick={() => setPopup(text || "This is a local popup test")}>
                    Test Popup
                </button>
            </div>

            <Popup message={popup} onClose={() => setPopup(null)} />
        </div>
    );
}
