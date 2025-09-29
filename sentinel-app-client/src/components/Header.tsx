// src/components/Header.tsx
import { NavLink } from "react-router-dom";
import { RotateCw, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

const navLinkClass =
    "px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-neutral-800/60";
const activeClass = "bg-neutral-800";

export default function Header() {
    const notImplemented = () => toast.info("This is not implemented yet");

    return (
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                {/* Left: nav */}
                <nav className="flex items-center gap-1">
                    <NavLink
                        to="/analytics"
                        className={({ isActive }) =>
                            `${navLinkClass} ${isActive ? activeClass : ""}`
                        }
                    >
                        Analytics
                    </NavLink>
                    <NavLink
                        to="/datasets"
                        className={({ isActive }) =>
                            `${navLinkClass} ${isActive ? activeClass : ""}`
                        }
                    >
                        Datasets
                    </NavLink>
                    <NavLink
                        to="/alerts"
                        className={({ isActive }) =>
                            `${navLinkClass} ${isActive ? activeClass : ""}`
                        }
                    >
                        Alerts
                    </NavLink>
                </nav>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={notImplemented}
                        aria-label="Refresh"
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700"
                    >
                        <RotateCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={notImplemented}
                        aria-label="Profile"
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700"
                    >
                        <UserCircle2 className="h-5 w-5" />
                        <span className="hidden sm:inline">Profile</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
