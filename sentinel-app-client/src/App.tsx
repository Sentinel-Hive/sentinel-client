// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Analytics from "./pages/Analytics";
import Datasets from "./pages/Datasets";
import Alerts from "./pages/Alerts";

function App() {
    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
            <Header />
            <main className="mx-auto max-w-6xl px-4 py-8">
                <Routes>
                    <Route
                        path="/"
                        element={<Navigate to="/analytics" replace />}
                    />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/datasets" element={<Datasets />} />
                    <Route path="/alerts" element={<Alerts />} />
                    {/* 404 (optional) */}
                    <Route
                        path="*"
                        element={
                            <div className="text-sm text-neutral-400">
                                Page not found.
                            </div>
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;
