import { create } from "zustand";
import { UseBoundStore, StoreApi } from "zustand";
import { User } from "@/types/types";

interface UserListStore {
    users: User[];
    addUser: (user: User) => void;
    removeUser: (id: number) => void;
    clearUsers: () => void;
}

export const useUserListStore: UseBoundStore<StoreApi<UserListStore>> = create<UserListStore>(
    (set) => ({
        users: [],
        addUser: (user) => set((state) => ({ users: [...state.users, user] })),
        removeUser: (id) => set((state) => ({ users: state.users.filter((u) => u.id !== id) })),
        clearUsers: () => set({ users: [] }),
    })
);

export const useUserList = () => useUserListStore((state) => state.users);
