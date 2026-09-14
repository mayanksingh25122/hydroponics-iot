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
import { LIMIT_CAMERA, LIMIT_EC, LIMIT_SCALE } from "@/marketing/content/claims";
import { PageShell } from "./PageShell";

/** Narrative §5.3 — the induced-stress treatments run against a healthy baseline. */
const TREATMENTS = [
  ["Nitrogen deficiency", "Omit N"],
  ["Iron deficiency", "Omit Fe, or raise pH above 7.0"],
  ["Calcium deficiency", "Omit Ca — produces tipburn, the primary NFT lettuce defect"],
  ["Magnesium deficiency", "Omit Mg"],
  ["pH excursion", "Hold at 4.5 / 6.0 / 7.5"],
  ["EC stress", "Hold at 0.8 / 1.8 / 3.0 mS/cm"],
  ["Root hypoxia", "Reduced aeration, elevated water temperature"],
  ["Heat stress", "Elevated ambient"],
  ["Water stress", "Intermittent pump interruption"],
];

/** Narrative §5.5 — deliberately ordered by what is achievable, not what sounds impressive. */
const BUILD_ORDER = [
  ["Anomaly detection", "On growth trajectory and sensor streams. No labels needed — months, not years.", "building"],
  ["Biomass and yield regression", "Labels come free from the weighing scale. Highest immediate commercial value.", "building"],
  ["Deficiency classification", "The lab compresses this from years into months.", "direction"],
  ["Disease classification", "Deliberately deprioritised.", "direction"],
] as const;

