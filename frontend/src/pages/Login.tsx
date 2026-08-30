import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { VerdaLockup } from "@/components/brand/VerdaLockup";
import { VerdaMark } from "@/components/brand/VerdaMark";
import { Panel } from "@/components/ui/Panel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { useAuthStore } from "@/store/useAuthStore";
import { getApiErrorMessage } from "@/services/api";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * /login — the one route that renders standalone, outside AppShell.
 * Composition follows the approved blueprint: brand lockup above an
 * unadorned sign-in panel, on the pale VERDA canvas. No split-screen,
 * no gradient hero — the mark watermark is the only decoration.
 */
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  async function onSubmit(values: LoginFormValues) {
    setAuthError(null);
    try {
      await login(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setAuthError(getApiErrorMessage(error));
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-verda-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-28 opacity-[0.05] tablet:-bottom-36 tablet:-right-36"
      >
        <VerdaMark size={420} />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 tablet:px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-8 animate-in fade-in duration-(--verda-motion-slow) ease-verda">
          <VerdaLockup markSize={44} tagline className="flex-col text-center gap-2" />

          <Panel className="w-full">
            <h1 className="font-verda-mono text-verda-label font-semibold uppercase tracking-[0.2em] text-verda-ink-3">
              Sign In
            </h1>
            <Divider className="mt-3 mb-5" />

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {authError ? (
                <p
                  role="alert"
                  className="rounded-verda-sm border border-verda-danger/30 bg-verda-danger/5 px-3 py-2 text-verda-caption text-verda-danger"
                >
                  {authError}
                </p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="text-verda-caption font-medium text-verda-ink-2">
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@verda.io"
                  invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "login-email-error" : undefined}
                  {...register("email")}
                />
                {errors.email ? (
                  <p id="login-email-error" role="alert" className="text-verda-caption text-verda-danger">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-password" className="text-verda-caption font-medium text-verda-ink-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "login-password-error" : undefined}
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-verda-sm text-verda-ink-3 transition-colors duration-(--verda-motion-fast) ease-verda hover:text-verda-ink-2"
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password ? (
                  <p id="login-password-error" role="alert" className="text-verda-caption text-verda-danger">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <button
                type="button"
                disabled
                aria-label="Forgot password (not yet available)"
                className="cursor-not-allowed self-center text-verda-caption text-verda-ink-3 opacity-60"
              >
                Forgot password?
              </button>
            </form>
          </Panel>
        </div>
      </main>
    </div>
  );
}
