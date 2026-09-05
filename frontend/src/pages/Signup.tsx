import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import axios from "axios";

import { VerdaLockup } from "@/components/brand/VerdaLockup";
import { VerdaMark } from "@/components/brand/VerdaMark";
import { Panel } from "@/components/ui/Panel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { authProvider } from "@/lib/auth/authProvider";
import { getApiErrorMessage } from "@/services/api";

/**
 * Mirrors app.services.auth_service.MIN_PASSWORD_LENGTH. The backend is
 * the authority — this is the same number restated in the one place
 * TypeScript cannot import it from, so the form rejects a short password
 * before spending a round trip to be told the same thing.
 */
const MIN_PASSWORD_LENGTH = 12;

const signupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(256, "Password must be 256 characters or fewer"),
    confirmPassword: z.string().min(1, "Please re-enter your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

/**
 * /signup — the sign-up half of the pair with /login, and composed to
 * match it exactly: same brand lockup, same unadorned panel on the pale
 * VERDA canvas, same watermark, same field and button styling. Nothing
 * about the authentication design is reinterpreted here.
 *
 * Registration deliberately does NOT go through useAuthStore. That store
 * holds session state, and this flow creates no session — the backend
 * sets no cookie on POST /register. On success the visitor is handed to
 * /login, still unauthenticated, exactly as the backend intends.
 */
export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: SignupFormValues) {
    setFormError(null);
    try {
      await authProvider.register(values.email, values.password);
      // The success message lives on /login rather than here: the next
      // thing this person needs is the sign-in form, and a separate
      // confirmation screen would only add a click between them.
      navigate("/login", {
        replace: true,
        state: { registeredEmail: values.email.trim().toLowerCase() },
      });
    } catch (error) {
      setFormError(describeSignupError(error));
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
              Create Account
            </h1>
            <Divider className="mt-3 mb-5" />

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {formError ? (
                <p
                  role="alert"
                  className="rounded-verda-sm border border-verda-danger/30 bg-verda-danger/5 px-3 py-2 text-verda-caption text-verda-danger"
                >
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-email" className="text-verda-caption font-medium text-verda-ink-2">
                  Email
                </label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@verda.io"
                  invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "signup-email-error" : undefined}
                  {...register("email")}
                />
                {errors.email ? (
                  <p id="signup-email-error" role="alert" className="text-verda-caption text-verda-danger">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-password" className="text-verda-caption font-medium text-verda-ink-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "signup-password-error" : "signup-password-hint"
                    }
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-verda-sm text-verda-ink-3 transition-colors duration-(--verda-motion-fast) ease-verda hover:text-verda-ink"
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password ? (
                  <p id="signup-password-error" role="alert" className="text-verda-caption text-verda-danger">
                    {errors.password.message}
                  </p>
                ) : (
                  <p id="signup-password-hint" className="text-verda-caption text-verda-ink-3">
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="signup-confirm-password"
                  className="text-verda-caption font-medium text-verda-ink-2"
                >
                  Confirm password
                </label>
                <Input
                  id="signup-confirm-password"
                  // Intentionally not tied to showPassword: this field's
                  // whole job is to catch a typo in the field above, and
                  // it cannot do that if both are revealed and copied by
                  // eye from one to the other.
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={
                    errors.confirmPassword ? "signup-confirm-password-error" : undefined
                  }
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <p
                    id="signup-confirm-password-error"
                    role="alert"
                    className="text-verda-caption text-verda-danger"
                  >
                    {errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                    Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="self-center text-verda-caption text-verda-ink-3">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-verda-trace-600 transition-colors duration-(--verda-motion-fast) ease-verda hover:text-verda-ink"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </Panel>
        </div>
      </main>
    </div>
  );
}

/**
 * Turns a failed registration into one sentence a person can act on.
 *
 * The backend's own 409 message ("An account with this email already
 * exists") is specific and safe to show, so it is passed through by
 * getApiErrorMessage. Everything else is replaced: a 500 must not put a
 * stack trace, SQL error, or exception class in front of a user, and a
 * dropped connection surfacing as axios's raw "Network Error" tells them
 * nothing about what to do next.
 */
function describeSignupError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409) {
      return getApiErrorMessage(error);
    }
    if (!error.response) {
      return "Could not reach the server. Check your connection and try again.";
    }
    if (error.response.status >= 500) {
      return "Something went wrong on our end. Please try again in a moment.";
    }
    return getApiErrorMessage(error);
  }

  return "Could not create your account. Please try again.";
}
