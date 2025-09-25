// src/components/Header.tsx
import { NavLink } from "react-router-dom";

const navLinkClass =
    "px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-neutral-800/60";
const activeClass = "bg-neutral-800";

export default function Header() {
    return (
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                    <h1 className="text-lg font-semibold tracking-wide">
                        Sentinel Hive
                    </h1>
                </div>

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
            </div>
        </header>
    );
}
