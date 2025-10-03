// src/components/Header.tsx
import { useNavigate, NavLink } from "react-router-dom";
import {
    RotateCw,
    Bell,
    CircleUserRound,
    User as UserIcon,
    LogIn,
    LogOut,
    Crown,
    Info,
} from "lucide-react";
import { toast } from "sonner";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import AlertNotification, { Severity } from "./AlertNotification";

const navLinkClass = "px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-neutral-800/60";
const activeClass = "bg-neutral-800";

type Notification = {
    id: string;
    severity: Severity;
    timestamp: string;
    description: string;
};

export default function Header() {
    // example notifications
    const notifications: Notification[] = [
        {
            id: "n1",
            severity: "high",
            timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(), // 7m ago
            description: "High latency detected in api-gateway (p95 > 1.2s).",
        },
        {
            id: "n2",
            severity: "critical",
            timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 65m ago
            description: "Error spike: 5xx > 4% in us-east-1. Auto-mitigation paused.",
        },
        {
            id: "n3",
            severity: "medium",
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
            description: "Disk usage warning on log-storage-03 (78%).",
        },
    ];

    const user: { id: string; name: string } | null = { id: "u1", name: "Ada" };
    const notImplemented = () => toast.info("This is not implemented yet");
    const handleAccountClick = () => toast.info("Open Account settings (stub)");
    const handleLogoutClick = () => toast.success("Logged out (stub)");
    const handleBecomeHostClick = () => toast.info("Become Host (stub)");
    const handleHelpClick = () => toast.info("Open Help (stub)");
    const handleLoginClick = () => toast.info("Open Login dialog (stub)");

    const navigate = useNavigate();

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
                                                    />
                                                </div>
                                            </DropdownMenu.Item>
                                        ))}
                                    </div>
                                )}

                                <DropdownMenu.Separator className="my-1 h-px bg-neutral-800" />
                                <DropdownMenu.Item
                                    onSelect={() => navigate("/alerts")}
                                    className="flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800"
                                >
                                    View all alerts
                                </DropdownMenu.Item>
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
                                        handleBecomeHostClick();
                                    }}
                                    className="md:hidden flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800 text-yellow-400"
                                >
                                    <Crown className="h-4 w-4 text-yellow-400" /> Become Host
                                </DropdownMenu.Item>
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
