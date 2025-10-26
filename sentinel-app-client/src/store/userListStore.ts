import { create } from "zustand";
import { UseBoundStore, StoreApi } from "zustand";

export type User = {
    id: number;
    username: string;
    is_admin: boolean;
    last_login?: Date;
};

const DUMMY_DATA: User[] = [
    { id: 0, username: "user0", is_admin: true, last_login: new Date() },
    { id: 1, username: "user1", is_admin: false, last_login: new Date(Date.now() - 86400000) },
    { id: 2, username: "user2", is_admin: false },
    { id: 3, username: "user3", is_admin: false, last_login: new Date(Date.now() - 3600000) },
];

interface UserListStore {
    users: User[];
    addUser: (user: User) => void;
    removeUser: (id: number) => void;
    clearUsers: () => void;
}

export const useUserListStore: UseBoundStore<StoreApi<UserListStore>> = create<UserListStore>(
    (set) => ({
        users: DUMMY_DATA,
        addUser: (user) => set((state) => ({ users: [...state.users, user] })),
        removeUser: (id) => set((state) => ({ users: state.users.filter((u) => u.id !== id) })),
        clearUsers: () => set({ users: [] }),
    })
);

export const useUserList = () => useUserListStore((state) => state.users);
