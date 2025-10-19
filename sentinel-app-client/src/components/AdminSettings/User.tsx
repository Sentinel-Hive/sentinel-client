import { useState } from "react";

type User = {
    id: number;
    user_id: string;
    is_admin: boolean;
    last_login?: Date;
};

export default function User() {
    const fakeUsers: User[] = [
        { id: 0, user_id: "user0", is_admin: true },
        { id: 1, user_id: "user1", is_admin: false },
        { id: 2, user_id: "user2", is_admin: false },
        { id: 3, user_id: "user3", is_admin: false },
    ];
    const [userList, setUserList] = useState<User[]>(fakeUsers);

    return (
        <div className="flex w-full h-full border-yellow-600 border rounded-md p-5">
            {userList.map((u, i) => (
                <p key={i}>
                    {u.id},{u.user_id}
                </p>
            ))}
        </div>
    );
}
