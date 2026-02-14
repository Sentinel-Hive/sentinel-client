import "@/app/globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useUser } from "@/store/userStore";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "SentinelHive",
    description: "Client side for the SentinelHive project.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const router = useRouter();
    const location = useLocation();
    const isLoginPage = ["/login"].includes(location.pathname);
    const user = useUser();

    useEffect(() => {
        if (!user || user == null) {
            router.push("/login");
        }
    }, [user]);

    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <Toaster richColors theme="dark" position="bottom-right" />
                {!isLoginPage  && <Header />}
                {children}
            </body>
        </html>
    );
}
