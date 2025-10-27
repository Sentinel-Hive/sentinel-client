import { useEffect } from "react";

export function Popup({ message, onClose }: { message: string | null; onClose: () => void }) {
    useEffect(() => {
        if (!message) return;
        const t = setTimeout(onClose, 2500);
        return () => clearTimeout(t);
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                padding: "10px 16px",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                background: "#111",
                color: "#fff",
                zIndex: 9999,
                fontSize: 14,
            }}
        >
            {message}
        </div>
    );
}
