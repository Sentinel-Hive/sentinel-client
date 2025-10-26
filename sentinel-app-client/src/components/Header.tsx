// src/components/Header.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
    RotateCw,
    Bell,
    CircleUserRound,
    User as UserIcon,
    LogIn,
    LogOut,
    Info,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import AlertNotification, { Severity } from "./AlertNotification";
import { useAlerts, onAlertAdded } from "../lib/alertsStore";

const navLinkClass = "px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-neutral-800/60";
const activeClass = "bg-neutral-800";

export default function Header() {
    const alerts = useAlerts();

    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        const off = onAlertAdded((a) => {
            const sev = (a.severity || "medium").toUpperCase();
            toast(`${sev}: ${a.title}`, {
                description: a.description,
                duration: 2500,
            });
        });
        return () => {
            off();
        };
    }, []);

    const notifications = useMemo(() => {
        return alerts
            .filter((a) => !dismissed.has(a.id))
            .slice(0, 10)
            .map((a) => ({
                id: a.id,
                severity: a.severity as Severity,
                timestamp: a.timestamp,
                description: a.description || a.title,
            }));
    }, [alerts, dismissed]);

    const clearAll = () => setDismissed(new Set(alerts.map((a) => a.id)));
    const dismissOne = (id: string) => setDismissed((prev) => new Set([...prev, id]));

    const user: { id: string; name: string } | null = { id: "u1", name: "Ada" };
    const navigate = useNavigate();
    const notImplemented = () => toast.info("This is not implemented yet");
    const handleAccountClick = () => toast.info("Open Account settings (stub)");
    const handleLogoutClick = () => {
        toast.success("Logged out");
        navigate("/login");
    };
    const handleHelpClick = () => toast.info("Open Help (stub)");
    const handleLoginClick = () => toast.info("Open Login dialog (stub)");

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
                    <NavLink
                        to="/dev"
                        className={({ isActive }) =>
                            `${navLinkClass} ${isActive ? activeClass : ""}`
                        }
                    >
                        Dev
                    </NavLink>
                </nav>

                {/* Right: actions */}
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

                    {/* Notifications dropdown */}
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                aria-label="Notifications"
                                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700"
                            >
                                <Bell className="h-4 w-4" />
                                <span className="hidden sm:inline">Notifications</span>
                                {notifications.length > 0 && (
                                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10px] font-bold text-[hsl(var(--primary-foreground))]">
                                        {notifications.length}
                                    </span>
                                )}
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="end"
                                sideOffset={12}
                                className="z-50 w-80 rounded-xl border border-neutral-800 bg-neutral-900 p-1 text-neutral-200 shadow-lg outline-none"
                            >
                                {notifications.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-white/70">
                                        No new notifications
                                    </div>
                                ) : (
                                    <div className="max-h-96 overflow-auto">
                                        {notifications.map((n) => (
                                            <DropdownMenu.Item
                                                key={n.id}
                                                onSelect={(e) => e.preventDefault()}
                                                className="rounded-lg focus:bg-transparent focus:outline-none"
                                                asChild
                                            >
                                                <div>
                                                    <AlertNotification
                                                        id={n.id}
                                                        severity={n.severity}
                                                        timestamp={n.timestamp}
                                                        description={n.description}
                                                        onDismiss={() => dismissOne(n.id)} // per-item dismiss
                                                    />
                                                </div>
                                            </DropdownMenu.Item>
                                        ))}
                                    </div>
                                )}

                                <DropdownMenu.Separator className="my-1 h-px bg-neutral-800" />
                                <div className="flex items-center justify-between gap-2 px-2 pb-1">
                                    <DropdownMenu.Item
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            clearAll(); // Clear all notifications (local)
                                        }}
                                        className="flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                    >
                                        Clear all
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item
                                        onSelect={() => navigate("/alerts")}
                                        className="flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                    >
                                        View all alerts
                                    </DropdownMenu.Item>
                                </div>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>

                    {/* Profile dropdown */}
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700"
                            >
                                <CircleUserRound className="h-5 w-5" />
                                <span className="hidden sm:inline">Profile</span>
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="end"
                                sideOffset={16}
                                className="z-50 min-w-44 rounded-xl border border-neutral-800 bg-neutral-900 p-1 text-neutral-200 shadow-lg outline-none"
                            >
                                {user ? (
                                    <>
                                        <DropdownMenu.Item
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                handleAccountClick();
                                            }}
                                            className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                        >
                                            <UserIcon className="h-4 w-4" /> Account
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                handleLogoutClick();
                                            }}
                                            className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                        >
                                            <LogOut className="h-4 w-4 text-red-500" />
                                            <span className="text-red-500">Log Out</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Separator className="my-1 h-px bg-neutral-800" />
                                    </>
                                ) : (
                                    <>
                                        <DropdownMenu.Item
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                handleLoginClick();
                                            }}
                                            className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                        >
                                            <LogIn className="h-4 w-4 text-green-500" />
                                            <span className="text-green-500">Log In</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Separator className="my-1 h-px bg-neutral-800" />
                                    </>
                                )}

                                <DropdownMenu.Item
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        handleHelpClick();
                                    }}
                                    className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                >
                                    <Info className="h-4 w-4" /> Help
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
            </div>
        </header>
    );
}
