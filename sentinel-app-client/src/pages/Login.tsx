// sentinel-app-client/src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { login, ping, getBaseURL } from "../lib/session";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(getBaseURL()); // IP/domain[:port]
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pingMsg, setPingMsg] = useState("");

  // Accept IP or domain, optional :port
  const validateServer = (value: string) => {
    try {
      let s = value.trim();
      if (!/^https?:\/\//i.test(s)) s = "http://" + s;
      // Construct URL will throw if invalid
      // Default port handled in session.normalizeBaseURL
      new URL(s);
      return true;
    } catch {
      return false;
    }
  };

  const handlePing = async () => {
    setError("");
    if (!validateServer(server)) {
      setPingMsg("Invalid server address");
      return;
    }
    setPingMsg("Pinging...");
    const ok = await (async () => {
      try {
        // setBaseURL happens inside login(); for ping we do a quick fetch using the current input:
        // simple HEAD/GET to /health/ready by constructing fetch directly
        const s = server.trim();
        const url = /^https?:\/\//i.test(s) ? s : `http://${s}`;
        const u = new URL(url);
        if (!u.port) u.port = "8000";
        const res = await fetch(u.toString().replace(/\/+$/, "") + "/health/ready");
        return res.ok;
      } catch {
        return false;
      }
    })();
    setPingMsg(ok ? "Server reachable" : "Server not reachable");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPingMsg("");

    if (!validateServer(server)) {
      setError("Please enter a valid server address (IP or domain, optional :port).");
      return;
    }
    if (!username || !password) {
      setError("Enter username and password.");
      return;
    }

    try {
      setBusy(true);
      await login({ baseUrl: server, userId: username, password });
      navigate("/analytics"); // success
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
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
              {error && <div className="p-2 mb-2 text-sm text-red-500 bg-red-100 rounded">{error}</div>}

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
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
                <Label htmlFor="password" className="text-gray-300">Password</Label>
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

              {/* Server */}
              <div className="space-y-2">
                <Label htmlFor="server" className="text-gray-300">Server (IP / domain[:port])</Label>
                <Input
                  id="server"
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="127.0.0.1:8000 or 10.0.0.5"
                  required
                  className="bg-neutral-700 text-white border-neutral-600"
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={handlePing} className="text-black">
                    Ping
                  </Button>
                  <span className="text-xs text-gray-400">{pingMsg}</span>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full bg-[#e7a934] hover:bg-yellow-700 text-black font-bold"
                disabled={busy}
              >
                {busy ? "Logging in..." : "Login"}
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
