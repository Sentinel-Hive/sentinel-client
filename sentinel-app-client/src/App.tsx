import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Analytics from "./pages/Analytics";
import Datasets from "./pages/Datasets";
import Alerts from "./pages/Alerts";
import Login from "./pages/Login";
import { Toaster } from "sonner";

function App() {
    const location = useLocation();

    const isLoginPage = ["/", "/login"].includes(location.pathname);
    const showHeader = !isLoginPage;

    return (
        <div className="min-h-screen">
            <Toaster richColors theme="dark" position="bottom-right" />

            {showHeader && <Header />}

            <main className="mx-auto max-w-6xl px-4 py-8">
                <Routes>
                    {/* Redirect root → analytics */}
                    <Route path="/" element={<Navigate to="/analytics" replace />} />

                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/datasets" element={<Datasets />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/login" element={<Login />} />

                    {/* 404 */}
                    <Route
                        path="*"
                        element={<div className="text-sm text-neutral-400">Page not found.</div>}
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;
