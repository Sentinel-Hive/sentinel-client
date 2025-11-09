import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import Analytics from "./pages/Analytics";
import Datasets from "./pages/Datasets";
import Alerts from "./pages/Alerts";
import Login from "./pages/Login";
import Socket from "./pages/Socket";
import Admin from "./pages/Admin";
import { Toaster } from "sonner";
import { useUser } from "./store/userStore";
import { useEffect } from "react";

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const isLoginPage = ["/", "/login"].includes(location.pathname);
    const user = useUser();
    useEffect(() => {
        if (!user || user == null) {
            navigate("/login");
        }
    }, [user]);

    return (
        <div className="min-h-screen">
            <Toaster richColors theme="dark" position="bottom-right" />
            {!isLoginPage && <Header />}

            <main className="mx-auto max-w-6xl px-4 py-8">
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    <Route path="/login" element={<Login />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/datasets" element={<Datasets />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/socket" element={<Socket />} />

                    {/* 404 */}
                    <Route
                        path="*"
                        element={<div className="text-sm text-neutral-400">Page not found.</div>}
                    />
                    <Route path="/admin" element={<Admin />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
