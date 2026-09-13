import {
  Card,
  Display,
  Eyebrow,
  Lede,
  LimitMark,
  Prose,
  Section,
  SectionHeading,
  TierBadge,
} from "@/marketing/chrome/primitives";
import { LIMIT_SCALE, TIER_RULE } from "@/marketing/content/claims";
import { PageShell } from "./PageShell";

/** The five links of narrative §8, in the order the chain actually runs. */
const CHAIN = [
  {
    because: "we design the hardware",
    therefore: "camera geometry and lighting are identical on every unit we have ever shipped, so every image is directly comparable to every other image.",
  },
  {
    because: "we make the nutrients",
    therefore: "we know the exact ionic composition behind every plant — not an approximation, the actual recipe.",
  },
  {
    because: "we write the SOP",
    therefore: "we know the schedule and the intervention history behind every reading.",
  },
  {
    because: "we run the lab",
    therefore: "we can induce a condition deliberately, label it, and transfer that label to field data grown on the same formulation.",
  },
  {
    because: "we own the dashboard",
    therefore: "every correction a grower makes is recorded against the condition that prompted it.",
  },
];

/** /approach — narrative §0, §2, §4.3, §8, §9. */
export default function ApproachPage() {
  return (
    <PageShell>
      <Section bleed className="pt-12 tablet:pt-16">
        <Eyebrow className="mb-3">Approach</Eyebrow>
        <Display>Verda exists in the gap between installing a system and running one.</Display>
        <Lede className="mt-5">
          That gap is filled by three things: automation, a written operating procedure, and consumables that are matched to
          both. Everything else we do follows from owning all three.
        </Lede>
      </Section>

      <Section id="tenses">
        <SectionHeading eyebrow="§0">How to read anything we write</SectionHeading>
        <Prose>
          <p>
            We write in three tenses, deliberately separated. The fastest way to lose a serious reader is to write the third
            one in the present tense.
          </p>
        </Prose>
        <div className="mt-6 grid gap-4 tablet:grid-cols-3">
          {(["shipping", "building", "direction"] as const).map((tier) => (
            <Card key={tier}>
              <TierBadge tier={tier} />
              <p className="mt-3 text-verda-body text-verda-ink-2">{TIER_RULE[tier]}</p>
            </Card>
          ))}
        </div>
        <Prose className="mt-6">
          <p>
            Every claim on this site carries one of those marks. Where there is a limit to what we can do, we state it next to
            the claim it bounds rather than at the bottom of the page.
          </p>
        </Prose>
      </Section>

      <Section id="problem">
        <SectionHeading eyebrow="§2">The problem we are actually solving</SectionHeading>
        <Prose>
          <p>
            Indian agriculture has a predictability problem before it has a yield problem. For high-value crops, the buyer does
            not primarily want more — the buyer wants the same thing, every week, at a known grade.
          </p>
          <p>
            Controlled-environment agriculture can promise that. But hydroponics here is sold as hardware: someone buys a
            system, receives a manual, and is then alone. The failure rate is high, and it is almost never the hardware that
            fails. It is the operation.
          </p>
          <p className="text-verda-h2 font-semibold text-verda-forest-900">The plumbing was never the hard part.</p>
          <p>
            The same is true at the small end. A home unit is bought, loved for two months, and becomes furniture — not because
            it broke, but because the owner did not know what to do next.
          </p>
        </Prose>
      </Section>

      <Section id="both">
        <SectionHeading eyebrow="§4.3">Why both products, rather than one</SectionHeading>
        <Prose>
          <p>
            Because they are the same platform and different data. Nine towers on one commercial farm share one water source,
            one climate and one operator — statistically they are closer to one sample than nine.
          </p>
          <p>
            Home towers across different cities give us variance: different water chemistry, different ambient conditions,
            different crops, and different mistakes. Both are necessary, and neither is a distraction from the other, because
            the controller, the formulation and the software are shared.
          </p>
        </Prose>
      </Section>

      <Section id="compounds">
        <SectionHeading eyebrow="§8">What compounds, precisely</SectionHeading>
        <Prose>
          <p>
            "Full-stack ownership compounds" is too vague to be useful. Here is the specific chain, and it is the reason this
            company is built the way it is.
          </p>
        </Prose>

        <ol className="mt-8 space-y-px overflow-hidden rounded-verda-md border border-verda-line bg-verda-line">
          {CHAIN.map((link, i) => (
            <li key={link.because} className="bg-verda-surface px-5 py-4">
              <div className="flex gap-4">
                <span className="mt-0.5 font-verda-mono text-verda-label tabular-nums text-verda-trace-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="max-w-[62ch] text-verda-body text-verda-ink-2">
                  Because <strong className="font-semibold text-verda-ink">{link.because}</strong>, {link.therefore}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <Prose className="mt-8">
          <p>
            A competitor selling only hardware has no labels and no recipe control. One selling only software cannot control
            how images were captured. One selling generic kits with third-party nutrients cannot transfer a lab label to a
            customer's tower, because it is not the same solution.
          </p>
          <p className="text-verda-h2 font-semibold text-verda-forest-900">
            The moat is not data volume. It is that our data is controlled, comparable and causal.
          </p>
        </Prose>

        <LimitMark limit={LIMIT_SCALE} />
      </Section>

      <Section id="direction">
        <SectionHeading eyebrow="§9 · Direction">What this becomes</SectionHeading>
        <div className="mb-6">
          <TierBadge tier="direction" />
        </div>
        <Prose>
          <p>
            <strong className="font-semibold text-verda-ink">The revenue shape.</strong> Hardware acquires the customer.
            Consumables and software retain them. We are building a recurring-revenue business with a manufacturing front end.
          </p>
          <p>
            <strong className="font-semibold text-verda-ink">The sentence we are building towards.</strong> Not "we install
            hydroponic farms." Not "we have AI."
          </p>
        </Prose>
        <div className="mt-4 rounded-verda-md border border-verda-info/40 bg-verda-info/5 p-6">
          <p className="text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em] text-verda-forest-900">
            We sell farms that guarantee output. We don't just install them — we run them.
          </p>
          <p className="mt-3 max-w-[58ch] text-verda-body text-verda-ink-2">
            That becomes a sellable claim once monitoring is proven across multiple sites. It is the only claim in this
            business worth real money, which is exactly why we are not going to make it early.
          </p>
        </div>
      </Section>

      <Section id="not-doing">
        <SectionHeading eyebrow="§10">What we are deliberately not doing</SectionHeading>
        <ul className="max-w-[66ch] space-y-2.5">
          {[
            "Chasing disease classification before anomaly detection and deficiency work is done.",
            "Claiming pre-symptomatic detection.",
            "Discounting the consumer tower. Status positioning does not survive a festive sale.",
            "Scaling headcount before install margin is proven.",
            "Competing on model sophistication rather than unit economics.",
          ].map((item) => (
            <li key={item} className="flex gap-3 text-verda-body text-verda-ink-2">
              <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-verda-line-strong" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-verda-h2 font-semibold text-verda-forest-900">
          Sequencing is a strategy, not a limitation.
        </p>
      </Section>
    </PageShell>
  );
}
