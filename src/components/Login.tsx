import { useState } from "react";
import { login, register } from "../api";
import "../App.css";

type LoginProps = {
  onLoginSuccess: () => void;
};

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authFn = mode === "login" ? login : register;
      const data = await authFn(email.trim(), password);

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_email", data.user.email);
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || `${mode === "login" ? "Login" : "Registration"} failed`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="bg" />
      
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        padding: "20px"
      }}>
        <div className="card" style={{ maxWidth: "420px", width: "100%" }}>
          <div className="cardHeader">
            <div>
              <h2 className="cardTitle">Welcome to TaskFlow</h2>
              <p className="cardSub">Sign in or create an account</p>
            </div>
          </div>

          <div className="cardBody">
            <div className="segmented" style={{ marginBottom: "24px" }}>
              <button
                className={`segBtn ${mode === "login" ? "isActive" : ""}`}
                onClick={() => {
                  setMode("login")
                  setError(null)
                }}
                type="button"
              >
                Login
              </button>
              <button
                className={`segBtn ${mode === "register" ? "isActive" : ""}`}
                onClick={() => {
                  setMode("register")
                  setError(null)
                }}
                type="button"
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label htmlFor="email" style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="password" style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Choose a password" : "Enter your password"}
                  disabled={loading}
                />
              </div>

              {error && (
                <div style={{ 
                  padding: "12px", 
                  background: "rgba(255, 50, 50, 0.1)", 
                  border: "1px solid rgba(255, 50, 50, 0.3)",
                  borderRadius: "8px",
                  color: "#ff6b6b",
                  fontSize: "14px"
                }}>
                  {error}
                </div>
              )}

              <button 
                className="btn btnPrimary" 
                type="submit" 
                disabled={loading}
                style={{ marginTop: "8px" }}
              >
                {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : (mode === "login" ? "Sign In" : "Create Account")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
