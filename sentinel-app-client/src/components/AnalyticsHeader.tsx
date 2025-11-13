import { Link, useLocation } from "react-router-dom";

const AnalyticsHeader = () => {
    const location = useLocation();

    return (
        <div className="w-full bg-neutral-900 border-b border-neutral-800">
            <div className="flex h-8 items-center justify-center px-4">
                <nav className="flex space-x-4">
                    <Link
                        to="/analytics"
                        className={`px-2 py-0.5 rounded text-sm ${
                            location.pathname === "/analytics"
                                ? "bg-yellow-400 text-black"
                                : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Logs
                    </Link>
                    <Link
                        to="/graphs"
                        className={`px-2 py-0.5 rounded text-sm ${
                            location.pathname === "/graphs"
                                ? "bg-yellow-400 text-black"
                                : "text-neutral-400 hover:text-white"
                        }`}
                    >
                        Graphs
                    </Link>
                </nav>
            </div>
        </div>
    );
};

export default AnalyticsHeader;
