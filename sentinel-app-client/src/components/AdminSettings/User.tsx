import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useUserList, useUserListStore } from "@/store/userListStore";
import { UserData } from "@/types/types";

type CredNotice = {
    id: string;
    userId: number;
    username?: string;
    password?: string;
    createdAt: string;
};

type ErrorLike = Error | string | number | boolean | object | null | undefined;

type Detail = { detail?: string };

type ServerOut = {
    id?: number;
    user_id?: string | number;
    username?: string;
    password?: string;
    password_cleartext?: string;
    is_admin?: boolean;
    last_login?: string | null;
};

export default function UserPage() {
    const users = useUserList();
    const { addUser, removeUser, clearUsers } = useUserListStore();
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [, setError] = useState<string | null>(null);
    const [notices, setNotices] = useState<CredNotice[]>([]);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [renameTargetId, setRenameTargetId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState<string>("");
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [deleteIdentifier, setDeleteIdentifier] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("svh.userNotices");
            if (raw) setNotices(JSON.parse(raw));
        } catch (e) {
            void e;
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("svh.userNotices", JSON.stringify(notices));
        } catch (e) {
            void e;
        }
    }, [notices]);

    const formatDate = (date?: Date | null) => {
        if (!date) return "Never";
        try {
            return date.toLocaleDateString() + " " + date.toLocaleTimeString();
        } catch {
            return String(date);
        }
    };

    const showError = (title: string, e: ErrorLike) => {
        let msg: string;
        if (e instanceof Error) msg = e.message;
        else if (typeof e === "string") msg = e;
        else if (typeof e === "number" || typeof e === "boolean") msg = String(e);
        else {
            try {
                msg = JSON.stringify(e);
            } catch {
                msg = String(e);
            }
        }
        setError(msg);
        toast.error(`${title}: ${msg}`);
        console.error(title, e);
    };

    const replaceUsers = (list: UserData[]) => {
        clearUsers();
        list.forEach((u) => addUser(u));
    };

    const handleResetPassword = async (userId: number, isAdmin = false) => {
        try {
            setLoading(true);
            setError(null);
            const fresh = await fetchUserList();
            const current = fresh.find((u) => u.id === userId);
            const username = current?.username;
            if (!username) {
                toast.error(
                    "Cannot reset password: username for this user id is unknown. Refresh and try again."
                );
                setLoading(false);
                return;
            }
            const qs = isAdmin ? "?is_admin=true" : "";
            const res = await (
                await import("@/lib/session")
            ).authFetch(`/users/reset/${encodeURIComponent(username)}${qs}`, { method: "POST" });
            if (!res.ok) {
                const j = (await res.json().catch(() => null)) as Detail | null;
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out = (await res.json()) as ServerOut;
            const notice: CredNotice = {
                id: String(Date.now()) + "-reset-" + String(userId),
                userId,
                username,
                password: out.password ?? out.password_cleartext ?? undefined,
                createdAt: new Date().toISOString(),
            };
            setNotices((prev) => [notice, ...prev]);
            toast.success("Credentials added to Pending Credentials");
            try {
                await fetchUserList();
            } catch (e) {
                void e;
            }
        } catch (e) {
            showError("Failed to reset password", e as ErrorLike);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = (userId: number) => {
        (async () => {
            try {
                const fresh = await fetchUserList();
                const target = fresh.find((u) => u.id === userId);
                const identifier = target?.username ?? String(userId);
                setDeleteTargetId(userId);
                setDeleteIdentifier(identifier);
                setIsDeleteDialogOpen(true);
            } catch (e) {
                showError("Failed to prepare delete", e as ErrorLike);
            }
        })();
    };

    const confirmDelete = async () => {
        if (deleteTargetId === null || !deleteIdentifier) return;
        setIsDeleting(true);
        try {
            const session = await import("@/lib/session");
            const me = session.getUserData();
            const myUserId = me?.user_id;
            const myUsername = (me && (me.username || me.user_id)) || null;
            if (
                (myUserId != null &&
                    (String(myUserId) === String(deleteIdentifier) ||
                        String(myUserId) === String(deleteTargetId))) ||
                (myUsername && String(myUsername) === String(deleteIdentifier))
            ) {
                toast.error("You cannot delete the currently logged-in account");
                return;
            }
            let res = await session.authFetch(
                `/users/delete/${encodeURIComponent(deleteIdentifier)}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const txt = await res.text().catch(() => null);
                let parsed: Detail | null = null;
                try {
                    parsed = txt ? (JSON.parse(txt) as Detail) : null;
                } catch (e) {
                    void e;
                }
                if (res.status === 404 && deleteTargetId !== null) {
                    toast.info("Not found by username, retrying delete by numeric id...");
                    res = await session.authFetch(
                        `/users/delete/${encodeURIComponent(String(deleteTargetId))}`,
                        { method: "DELETE" }
                    );
                    if (!res.ok) {
                        const txt2 = await res.text().catch(() => null);
                        let parsed2: Detail | null = null;
                        try {
                            parsed2 = txt2 ? (JSON.parse(txt2) as Detail) : null;
                        } catch (e) {
                            void e;
                        }
                        const msg = parsed2?.detail ?? txt2 ?? `HTTP ${res.status}`;
                        throw new Error(msg);
                    }
                } else {
                    const msg = parsed?.detail ?? txt ?? `HTTP ${res.status}`;
                    throw new Error(msg);
                }
            }
            toast.success(`Deleted user ${deleteIdentifier}`);
            removeUser(deleteTargetId);
            await fetchUserList();
            setNotices((prev) => prev.filter((n) => n.userId !== deleteTargetId));
        } catch (e) {
            showError("Failed to delete user", e as ErrorLike);
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setDeleteTargetId(null);
            setDeleteIdentifier(null);
        }
    };

    const openRenameDialog = (user: UserData) => {
        setRenameTargetId(user.id);
        setRenameValue(user.username ?? "");
        setIsRenameDialogOpen(true);
    };

    const handleRenameSubmit = async () => {
        if (renameTargetId === null || !renameValue.trim()) return;
        try {
            setLoading(true);
            setError(null);
            const fresh = await fetchUserList();
            const current = fresh.find((u) => u.id === renameTargetId);
            const oldUsername = current?.username ?? "";
            if (!oldUsername) {
                toast.error(
                    "Cannot determine current username for this user. Refresh the list and try again."
                );
                setLoading(false);
                return;
            }
            const res = await (
                await import("@/lib/session")
            ).authFetch(`/users/rename`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ old_user_id: oldUsername, new_user_id: renameValue }),
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => null)) as Detail | null;
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            await res.json().catch(() => null);
            const next = users.map((u) =>
                u.id === renameTargetId ? { ...u, username: renameValue } : u
            );
            replaceUsers(next);
            setIsRenameDialogOpen(false);
            setRenameTargetId(null);
            setRenameValue("");
            toast.success(`Renamed user to ${renameValue}`);
            try {
                await fetchUserList();
            } catch (e) {
                void e;
            }
        } catch (e) {
            showError("Failed to rename user", e as ErrorLike);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        try {
            setLoading(true);
            setError(null);
            const qs = newUserIsAdmin ? "?admin=true" : "";
            const res = await (
                await import("@/lib/session")
            ).authFetch(`/users/create${qs}`, { method: "POST" });
            if (!res.ok) {
                const j = (await res.json().catch(() => null)) as Detail | null;
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out = (await res.json()) as ServerOut;
            const returnedId = out.id ?? undefined;
            const returnedUserId = out.user_id;
            const usernameFromServer =
                typeof out.username === "string"
                    ? out.username
                    : typeof returnedUserId === "string" && returnedUserId !== String(returnedId)
                      ? returnedUserId
                      : String(returnedId ?? Date.now());
            const createdUser: UserData = {
                id: returnedId ?? Date.now(),
                username: usernameFromServer,
                is_admin: out.is_admin ?? newUserIsAdmin,
                last_login: out.last_login ? out.last_login : null,
            };
            addUser(createdUser);
            setNewUserIsAdmin(false);
            setIsAddUserDialogOpen(false);
            const notice: CredNotice = {
                id: String(Date.now()) + "-create-" + String(createdUser.id),
                userId: createdUser.id,
                username: createdUser.username,
                password: out.password ?? out.password_cleartext ?? undefined,
                createdAt: new Date().toISOString(),
            };
            setNotices((prev) => [notice, ...prev]);
            try {
                const fresh = await fetchUserList();
                const found = createdUser.username
                    ? fresh.find((u) => u.username === createdUser.username)
                    : undefined;
                if (found) {
                    setNotices((prev) =>
                        prev.map((n) => (n.id === notice.id ? { ...n, userId: found.id } : n))
                    );
                }
            } catch (e) {
                void e;
            }
        } catch (e) {
            showError("Failed to create user", e as ErrorLike);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserList = async () => {
        setLoading(true);
        setError(null);
        try {
            const session = await import("@/lib/session");
            const waitForToken = async (timeoutMs = 3000) => {
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                    const t = session.getToken();
                    if (t) return true;
                    await new Promise((r) => setTimeout(r, 100));
                }
                return false;
            };
            const hasToken = await waitForToken(3000);
            if (!hasToken) throw new Error("Not authenticated");
            const res = await session.authFetch(`/users/logins`);
            if (!res.ok) {
                const j = (await res.json().catch(() => null)) as Detail | null;
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out: Array<{
                id: number;
                user_id?: string;
                is_admin?: boolean;
                last_login?: string | null;
            }> = await res.json();
            const mapped: UserData[] = out.map((r) => {
                const maybeUsername = r.user_id;
                const username =
                    typeof maybeUsername === "string" && maybeUsername.length > 0
                        ? maybeUsername
                        : String(r.id);
                return {
                    id: r.id,
                    username,
                    last_login: r.last_login ? r.last_login : undefined,
                    is_admin: r.is_admin ?? false,
                };
            });
            replaceUsers(mapped);
            return mapped;
        } catch (e) {
            showError("Failed to load users", e as ErrorLike);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!mounted) return;
            await fetchUserList();
        })();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <div className="flex flex-col w-full h-full p-5 space-y-4 border-yellow-600 border">
            <div className="absolute">
                <p className="font-bold text-3xl">User Manager</p>
            </div>
            <div className="flex justify-end">
                <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="default"
                            className="bg-yellow-500 w-fit h-fit py-3 text-black"
                        >
                            <Plus className="scale-150" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-yellow-500">Add New User</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="text-sm text-gray-600">
                                The server will create a new user and return the generated password.
                                Choose whether this user should be an admin.
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="isAdmin" className="text-right">
                                    Admin
                                </Label>
                                <div className="col-span-3 flex items-center h-full">
                                    <Checkbox
                                        id="isAdmin"
                                        checked={newUserIsAdmin}
                                        onCheckedChange={(checked) => {
                                            setNewUserIsAdmin(!!checked);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                className="bg-yellow-500 text-black"
                                onClick={handleAddUser}
                                type="submit"
                            >
                                Create User
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border max-h-[65vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">User ID</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Admin</TableHead>
                            <TableHead className="text-left">Last Login</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.id}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.is_admin ? "Yes" : "No"}</TableCell>
                                <TableCell className="text-left">
                                    {user.last_login
                                        ? formatDate(new Date(user.last_login))
                                        : "???"}
                                </TableCell>
                                <TableCell className="flex flex-row text-right space-x-2 justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResetPassword(user.id)}
                                    >
                                        Reset Password
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openRenameDialog(user)}
                                    >
                                        Rename
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="bg-red-600"
                                        size="sm"
                                        onClick={() => handleDeleteUser(user.id)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-yellow-500">Rename User</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="text-sm text-gray-600">
                            Enter a new username for the selected user.
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="rename" className="text-right">
                                Username
                            </Label>
                            <div className="col-span-3">
                                <input
                                    id="rename"
                                    className="w-full rounded border px-2 py-1 bg-neutral-900 text-white"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            className="bg-yellow-500 text-black"
                            onClick={handleRenameSubmit}
                            disabled={loading || !renameValue.trim()}
                        >
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-yellow-500">Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="text-sm text-gray-600">
                            Are you sure you want to delete <strong>{deleteIdentifier}</strong>?
                            This action cannot be undone.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            className="mr-2"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 text-white"
                            onClick={confirmDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {notices.length > 0 && (
                <div className="space-y-3">
                    <Alert className="border-yellow-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Saved locally</AlertTitle>
                        <AlertDescription>
                            Credentials shown here are stored only in this browser. Copy them now —
                            they will not be available to other admins or after clearing local data.
                        </AlertDescription>
                    </Alert>

                    <div className="rounded-md border p-4 bg-neutral-900">
                        <p className="font-semibold text-lg mb-2">Pending Credentials</p>
                        <div className="space-y-2">
                            {notices.map((n) => (
                                <div
                                    key={n.id}
                                    className="flex items-start justify-between gap-4 bg-neutral-800 p-3 rounded"
                                >
                                    <div className="flex-1">
                                        <div className="text-sm text-neutral-300">
                                            User ID:{" "}
                                            <span className="font-medium text-white">
                                                {n.userId}
                                            </span>
                                        </div>
                                        <div className="text-sm text-neutral-300">
                                            Username:{" "}
                                            <span className="font-medium text-white">
                                                {n.username ?? "-"}
                                            </span>
                                        </div>
                                        <div className="text-sm text-neutral-300">
                                            Password:{" "}
                                            <span className="font-medium text-white">
                                                {n.password ?? "-"}
                                            </span>
                                        </div>
                                        <div className="text-xs text-neutral-500 mt-1">
                                            Created: {new Date(n.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <button
                                            className="rounded bg-yellow-500 px-3 py-1 text-black text-sm"
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(
                                                        `user:${n.userId} username:${n.username ?? ""} password:${n.password ?? ""}`
                                                    );
                                                    toast.success(
                                                        "Copied credentials to clipboard"
                                                    );
                                                } catch {
                                                    toast.error("Failed to copy to clipboard");
                                                }
                                            }}
                                        >
                                            Copy creds
                                        </button>
                                        <button
                                            className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-200"
                                            onClick={() => {
                                                setNotices((prev) =>
                                                    prev.filter((x) => x.id !== n.id)
                                                );
                                            }}
                                        >
                                            Mark read
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
