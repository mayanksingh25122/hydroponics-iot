import { Link } from "react-router-dom";
import {
  Card,
  Display,
  Eyebrow,
  Lede,
  Prose,
  Section,
  SectionHeading,
  TierBadge,
} from "@/marketing/chrome/primitives";
import { PageShell } from "./PageShell";

/**
 * /farms — narrative §4.1 and §3.6, the B2B commercial NFT business.
 *
 * Traction copy is deliberately singular ("an active commercial
 * deployment"), matching the narrative exactly. The moment it becomes
 * "deployments" it stops being verifiable, so the number is the copy.
 */
export default function FarmsPage() {
  return (
    <PageShell>
      <Section bleed className="pt-12 tablet:pt-16">
        <Eyebrow className="mb-3">Commercial farms · Growers, hospitality, institutions</Eyebrow>
        <Display>The buyer does not want more. They want the same thing, every week.</Display>
        <Lede className="mt-5">
          Full NFT installations for export growers, hotel and restaurant groups, institutional kitchens and contract farming
          operations — automated, monitored, and shipped with the procedure that makes the outcome repeatable.
        </Lede>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TierBadge tier="shipping" />
          <Link
            to="/contact"
            className="rounded-verda-sm bg-verda-forest-800 px-4 py-2 text-verda-caption font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700"
          >
            Build with VERDA
          </Link>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="§2">
          Indian agriculture has a predictability problem before it has a yield problem.
        </SectionHeading>
        <Prose>
          <p>
            For high-value crops — lettuce, leafy greens, herbs, exotics — the buyer does not primarily want more. The buyer
            wants the same thing, every week, at a known grade.
          </p>
          <p>
            Open-field farming cannot promise that, because nobody controls the weather, the soil or the water. Controlled
            environment agriculture can. But in India, hydroponics is sold as hardware — and the failure rate is high, almost
            never because the hardware failed.
          </p>
          <p>
            Wrong EC. A pH drift nobody caught. A pump that stopped overnight. A root zone that got too warm in May. The
            plumbing was never the hard part.
          </p>
        </Prose>
      </Section>

      <Section>
        <SectionHeading eyebrow="§3.6">Where we are today</SectionHeading>
        <div className="rounded-verda-md border border-verda-line bg-verda-surface p-6">
          <p className="text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em] text-verda-forest-900">
            An active commercial deployment with a lettuce grower serving the export market.
          </p>
          <p className="mt-3 max-w-[58ch] text-verda-body text-verda-ink-2">
            A paying customer, a real crop, a real buyer — not a pilot. One deployment is one deployment, and we would rather
            say that precisely than round it up.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="What is sold">Economics, not enthusiasm</SectionHeading>
        <div className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-4">
          {[
            { k: "Yield per m²", v: "Controlled environment, continuous cycles" },
            { k: "Consistency of grade", v: "The thing the export buyer is actually paying for" },
            { k: "Reduced labour", v: "Dosing and monitoring run without a person in the loop" },
            { k: "Reduced loss", v: "Drift is caught by the system, not by a weekly walk-through" },
          ].map((item) => (
            <Card key={item.k}>
              <p className="text-verda-h3 font-semibold text-verda-ink">{item.k}</p>
              <p className="mt-2 text-verda-caption leading-[1.6] text-verda-ink-2">{item.v}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Who it is for">Segments we build for</SectionHeading>
        <ul className="grid gap-3 tablet:grid-cols-2">
          {[
            ["Export growers", "Grade consistency is the contract. Variance is the loss."],
            ["Hotel and restaurant groups", "Supply that does not depend on a market run."],
            ["Institutional kitchens", "Volume, predictability, and a procedure staff can follow."],
            ["Contract farming operations", "The same recipe reproduced across sites."],
          ].map(([title, detail]) => (
            <Card as="li" key={title}>
              <p className="text-verda-h3 font-semibold text-verda-ink">{title}</p>
              <p className="mt-1.5 text-verda-caption text-verda-ink-2">{detail}</p>
            </Card>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeading eyebrow="§9 · Direction">What we are building towards</SectionHeading>
        <div className="rounded-verda-md border border-verda-info/40 bg-verda-info/5 p-6">
          <TierBadge tier="direction" />
          <p className="mt-4 text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em] text-verda-forest-900">
            We sell farms that guarantee output. We don't just install them — we run them.
          </p>
          <p className="mt-3 max-w-[58ch] text-verda-body text-verda-ink-2">
            That becomes a sellable claim once monitoring is proven across multiple sites. It is not one yet, and we are not
            going to write it in the present tense until it is.
          </p>
        </div>
      </Section>
    </PageShell>
  );
}
