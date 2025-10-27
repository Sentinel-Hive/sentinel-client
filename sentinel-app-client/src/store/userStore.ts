import { create } from "zustand";
import { UserData } from "@/types/types";
import { UseBoundStore } from "zustand";
import { StoreApi } from "zustand";

interface UserStore {
    user: UserData | null;
    setUser: (userData: UserData) => void;
    clearUser: () => void;
}

interface UserStore {
    user: UserData | null;
    setUser: (userData: UserData) => void;
    clearUser: () => void;
    isLoggingOut: boolean;
    setLoggingOut: (v: boolean) => void;
    justLoggedOut: boolean;
    setJustLoggedOut: (v: boolean) => void;
}

export const useUserStore: UseBoundStore<StoreApi<UserStore>> = create<UserStore>((set) => ({
    user: null,
    isLoggingOut: false,
    setUser: (userData) => set({ user: userData }),
    clearUser: () => set({ user: null }),
    setLoggingOut: (v: boolean) => set({ isLoggingOut: v }),
    justLoggedOut: false,
    setJustLoggedOut: (v: boolean) => set({ justLoggedOut: v }),
}));

export const useUser = () => useUserStore((state) => state.user);
