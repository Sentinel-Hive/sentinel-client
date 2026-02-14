import { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { FolderSync, Bell, Settings } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import AlertNotification, { Severity } from "./AlertNotification";
import { useAlerts, onAlertAdded } from "../lib/alertsStore";
import { useUser, useUserStore } from "../store/userStore";
import { logout } from "../lib/session";
import { loadAllDatasets } from "@/lib/dataHandler";
import { onPopupAdded } from "../lib/popupsStore";
import { Button } from "./ui/button";

const navLinkClass = "px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-neutral-800/60";
const activeClass = "bg-neutral-800";

export default function Header() {
    const alerts = useAlerts();

    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        const off = onPopupAdded((p) => {
            toast(p.text, { duration: 2000 });
        });
        return () => {
            off();
        };
    }, []);

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

    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                await loadAllDatasets();
            } catch {
                const time = Date.now();
                toast.error(`Unable to Sync with database: ${time}`);
            }
        }, 10_000);

        return () => clearInterval(intervalId);
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

    const user = useUser();
    const navigate = useNavigate();
    const setLoggingOut = useUserStore((s) => s.setLoggingOut);
    const setJustLoggedOut = useUserStore((s) => s.setJustLoggedOut);

    const handleLogoutClick = async () => {
        setLoggingOut(true);
        setJustLoggedOut(true);
        try {
            const res = await logout();
            if (res?.response) {
                toast.success("Logged out");
            } else {
                throw new Error("An error occurred while logging out.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            useUserStore.getState().clearUser();
            navigate("/login");
            setLoggingOut(false);
            setTimeout(() => setJustLoggedOut(false), 800);
        }
    };

    const handleSyncClick = async () => {
        try {
            await loadAllDatasets();
            toast.success(`Synced all database record(s)`);
        } catch {
            toast.error("Unable to sync records. Please try again later.");
        }
    };

    const handleAdminSettingsClick = () => {
        navigate("/admin");
    };

    return (
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
                    {user?.is_admin && (
                        <NavLink
                            to="/socket"
                            className={({ isActive }) =>
                                `${navLinkClass} ${isActive ? activeClass : ""}`
                            }
                        >
                            Socket
                        </NavLink>
                    )}
                </nav>
                <span></span>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => handleSyncClick()}
                        aria-label="Refresh"
                        className="hover:text-yellow-500 inline-flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700 [&_svg]:h-5 [&_svg]:w-5 text-gray-300"
                    >
                        <FolderSync />
                    </Button>

                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                aria-label="Notifications"
                                className="hover:text-yellow-500 inline-flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700 [&_svg]:h-5 [&_svg]:w-5 text-gray-300"
                            >
                                <Bell className="h-4 w-4" />
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
                                                        onDismiss={() => dismissOne(n.id)}
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
                                            clearAll();
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

                    {user?.is_admin && (
                        <Button
                            variant="ghost"
                            className="hover:text-yellow-500 inline-flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-700 [&_svg]:h-5 [&_svg]:w-5 text-gray-300"
                            onClick={() => handleAdminSettingsClick()}
                        >
                            <Settings />
                        </Button>
                    )}

                    <Button
                        className="bg-red-700 hover:bg-red-600"
                        onClick={() => handleLogoutClick()}
                    >
                        Logout
                    </Button>
                </div>
            </div>
        </header>
    );
}
