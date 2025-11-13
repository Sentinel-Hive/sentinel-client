// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HashRouter } from "react-router-dom";
import "./global.css";
import { restoreSession } from "./lib/session";
import { useUserStore } from "./store/userStore";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <HashRouter>
            {(() => {
                try {
                    // Ensure the session module restores in-memory token/user before we
                    // populate the zustand store. This guarantees authFetch will include
                    // the Authorization header for components that mount immediately.
                    const u = restoreSession();
                    if (u) useUserStore.getState().setUser(u);
                } catch {
                    /* ignore */
                }
                return <App />;
            })()}
        </HashRouter>
    </React.StrictMode>
);
