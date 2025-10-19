export default function User() {
    const fakeUsers = [
        { id: 0, user_id: "user0", is_admin: true },
        { id: 1, user_id: "user1", is_admin: false },
        { id: 2, user_id: "user2", is_admin: false },
        { id: 3, user_id: "user3", is_admin: false },
    ];

    return (
        <div className="flex w-full h-full border-yellow-600 border rounded-md p-5">
            <p>hello users</p>
        </div>
    );
}