/** /research — narrative §5, §6, §10. */
export default function ResearchPage() {
  return (
    <PageShell>
      <Section bleed className="pt-12 tablet:pt-16">
        <Eyebrow className="mb-3">Research</Eyebrow>
        <Display>What we are building, and what we will not claim.</Display>
        <Lede className="mt-5">
          Stated as work in progress, with the mechanism exposed so you can judge whether it is real. Anyone technical will
          test the limits of this within five minutes of meeting us — so they are on this page, next to the claims they bound.
        </Lede>
        <div className="mt-6">
          <TierBadge tier="building" />
        </div>
      </Section>

      <Section id="monitoring">
        <SectionHeading eyebrow="§5.1">Automated monitoring — first</SectionHeading>
        <Prose>
          <p>
            Before any machine learning, the software learns to catch what breaks. Pump failure. pH excursion. EC drift. Level
            fault. Reservoir temperature crossing the root-hypoxia threshold.
          </p>
          <p>
            Rule-based, unglamorous, and it prevents real crop loss within weeks of being switched on. We call it automated
            monitoring, because that is what it is.
          </p>
        </Prose>
      </Section>

      <Section id="camera">
        <SectionHeading eyebrow="§5.2">The camera, and why it is the interesting part</SectionHeading>
        <Prose>
          <p>
            Every system gets a fixed camera — rigidly mounted, its own light, the same capture time daily, a colour
            calibration card and scale reference in frame.
          </p>
          <p className="text-verda-h2 font-semibold text-verda-forest-900">
            The value is not that we get pictures of plants. It is that we get the same plant, from the same angle, under the
            same light, every day of its life.
          </p>
          <p>
            That turns plant health from an image-classification problem into a time-series problem. Almost everyone doing
            computer vision in agriculture is classifying single photographs, and they are all competing for the same scarce
            resource: labelled disease imagery.
          </p>
          <p>
            We do not need it. If one plant's growth decelerates over three days while its identical neighbours — same channel,
            same light, same age, same formulation — do not, something is wrong with that plant. Anomaly detection against its
            own trajectory and its cohort. Zero disease labels required.
          </p>
          <p>
            This is only possible in a controlled environment with a fixed rig and a known recipe. It is a direct consequence
            of the kind of farming we do and the fact that we make the nutrients.
          </p>
        </Prose>
        <LimitMark limit={LIMIT_CAMERA} />
      </Section>

      <Section id="lab">
        <SectionHeading eyebrow="§5.3">The lab</SectionHeading>
        <Prose>
          <p>
            We run a controlled research setup in parallel with commercial deployments — separate reservoirs, matched
            simultaneous controls, deliberate induced stress, alongside a continuously running healthy baseline across full
            lifecycles.
          </p>
        </Prose>

        <div className="mt-6 overflow-x-auto rounded-verda-md border border-verda-line">
          <table className="w-full border-collapse bg-verda-surface text-left">
            <caption className="sr-only">Induced-stress treatments run in the VERDA research setup</caption>
            <thead>
              <tr className="bg-verda-sage-wash">
                <th scope="col" className="border-b border-verda-line-strong px-4 py-3 font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">
                  Treatment
                </th>
                <th scope="col" className="border-b border-verda-line-strong px-4 py-3 font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">
                  Method
                </th>
              </tr>
            </thead>
            <tbody>
              {TREATMENTS.map(([treatment, method]) => (
                <tr key={treatment}>
                  <th scope="row" className="border-b border-verda-line-subtle px-4 py-3 text-verda-body font-medium text-verda-ink">
                    {treatment}
                  </th>
                  <td className="border-b border-verda-line-subtle px-4 py-3 text-verda-body text-verda-ink-2">{method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Prose className="mt-8">
          <p>
            In controlled-environment agriculture we know every input exactly, and we can intervene. That means we generate
            causal data, not correlational data. A company holding a billion rows of field observations cannot run an
            experiment, because they cannot make it stop raining.
          </p>
          <p>
            The lab produces what is genuinely scarce: early-stage, labelled progression imagery. Day one of an iron deficiency
            is the valuable image. Day fourteen is worthless — by then anyone can see it.
          </p>
          <p>
            And because the lab runs on the same nutrient formulations our customers use, the labels transfer directly to the
            field. That is not true for anyone buying generic nutrients off a shelf.
          </p>
        </Prose>
      </Section>

      <Section id="architecture">
        <SectionHeading eyebrow="§5.4">The architecture</SectionHeading>
        <div className="rounded-verda-md border border-verda-line bg-verda-surface p-6">
          <p className="text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em] text-verda-forest-900">
            Expensive instruments generate labels in the lab. Cheap cameras infer in the field.
          </p>
          <p className="mt-3 max-w-[62ch] text-verda-body text-verda-ink-2">
            Most people get this backwards and try to put good sensors everywhere. Ion-selective electrodes genuinely measure
            individual ions, and they belong in a lab where someone recalibrates them twice a week. They do not belong on a
            customer's tower, where they will drift and lie.
          </p>
        </div>
      </Section>

      <Section id="order">
        <SectionHeading eyebrow="§5.5">Build order</SectionHeading>
        <ol className="grid gap-4 tablet:grid-cols-2">
          {BUILD_ORDER.map(([title, detail, tier], i) => (
            <Card as="li" key={title}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-verda-mono text-verda-label tabular-nums text-verda-trace-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <TierBadge tier={tier} />
              </div>
              <p className="mt-3 text-verda-h3 font-semibold text-verda-ink">{title}</p>
              <p className="mt-1.5 text-verda-caption leading-[1.6] text-verda-ink-2">{detail}</p>
            </Card>
          ))}
        </ol>
      </Section>

      <Section id="honest">
        <SectionHeading eyebrow="§6">What we are honest about</SectionHeading>
        <Prose>
          <p>
            Anyone technical will test these limits within five minutes of meeting us. Stating them first is why the rest is
            believed.
          </p>
        </Prose>
        <div className="mt-6 space-y-5">
          <LimitMark limit={LIMIT_EC} className="mt-0" />
          <div className="max-w-[60ch] rounded-r-verda-sm border-l-2 border-verda-warn bg-verda-sage-wash px-4 py-3">
            <p className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-warn">
              What we can do instead
            </p>
            <p className="mt-1 text-verda-caption leading-[1.6] text-verda-ink-2">
              Mass-balance inference: known starting recipe, plus dose logs, plus volume, plus days since refresh, plus plant
              count, plus pH trajectory, yields a probabilistic estimate of ratio drift. That supports "this reservoir has
              likely drifted, refresh it." It does not support "calcium is 142 ppm," and we will not claim otherwise. Notably,
              this is only available to us because we made the starting recipe.
            </p>
          </div>
          <LimitMark limit={LIMIT_CAMERA} className="mt-0" />
          <LimitMark limit={LIMIT_SCALE} className="mt-0" />
        </div>
      </Section>
    </PageShell>
  );
}
