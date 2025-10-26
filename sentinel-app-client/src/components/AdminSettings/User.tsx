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
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type User = {
    id: number;
    username?: string;
    is_admin?: boolean;
    last_login?: string | null;
};

type CredNotice = {
    id: string; // unique id for the notice
    userId: number;
    username?: string;
    password?: string;
    createdAt: string;
};

export default function UserPage() {
    const [userList, setUserList] = useState<User[]>([]);
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    // backend creates the username; we only need admin flag
    const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notices, setNotices] = useState<CredNotice[]>([]);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [renameTargetId, setRenameTargetId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState<string>("");
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [deleteIdentifier, setDeleteIdentifier] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // persist notices so admin can copy credentials later; clear only when marked read
    useEffect(() => {
        try {
            const raw = localStorage.getItem("svh.userNotices");
            if (raw) setNotices(JSON.parse(raw));
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("svh.userNotices", JSON.stringify(notices));
        } catch {
            // ignore
        }
    }, [notices]);

    const formatDate = (date?: string | null) => {
        if (!date) return "Never";
        try {
            const d = new Date(date);
            return d.toLocaleDateString() + " " + d.toLocaleTimeString();
        } catch {
            return String(date);
        }
    };

    const showError = (title: string, e: any) => {
        let msg: string;
        if (e instanceof Error) msg = e.message;
        else if (typeof e === "string") msg = e;
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

    const handleResetPassword = async (userId: number, isAdmin = false) => {
        try {
            setLoading(true);
            setError(null);
            // Resolve authoritative username for this id and call reset by username
            const fresh = await fetchUserList();
            const current = fresh.find((u) => u.id === userId);
            const username = current?.username;
            if (!username) {
                toast.error("Cannot reset password: username for this user id is unknown. Refresh and try again.");
                setLoading(false);
                return;
            }
            const qs = isAdmin ? "?is_admin=true" : "";
            const res = await (await import("@/lib/session")).authFetch(`/users/reset/${encodeURIComponent(username)}${qs}`, { method: "POST" });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out = await res.json();
            // out is expected to be CreateUserOut-like with cleartext password
            // Use the authoritative username we resolved earlier
            const resolvedUsername = username;
            const notice: CredNotice = {
                id: String(Date.now()) + "-reset-" + String(userId),
                userId: userId,
                username: resolvedUsername,
                password: out.password ?? (out.password_cleartext ?? undefined),
                createdAt: new Date().toISOString(),
            };
            setNotices((prev) => [notice, ...prev]);
            toast.success("Credentials added to Pending Credentials");
            // refresh authoritative user list so UI reflects server state
            try {
                await fetchUserList();
            } catch {
                // ignore
            }
        } catch (e: any) {
            showError("Failed to reset password", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = (userId: number) => {
        // open confirmation dialog with resolved identifier
        (async () => {
            try {
                const fresh = await fetchUserList();
                const target = fresh.find((u) => u.id === userId);
                const identifier = target?.username ?? String(userId);
                setDeleteTargetId(userId);
                setDeleteIdentifier(identifier);
                setIsDeleteDialogOpen(true);
            } catch (e: any) {
                showError("Failed to prepare delete", e);
            }
        })();
    };

    const confirmDelete = async () => {
        if (deleteTargetId === null || !deleteIdentifier) return;
        setIsDeleting(true);
        try {
            // Don't allow deleting the currently logged-in account
            const session = await import("@/lib/session");
            const me = session.getUserData();
            const myUserId = me?.user_id;
            if (myUserId && myUserId === deleteIdentifier) {
                toast.error("You cannot delete the currently logged-in account");
                return;
            }

            let res = await session.authFetch(`/users/delete/${encodeURIComponent(deleteIdentifier)}`, { method: "DELETE" });
            if (!res.ok) {
                // try to extract server detail
                const txt = await res.text().catch(() => null);
                let parsed: any = null;
                try {
                    parsed = txt ? JSON.parse(txt) : null;
                } catch {}

                // If server returned 404 when deleting by username, try numeric id fallback
                if (res.status === 404 && deleteTargetId !== null) {
                    toast.info("Not found by username, retrying delete by numeric id...");
                    res = await session.authFetch(`/users/delete/${encodeURIComponent(String(deleteTargetId))}`, { method: "DELETE" });
                    if (!res.ok) {
                        const txt2 = await res.text().catch(() => null);
                        let parsed2: any = null;
                        try {
                            parsed2 = txt2 ? JSON.parse(txt2) : null;
                        } catch {}
                        const msg = parsed2?.detail ?? txt2 ?? `HTTP ${res.status}`;
                        throw new Error(msg);
                    }
                } else {
                    const msg = parsed?.detail ?? txt ?? `HTTP ${res.status}`;
                    throw new Error(msg);
                }
            }
            toast.success(`Deleted user ${deleteIdentifier}`);
            await fetchUserList();
            // also remove any pending notices for that id
            setNotices((prev) => prev.filter((n) => n.userId !== deleteTargetId));
        } catch (e: any) {
            showError("Failed to delete user", e);
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setDeleteTargetId(null);
            setDeleteIdentifier(null);
        }
    };

    const openRenameDialog = (user: User) => {
        setRenameTargetId(user.id);
        setRenameValue(user.username ?? "");
        setIsRenameDialogOpen(true);
    };

    const handleRenameSubmit = async () => {
        if (renameTargetId === null) return;
        try {
            setLoading(true);
            setError(null);
            const fresh = await fetchUserList();
            const current = fresh.find((u) => u.id === renameTargetId);
            const oldUserId = current?.username ?? "";
            if (!oldUserId) {
                toast.error("Cannot determine current username for this user. Refresh the list and try again.");
                setLoading(false);
                return;
            }
            const payload = { old_user_id: oldUserId, new_user_id: renameValue };
            const res = await (await import("@/lib/session")).authFetch(`/users/rename`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out = await res.json().catch(() => null);
            // optimistic update of local list
            setUserList((prev) => prev.map((u) => (u.id === renameTargetId ? { ...u, username: renameValue } : u)));
            setIsRenameDialogOpen(false);
            setRenameTargetId(null);
            setRenameValue("");
            toast.success(`Renamed user to ${renameValue}`);
            try {
                await fetchUserList();
            } catch {
                // ignore
            }
        } catch (e: any) {
            showError("Failed to rename user", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        // Backend creates a new user; we call POST /users/create?admin=true|false
        try {
            setLoading(true);
            setError(null);
            const qs = newUserIsAdmin ? "?admin=true" : "";
            const res = await (await import("@/lib/session")).authFetch(`/users/create${qs}`, { method: "POST" });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out = await res.json();
            // out expected to contain user id and cleartext password
            const returnedId = out.id ?? undefined;
            const returnedUserId = out.user_id;
            const usernameFromServer = typeof out.username === "string"
                ? out.username
                : (typeof returnedUserId === "string" && returnedUserId !== String(returnedId) ? returnedUserId : undefined);
            const createdUser: User = {
                id: returnedId ?? Date.now(),
                username: usernameFromServer ?? undefined,
                is_admin: out.is_admin ?? newUserIsAdmin,
                last_login: out.last_login ?? null,
            };

            setUserList((prev) => [...prev, createdUser]);
            setNewUserIsAdmin(false);
            setIsAddUserDialogOpen(false);

            const notice: CredNotice = {
                id: String(Date.now()) + "-create-" + String(createdUser.id),
                userId: createdUser.id,
                username: createdUser.username,
                password: out.password ?? (out.password_cleartext ?? undefined),
                createdAt: new Date().toISOString(),
            };
            setNotices((prev) => [notice, ...prev]);
            toast.success("Credentials added to Pending Credentials");
            try {
                const fresh = await fetchUserList();
                // try to resolve created user's numeric id by matching username
                const found = createdUser.username ? fresh.find((u) => u.username === createdUser.username) : undefined;
                if (found) {
                    setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, userId: found.id } : n)));
                }
            } catch {
                // ignore
            }
        } catch (e: any) {
            showError("Failed to create user", e);
        } finally {
            setLoading(false);
        }
    };

    // helper to fetch user list from server and update state
    const fetchUserList = async () => {
        setLoading(true);
        setError(null);
        try {
            const session = await import("@/lib/session");
            // wait briefly for token (session.restore should make this usually unnecessary)
            const waitForToken = async (timeoutMs = 2000) => {
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                    const t = session.getToken();
                    if (t) return true;
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, 100));
                }
                return false;
            };

            const hasToken = await waitForToken(3000);
            if (!hasToken) throw new Error("Not authenticated");

            const res = await session.authFetch(`/users/logins`);
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j && j.detail ? j.detail : `HTTP ${res.status}`);
            }
            const out: Array<{ id: number; user_id?: string; is_admin?: boolean; last_login?: string | null }> = await res.json();
            const mapped = out.map((r) => {
                const maybeUsername = r.user_id;
                const username = typeof maybeUsername === "string" && maybeUsername !== String(r.id) ? maybeUsername : undefined;
                return { id: r.id, username, last_login: r.last_login ?? null, is_admin: r.is_admin ?? false };
            });
            setUserList(mapped);
            return mapped;
        } catch (e: any) {
            showError("Failed to load users", e);
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
                            <div className="text-sm text-gray-600">The server will create a new user and return the generated password. Choose whether this user should be an admin.</div>
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

            <div className="rounded-md border">
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
                        {userList.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.id}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.is_admin ? "Yes" : "No"}</TableCell>
                                <TableCell className="text-left">
                                    {formatDate(user.last_login)}
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

            {/* Rename dialog (reusable) */}
            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-yellow-500">Rename User</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="text-sm text-gray-600">Enter a new username for the selected user.</div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="rename" className="text-right">Username</Label>
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
                        <Button className="bg-yellow-500 text-black" onClick={handleRenameSubmit} disabled={loading || !renameValue.trim()}>
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-yellow-500">Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="text-sm text-gray-600">Are you sure you want to delete <strong>{deleteIdentifier}</strong>? This action cannot be undone.</div>
                    </div>
                    <DialogFooter>
                        <Button className="mr-2" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
                        <Button className="bg-red-600 text-white" onClick={confirmDelete} disabled={isDeleting}>{isDeleting ? "Deleting…" : "Delete"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Credential notices: show generated credentials for copy/mark-read */}
            {notices.length > 0 && (
                <div className="space-y-3">
                    <Alert className="border-yellow-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Saved locally</AlertTitle>
                        <AlertDescription>
                            Credentials shown here are stored only in this browser. Copy them now — they will not be available to other admins or after clearing local data.
                        </AlertDescription>
                    </Alert>

                    <div className="rounded-md border p-4 bg-neutral-900">
                        <p className="font-semibold text-lg mb-2">Pending Credentials</p>
                        <div className="space-y-2">
                            {notices.map((n) => (
                                <div key={n.id} className="flex items-start justify-between gap-4 bg-neutral-800 p-3 rounded">
                                    <div className="flex-1">
                                        <div className="text-sm text-neutral-300">User ID: <span className="font-medium text-white">{n.userId}</span></div>
                                        <div className="text-sm text-neutral-300">Username: <span className="font-medium text-white">{n.username ?? '-'}</span></div>
                                        <div className="text-sm text-neutral-300">Password: <span className="font-medium text-white">{n.password ?? '-'}</span></div>
                                        <div className="text-xs text-neutral-500 mt-1">Created: {new Date(n.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <button
                                            className="rounded bg-yellow-500 px-3 py-1 text-black text-sm"
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(`user:${n.userId} username:${n.username ?? ''} password:${n.password ?? ''}`);
                                                    toast.success('Copied credentials to clipboard');
                                                } catch {
                                                    toast.error('Failed to copy to clipboard');
                                                }
                                            }}
                                        >
                                            Copy creds
                                        </button>
                                        <button
                                            className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-200"
                                            onClick={() => {
                                                // mark as read = remove
                                                setNotices((prev) => prev.filter((x) => x.id !== n.id));
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
