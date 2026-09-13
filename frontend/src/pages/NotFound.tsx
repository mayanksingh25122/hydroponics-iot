import { Link } from "react-router-dom";
import { VerdaLockup } from "@/components/brand/VerdaLockup";

/**
 * 404. Renders standalone, outside both the marketing shell and
 * AppShell, because it is reachable from either tier.
 *
 * Previously a two-line stub painting `text-white/92` onto the pale
 * VERDA canvas — invisible under a light OS theme. Rebuilt on VERDA
 * tokens now that it is a public page a real visitor can land on.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-verda-canvas">
      <header className="border-b border-verda-line px-4 py-5 tablet:px-6">
        <Link to="/" aria-label="VERDA — home">
          <VerdaLockup markSize={24} />
        </Link>
      </header>

      <main className="flex flex-1 items-center px-4 py-16 tablet:px-6">
        <div className="mx-auto w-full max-w-[1240px]">
          <p className="font-verda-mono text-verda-label uppercase tracking-[0.14em] text-verda-ink-3">
            404
          </p>
          <h1 className="mt-3 max-w-[20ch] text-balance text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-verda-forest-900">
            There's nothing growing here.
          </h1>
          <p className="mt-4 max-w-[48ch] text-verda-body text-verda-ink-2">
            That page doesn't exist, or it moved. The dashboard now lives under{" "}
            <code className="rounded-verda-sm bg-verda-surface-2 px-1.5 py-0.5 font-verda-mono text-verda-mono text-verda-ink">
              /app
            </code>
            .
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <Link
              to="/"
              className="rounded-verda-sm bg-verda-forest-800 px-4 py-2 text-verda-caption font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700"
            >
              Back to the start
            </Link>
            <Link
              to="/app"
              className="rounded-verda-sm border border-verda-line-strong px-4 py-2 text-verda-caption font-medium text-verda-ink transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-sage-wash"
            >
              Go to the dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
