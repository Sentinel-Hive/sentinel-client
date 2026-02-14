import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser, useUserStore } from "@/store/userStore";
import { useNavigate } from "react-router-dom";
import User from "@/components/AdminSettings/User";
import Dataset from "@/components/AdminSettings/Dataset";
import { getUserData } from "@/lib/session";

export default function Admin() {
    const navigate = useNavigate();
    const user = useUser();

    const isLoggingOut = useUserStore((s) => s.isLoggingOut);
    const justLoggedOut = useUserStore((s) => s.justLoggedOut);

    // If there's no user in the store but a persisted session exists, wait for
    // the store to be populated. Only redirect when we know there's no persisted
    // session or when the user token is empty. Do not redirect while logging out.
    useEffect(() => {
        if (isLoggingOut || justLoggedOut) return;
        try {
            const persisted = getUserData();
            if (!user && !persisted) {
                navigate("/analytics");
            } else if (user && user.token === "") {
                navigate("/analytics");
            }
        } catch {
            // Fallback: if anything goes wrong, redirect to analytics
            navigate("/analytics");
        }
    }, [user, isLoggingOut, justLoggedOut, navigate]);

    const [currentPage, setCurrentPage] = useState("user");

    const settings = [
        { title: "User", content: <User /> },
        { title: "Dataset", content: <Dataset /> },
    ];

    const contentToDisplay = settings.find(
        (page) => page.title.toLowerCase() === currentPage
    )?.content;

    return (
        <div className="flex flex-col h-full w-full p-5">
            <div className="flex w-full">
                {settings.map((page, i) => (
                    <Button
                        key={i}
                        className={`text-xl rounded-none font-bold ${page.title.toLowerCase() == currentPage ? "bg-yellow-600 font-light" : ""}`}
                        onClick={() => setCurrentPage(page.title.toLowerCase())}
                    >
                        {page.title}
                    </Button>
                ))}
            </div>
            <div className="flex-grow w-full min-h-0 max-h-[75vh] overflow-y-auto">
                {contentToDisplay || <div>Page not found.</div>}
            </div>
        </div>
    );
}