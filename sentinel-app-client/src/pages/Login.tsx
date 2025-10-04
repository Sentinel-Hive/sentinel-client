// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";

export default function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [ip, setIp] = useState("");
    const [error, setError] = useState("");

    const validateIpOrDomain = (value: string) => {
        // IPv4 regex
        const ipRegex =
            /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

        // Domain regex (simplified: allows subdomains + TLDs)
        const domainRegex =
            /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.(?:[A-Za-z]{2,63})(\.[A-Za-z]{2,63})*$/;

        return ipRegex.test(value) || domainRegex.test(value);
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateIpOrDomain(ip)) {
            setError("Please enter a valid IP address or domain.");
            return;
        }

        setError(""); // clear error if valid

        // Login logic goes here (API call, auth, etc.)
        navigate("/analytics");
    };

    return (
        <div className="fixed inset-0 flex overflow-hidden bg-[conic-gradient(from_225deg,_#1a1a1a_0_50%,_#e7a934_50%)]">
            {/* Left Side */}
            <div className="flex items-center justify-center flex-1 h-full">
                <img src="/SH_Logo_HD.png" alt="Sentinel Logo" className="max-w-xs w-2/3 h-auto" />
            </div>

            {/* Right Side */}
            <div className="flex items-center justify-center flex-1 h-full p-4 sm:p-6">
                <Card className="w-full max-w-md bg-neutral-800 border-neutral-700">
                    <CardHeader>
                        <CardTitle className="text-center text-white">Login</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Error Message */}
                            {error && (
                                <div className="p-2 mb-2 text-sm text-red-500 bg-red-100 rounded">
                                    {error}
                                </div>
                            )}

                            {/* Username */}
                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-gray-300">
                                    Username
                                </Label>
                                <Input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    required
                                    className="bg-neutral-700 text-white border-neutral-600"
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-gray-300">
                                    Password
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    className="bg-neutral-700 text-white border-neutral-600"
                                />
                            </div>

                            {/* IP Address / Domain */}
                            <div className="space-y-2">
                                <Label htmlFor="ip" className="text-gray-300">
                                    IP Address / Domain
                                </Label>
                                <Input
                                    id="ip"
                                    type="text"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    placeholder="Enter IP or domain"
                                    required
                                    className="bg-neutral-700 text-white border-neutral-600"
                                />
                            </div>

                            {/* Login Button */}
                            <Button
                                type="submit"
                                className="w-full bg-[#e7a934] hover:bg-yellow-700 text-black font-bold"
                            >
                                Login
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="text-center text-xs text-gray-400">
                        © {new Date().getFullYear()} Sentinel Hive
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
