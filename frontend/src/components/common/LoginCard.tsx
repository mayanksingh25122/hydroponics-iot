import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "./Button";
import { GlassCard } from "./GlassCard";
import { Input } from "./Input";

export interface LoginCardProps {
  onSubmit?: (email: string, password: string) => void;
  loading?: boolean;
  error?: string;
}

export function LoginCard({ onSubmit, loading, error }: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit?.(email, password);
  }

  return (
    <div className="canopy-app-bg relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-canopy-primary/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-canopy-secondary/15 blur-[100px]" />

      <GlassCard className="relative w-full max-w-sm animate-canopy-rise">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="mb-2 flex flex-col items-center gap-1 text-center">
            <span className="text-3xl">🌱</span>
            <h1 className="text-lg font-semibold text-white/92">Canopy</h1>
            <p className="text-xs text-white/40">Hydroponics Platform</p>
          </div>

          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <p className="text-xs text-canopy-error">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
