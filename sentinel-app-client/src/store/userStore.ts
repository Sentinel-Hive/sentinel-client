import { create } from "zustand";
import { UserData } from "@/types/types";
import { UseBoundStore } from "zustand";
import { StoreApi } from "zustand";

interface UserStore {
    user: UserData | null;
    setUser: (userData: UserData) => void;
    clearUser: () => void;
}

export const useUserStore: UseBoundStore<StoreApi<UserStore>> = create<UserStore>((set) => ({
    user: null,
    setUser: (userData) => set({ user: userData }),
    clearUser: () => set({ user: null }),
}));

export const useUser = () => useUserStore((state) => state.user);
