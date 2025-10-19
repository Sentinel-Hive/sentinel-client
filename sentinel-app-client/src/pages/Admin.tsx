import { useState } from "react";
import { Button } from "../components/ui/button";
import { useUser } from "../store/userStore";
import { useNavigate } from "react-router-dom";
import User from "../components/AdminSettings/User";
import Dataset from "../components/AdminSettings/Dataset";

export default function Admin() {
    const navigate = useNavigate();
    const user = useUser();
    if (!user || user.token == "") {
        navigate("/analytics");
        return null;
    }

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
            <div className="flex h-full w-full">
                {settings.map((page, i) => (
                    <Button
                        key={i}
                        className={`text-xl ${page.title.toLowerCase() == currentPage ? "bg-yellow-600 font-bold" : ""}`}
                        onClick={() => setCurrentPage(page.title.toLowerCase())}
                    >
                        {page.title}
                    </Button>
                ))}
            </div>
            <div className="flex-grow w-full">{contentToDisplay || <div>Page not found.</div>}</div>
        </div>
    );
}
