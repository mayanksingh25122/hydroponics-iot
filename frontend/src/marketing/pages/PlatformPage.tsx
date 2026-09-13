import {
  Card,
  Display,
  Eyebrow,
  Lede,
  LimitMark,
  Prose,
  Section,
  SectionHeading,
  SpecList,
  TierBadge,
} from "@/marketing/chrome/primitives";
import {
  CONTROLLED_ACTUATORS,
  LIMIT_EC,
  MEASURED_CHANNELS,
} from "@/marketing/content/claims";
import { PageShell } from "./PageShell";

/**
 * /platform — narrative §3, "What runs today".
 *
 * Everything on this page is present tense because everything on it is
 * verifiable in the codebase: the dosing logic and safety gating are in
 * the firmware, the channels match the sensor_readings schema, and the
 * command lifecycle matches the API types.
 */
export default function PlatformPage() {
  return (
    <PageShell>
      <Section bleed className="pt-12 tablet:pt-16">
        <Eyebrow className="mb-3">Platform</Eyebrow>
        <Display>What runs today</Display>
        <Lede className="mt-5">
          Stated as fact, because you can come and see it. Automated dosing, continuous monitoring, the controller, the
          software, the consumables and the operating procedure. Everything on this page is running now.
        </Lede>
        <div className="mt-6">
          <TierBadge tier="shipping" />
        </div>
      </Section>

      <Section id="dosing">
        <SectionHeading eyebrow="§3.1">Automated nutrient dosing</SectionHeading>
        <Prose>
          <p>
            The system measures the reservoir and corrects it without a human — closed-loop against target EC and pH for the
            crop recipe in use.
          </p>
          <p>
            This is the highest-value automation in hydroponics, because nutrient drift is slow and invisible. By the time the
            plant shows it, the cycle is already lost.
          </p>
        </Prose>

        <div className="mt-8 grid gap-4 tablet:grid-cols-3">
          <Card>
            <p className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">Metered</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              Doses are delivered in millilitres against a calculated volume, not by running a pump for a fixed time.
            </p>
          </Card>
          <Card>
            <p className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">Rate limited</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              A per-cycle ceiling and a cooldown between doses. The system cannot chase a bad reading into an overdose.
            </p>
          </Card>
          <Card>
            <p className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">Interlocked</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              Dosing refuses to run before the probes are calibrated, and stops if the reservoir runs low.
            </p>
          </Card>
        </div>

        <div className="mt-8">
          <p className="mb-3 font-verda-mono text-verda-label uppercase tracking-[0.12em] text-verda-ink-3">
            Under closed-loop or remote control
          </p>
          <SpecList items={CONTROLLED_ACTUATORS} className="tablet:grid-cols-3" />
        </div>
      </Section>

      <Section id="monitoring">
        <SectionHeading eyebrow="§3.2">Continuous monitoring</SectionHeading>
        <Prose>
          <p>Sampled continuously, logged permanently, visible on a phone.</p>
        </Prose>
        <SpecList items={MEASURED_CHANNELS} className="mt-6 tablet:grid-cols-2" />
        <LimitMark limit={LIMIT_EC} />
      </Section>

      <Section id="software">
        <SectionHeading eyebrow="§3.3">The software</SectionHeading>
        <div className="grid gap-4 tablet:grid-cols-3">
          <Card>
            <p className="text-verda-h3 font-semibold text-verda-ink">Controller</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              ESP32 on FreeRTOS, on the unit. Local safety runs above the network: a command that would dry-run a pump is
              refused on the device, not in the cloud.
            </p>
          </Card>
          <Card>
            <p className="text-verda-h3 font-semibold text-verda-ink">Backend</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              FastAPI, with PostgreSQL on Supabase for storage. Session authentication, role-based access and device
              provisioning are built in-house.
            </p>
          </Card>
          <Card>
            <p className="text-verda-h3 font-semibold text-verda-ink">Canopy</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              The dashboard: every system, every reservoir, every trend line, live. Commands are queued and acknowledged by
              the device that carried them out.
            </p>
          </Card>
        </div>

        <div className="mt-8 rounded-verda-md border border-verda-line bg-verda-sage-wash p-5">
          <p className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">
            Why acknowledgement matters
          </p>
          <p className="mt-2 max-w-[64ch] text-verda-body text-verda-ink-2">
            A command is never reported as done because it was sent. It is queued, delivered, and then acknowledged by the
            controller with what actually happened — including when the answer is that safety refused it. The dashboard shows
            you the difference between what you asked for and what the machine did.
          </p>
        </div>
      </Section>

      <Section id="consumables">
        <SectionHeading eyebrow="§3.4">The consumables — made in-house</SectionHeading>
        <Prose>
          <p>
            Seeds, seedlings, growing media and nutrient formulations, produced by us and matched to our recipes. This is not a
            reselling arrangement. We control what goes into the water.
          </p>
          <p>
            That matters twice over. Commercially, it is recurring revenue from the day a unit is installed. Technically, it
            means we know the exact ionic composition behind every plant we have ever grown — which is what makes our data
            comparable across every site we operate.
          </p>
        </Prose>
      </Section>

      <Section id="sop">
        <SectionHeading eyebrow="§3.5">The SOP</SectionHeading>
        <Prose>
          <p>
            Every system ships with a written operating procedure: seeding, transplant timing, recipe schedule by growth stage,
            reservoir refresh cadence, cleaning, harvest.
          </p>
          <p>
            The SOP is a product. It is what converts equipment into a farm that someone with no hydroponics background can
            actually run — and it is the part most hydroponics vendors do not ship at all.
          </p>
        </Prose>
      </Section>
    </PageShell>
  );
}
