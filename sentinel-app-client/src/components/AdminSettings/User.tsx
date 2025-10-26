import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { User, useUserList, useUserListStore } from "@/store/userListStore";
import { toast } from "sonner";

export default function UserPage() {
    const users = useUserList();
    const { addUser, removeUser } = useUserListStore();
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [newUserUsername, setNewUserUsername] = useState("");
    const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);

    const formatDate = (date?: Date) => {
        if (!date) return "Never";
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const handleResetPassword = (userId: number) => {
        console.log(`Password reset initiated for user ID: ${userId}`);
        alert(`Password reset initiated for user ID: ${userId}`);
    };

    const handleDeleteUser = (userId: number) => {
        removeUser(userId);
        toast.warning(`User ${userId} Deleted`, {
            description: "The user was removed from the live list.",
        });
    };

    const handleAddUser = () => {
        if (!newUserUsername.trim()) {
            alert("Username cannot be empty.");
            return;
        }

        const nextId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
        const newUser: User = {
            id: nextId,
            username: newUserUsername.trim(),
            is_admin: newUserIsAdmin,
            last_login: undefined,
        };
        addUser(newUser);
        setNewUserUsername("");
        setNewUserIsAdmin(false);
        setIsAddUserDialogOpen(false);
        toast.success("User created", { description: newUser.username });
    };

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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="username" className="text-right">
                                    Username
                                </Label>
                                <Input
                                    id="username"
                                    value={newUserUsername}
                                    onChange={(e) => setNewUserUsername(e.target.value)}
                                    className="col-span-3"
                                    placeholder="Enter a unique username"
                                />
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
                        {users.map((user) => (
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
        </div>
    );
}
