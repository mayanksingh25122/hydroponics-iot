import { Link } from "react-router-dom";
import { POD_COUNT, TOWER_HEIGHT } from "@/marketing/scene/towerSpec";
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
 * /tower — narrative §4.2, the B2C smart tower.
 *
 * Site count and height are imported from the scene's layout module
 * rather than typed as prose, so the number quoted to a customer here
 * and the number of pods on the 3D model can never disagree.
 */
export default function TowerPage() {
  return (
    <PageShell>
      <Section bleed className="pt-12 tablet:pt-16">
        <Eyebrow className="mb-3">Smart tower · Homes, balconies, cafés</Eyebrow>
        <Display>A farm that fits in a room you live in.</Display>
        <Lede className="mt-5">
          A vertical hydroponic tower with {POD_COUNT} growing sites, fully automatic. Integrated lighting, automated dosing,
          app-connected — and an operating procedure that tells you what to do next.
        </Lede>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TierBadge tier="shipping" />
          <Link
            to="/contact"
            className="rounded-verda-sm bg-verda-forest-800 px-4 py-2 text-verda-caption font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700"
          >
            Grow with VERDA
          </Link>
        </div>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-verda-md border border-verda-line bg-verda-line tablet:grid-cols-4">
          {[
            { k: "Growing sites", v: String(POD_COUNT) },
            { k: "Height", v: `${TOWER_HEIGHT.toFixed(2)} m` },
            { k: "Dosing", v: "Two-part, automatic" },
            { k: "Monitoring", v: "Continuous" },
          ].map((stat) => (
            <div key={stat.k} className="bg-verda-surface px-4 py-4">
              <dt className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-ink-3">{stat.k}</dt>
              <dd className="mt-1 text-verda-metric-lg font-semibold tabular-nums text-verda-forest-800">{stat.v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section>
        <SectionHeading eyebrow="The failure mode we designed against">
          Most home hydroponics becomes furniture.
        </SectionHeading>
        <Prose>
          <p>
            Home hydroponics worldwide has one consistent failure mode: the unit is bought, loved for two months, and becomes
            furniture. Not because it broke — because the owner did not know what to do next.
          </p>
          <p>
            That is an operating problem, not a hardware problem, and it is the one we set out to solve. The tower doses itself
            and monitors itself. The app tells you when something needs you. The SOP tells you what to do about it.
          </p>
        </Prose>
      </Section>

      <Section>
        <SectionHeading eyebrow="§4.2">Design is a specification, not marketing.</SectionHeading>
        <Prose>
          <p>
            A tower on a balcony is visible to every neighbour. It is bought as an object first and a farm second. If it looks
            like laboratory equipment it dies in a cupboard; if it looks considered, it sells the next one without us spending
            anything.
          </p>
          <p>
            Silhouette, material quality, concealed machinery and warm light are engineering requirements with a commercial
            return, and we treat them that way.
          </p>
        </Prose>

        <div className="mt-8 grid gap-4 tablet:grid-cols-2">
          <Card>
            <p className="text-verda-h3 font-semibold text-verda-ink">Machinery is concealed</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              Reservoir, pumps, dosing lines and controller live in the base. What you see is a white column and a canopy.
            </p>
          </Card>
          <Card>
            <p className="text-verda-h3 font-semibold text-verda-ink">The sites spiral</p>
            <p className="mt-2 text-verda-body text-verda-ink-2">
              Each level is rotated against the one below, so no plant sits directly under another and the tower reads the same
              from every angle.
            </p>
          </Card>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="How it is priced">The tower is the start, not the transaction.</SectionHeading>
        <Prose>
          <p>
            The tower is margin-positive on its own terms — we are not seeding units below cost to harvest data. But the
            relationship is the consumables: seeds, growing media and nutrient concentrate, made by us, matched to the recipes
            the controller is dosing against.
          </p>
          <p>
            A tower that stops being used is a dead brown object on a balcony. So retention is the metric we hold ourselves to,
            and the app, the reminders and the SOP are not features — they are how the thing keeps working.
          </p>
        </Prose>
      </Section>
    </PageShell>
  );
}
