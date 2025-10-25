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

type User = {
    id: number;
    username: string;
    is_admin: boolean;
    last_login?: Date;
};

export default function UserPage() {
    const fakeUsers: User[] = [
        { id: 0, username: "user0", is_admin: true, last_login: new Date() },
        { id: 1, username: "user1", is_admin: false, last_login: new Date(Date.now() - 86400000) },
        { id: 2, username: "user2", is_admin: false }, // No last login
        { id: 3, username: "user3", is_admin: false, last_login: new Date(Date.now() - 3600000) },
    ];
    const [userList, setUserList] = useState<User[]>(fakeUsers);
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
        setUserList((prevUsers) => prevUsers.filter((user) => user.id !== userId));
        console.log(`User ID: ${userId} deleted.`);
    };

    const handleAddUser = () => {
        if (!newUserUsername.trim()) {
            alert("Username cannot be empty.");
            return;
        }

        const newUser: User = {
            id: userList.length > 0 ? Math.max(...userList.map((u) => u.id)) + 1 : 1,
            username: newUserUsername.trim(),
            is_admin: newUserIsAdmin,
            last_login: undefined,
        };

        setUserList((prevUsers) => [...prevUsers, newUser]);

        setNewUserUsername("");
        setNewUserIsAdmin(false);
        setIsAddUserDialogOpen(false);

        console.log("Add user handler called with:", newUser);
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
