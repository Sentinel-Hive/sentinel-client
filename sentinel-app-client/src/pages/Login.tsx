// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../components/ui/card";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ip, setIp] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Username:", username);
    console.log("Password:", password);
    console.log("IP Address:", ip);
    navigate("/analytics");
  };

  return (
    <div className="relative flex min-h-screen bg-neutral-900">
      {/* Left Side */}
      <div className="flex items-center justify-center w-1/2">
        <img
          src="/SH_Logo_HD.png"
          alt="Sentinel Logo"
          className="max-w-xs w-2/3 h-auto"
        />
      </div>

      {/* Right Side */}
      <div className="flex items-center justify-center w-1/2">
        <Card className="w-full max-w-md bg-neutral-800 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-center text-white">Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
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

              {/* IP Address */}
              <div className="space-y-2">
                <Label htmlFor="ip" className="text-gray-300">
                  IP Address
                </Label>
                <Input
                  id="ip"
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="Enter IP address"
                  required
                  className="bg-neutral-700 text-white border-neutral-600"
                />
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Login
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Sentinel-Client
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default Login;
