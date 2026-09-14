import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Display, Eyebrow, Lede, Section, SectionHeading } from "@/marketing/chrome/primitives";
import { PageShell } from "./PageShell";
import { cn } from "@/lib/utils";

/**
 * /contact — the destination for both conversion paths.
 *
 * NOTE: there is no enquiry endpoint on the backend yet, so this page
 * does NOT pretend to submit. It routes to a real mailto: with the
 * enquiry pre-composed, which works today and never silently drops a
 * lead. Replace with a POST to /api/v1/enquiries when that route
 * exists — the field set below is the schema it should accept.
 *
 * Deliberately not wired into the auth tables: a lead is not a user.
 */

type Track = "grow" | "build";

const CONTACT_EMAIL = "hello@verda.example";

export default function ContactPage() {
  const [track, setTrack] = useState<Track>("grow");
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [detail, setDetail] = useState("");

  const subject =
    track === "grow" ? "Smart tower enquiry" : "Commercial farm enquiry";
  const bodyLines = [
    `Track: ${track === "grow" ? "Grow with VERDA (home / café)" : "Build with VERDA (commercial)"}`,
    `Name: ${name || "—"}`,
    `${track === "grow" ? "City" : "Organisation"}: ${organisation || "—"}`,
    "",
    detail || "—",
  ];
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

  return (
    <PageShell>
      <Section bleed className="pt-12 tablet:pt-16">
        <Eyebrow className="mb-3">Contact</Eyebrow>
        <Display>Let's grow something real.</Display>
        <Lede className="mt-5">
          Tell us which of the two you are, and roughly what you want to grow. We will reply with what is actually possible
          today rather than a brochure.
        </Lede>
      </Section>

      <Section>
        <div className="grid gap-10 laptop:grid-cols-[1fr_0.85fr]">
          <div>
            <fieldset className="mb-6">
              <legend className="mb-3 font-verda-mono text-verda-label uppercase tracking-[0.12em] text-verda-ink-3">
                Which are you?
              </legend>
              <div className="grid gap-3 tablet:grid-cols-2">
                {([
                  ["grow", "Grow with VERDA", "A tower for a home, balcony or café."],
                  ["build", "Build with VERDA", "A commercial farm, hotel, institution or contract operation."],
                ] as const).map(([value, title, detailText]) => (
                  <label
                    key={value}
                    className={cn(
                      "cursor-pointer rounded-verda-md border p-4 transition-colors duration-(--verda-motion-fast) ease-verda",
                      track === value
                        ? "border-verda-trace-600 bg-verda-sage-wash"
                        : "border-verda-line bg-verda-surface hover:border-verda-line-strong"
                    )}
                  >
                    <input
                      type="radio"
                      name="track"
                      value={value}
                      checked={track === value}
                      onChange={() => setTrack(value)}
                      className="sr-only"
                    />
                    <span className="block text-verda-h3 font-semibold text-verda-ink">{title}</span>
                    <span className="mt-1 block text-verda-caption text-verda-ink-2">{detailText}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-4">
              <Field id="contact-name" label="Your name" value={name} onChange={setName} autoComplete="name" />
              <Field
                id="contact-org"
                label={track === "grow" ? "City" : "Organisation"}
                value={organisation}
                onChange={setOrganisation}
                autoComplete={track === "grow" ? "address-level2" : "organization"}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-detail" className="text-verda-caption font-medium text-verda-ink-2">
                  {track === "grow" ? "What would you like to grow?" : "Site, scale and crop"}
                </label>
                <textarea
                  id="contact-detail"
                  rows={5}
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  className="rounded-verda-sm border border-verda-line bg-verda-surface px-3 py-2 text-verda-body text-verda-ink outline-none transition-colors duration-(--verda-motion-fast) ease-verda placeholder:text-verda-ink-3 focus-visible:border-verda-trace-600"
                  placeholder={
                    track === "grow"
                      ? "Lettuce and herbs on a balcony, mostly for the kitchen."
                      : "Polyhouse near Pune, roughly 1,000 m², lettuce for export."
                  }
                />
              </div>

              <a
                href={mailto}
                className="inline-flex items-center rounded-verda-sm bg-verda-forest-800 px-4 py-2.5 text-verda-body font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700"
              >
                Send enquiry
              </a>
              <p className="text-verda-caption text-verda-ink-3">
                This opens your email client with the message composed — nothing is submitted to us in the background, and
                nothing is stored here.
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <Card>
              <p className="text-verda-h3 font-semibold text-verda-ink">Already a customer?</p>
              <p className="mt-2 text-verda-caption leading-[1.6] text-verda-ink-2">
                Your systems, reservoirs and trend lines are in the dashboard.
              </p>
              <Link
                to="/login"
                className="mt-3 inline-flex rounded-verda-sm border border-verda-line px-3.5 py-1.5 text-verda-caption font-medium text-verda-ink-2 transition-colors duration-(--verda-motion-fast) ease-verda hover:border-verda-line-strong hover:text-verda-ink"
              >
                Sign in
              </Link>
            </Card>
            <Card>
              <p className="text-verda-h3 font-semibold text-verda-ink">Before you write</p>
              <p className="mt-2 text-verda-caption leading-[1.6] text-verda-ink-2">
                It may save a round trip to read what runs today versus what we are still building. We keep those separate on
                purpose.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/platform"
                  className="rounded-verda-sm border border-verda-line px-3 py-1.5 text-verda-caption text-verda-ink-2 hover:border-verda-line-strong hover:text-verda-ink"
                >
                  What runs today
                </Link>
                <Link
                  to="/research"
                  className="rounded-verda-sm border border-verda-line px-3 py-1.5 text-verda-caption text-verda-ink-2 hover:border-verda-line-strong hover:text-verda-ink"
                >
                  What we're building
                </Link>
              </div>
            </Card>
          </aside>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="No sales theatre">What happens next</SectionHeading>
        <ol className="grid gap-4 tablet:grid-cols-3">
          {[
            ["We reply", "With what is genuinely possible for your site today, including when the answer is 'not yet'."],
            ["We scope", "Crop, volume, water chemistry, space and who will operate it day to day."],
            ["We quote", "Hardware, install, consumables and the operating procedure, itemised."],
          ].map(([title, detailText], i) => (
            <Card as="li" key={title}>
              <span className="font-verda-mono text-verda-label tabular-nums text-verda-trace-600">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-verda-h3 font-semibold text-verda-ink">{title}</p>
              <p className="mt-1.5 text-verda-caption leading-[1.6] text-verda-ink-2">{detailText}</p>
            </Card>
          ))}
        </ol>
      </Section>
    </PageShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-verda-caption font-medium text-verda-ink-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-verda-sm border border-verda-line bg-verda-surface px-3 text-verda-body text-verda-ink outline-none transition-colors duration-(--verda-motion-fast) ease-verda focus-visible:border-verda-trace-600"
      />
    </div>
  );
}
