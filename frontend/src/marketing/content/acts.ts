import type { ClaimTier, Limit } from "./claims";
import { LIMIT_CAMERA, LIMIT_EC, LIMIT_SCALE } from "./claims";

/**
 * The nine acts of the homepage narrative.
 *
 * Copy is drawn from the company narrative, not invented; `source`
 * records which section each act came from so any line can be traced
 * back and checked. Scroll ranges drive the 3D scene — the DOM and the
 * canvas read the same table, which is what keeps the words and the
 * object in sync.
 */
export interface Act {
  id: string;
  index: number;
  /** Short name, used for the in-page progress rail. */
  name: string;
  /** Narrative section this act is drawn from. */
  source: string;
  tier: ClaimTier;
  /** Scroll window, 0–1 across the whole story. */
  from: number;
  to: number;
  /** Tower rotation at the START of this act, in degrees. */
  rotation: number;
  headline: string;
  body: string[];
  limit?: Limit;
}

export const ACTS: Act[] = [
  {
    id: "arrival",
    index: 1,
    name: "Arrival",
    source: "§1",
    tier: "shipping",
    from: 0,
    to: 0.1,
    rotation: 0,
    headline: "A farm, anywhere.",
    body: [
      "Hydroponic systems that run themselves — and everything that keeps them running.",
    ],
  },
  {
    id: "gap",
    index: 2,
    name: "The gap",
    source: "§2",
    tier: "shipping",
    from: 0.1,
    to: 0.18,
    rotation: 30,
    headline: "The plumbing was never the hard part.",
    body: [
      "Hydroponics is sold as hardware. Someone buys a system, receives a manual, and is then alone. The failure rate is high — and it is almost never the hardware that fails. It is the operation.",
      "Wrong EC. A pH drift nobody caught. A pump that stopped overnight. A root zone that got too warm in May.",
    ],
  },
  {
    id: "machine",
    index: 3,
    name: "The machine",
    source: "§3.1",
    tier: "shipping",
    from: 0.18,
    to: 0.31,
    rotation: 95,
    headline: "So we closed the loop.",
    body: [
      "The system measures the reservoir and corrects it without a human. Two nutrient pumps dose in metered millilitres, on a cooldown, and stop if the tank runs low.",
      "Nutrient drift is slow and invisible. By the time the plant shows it, the cycle is already lost.",
      "Remote commands are requests. Safety refuses them.",
    ],
  },
  {
    id: "anywhere",
    index: 4,
    name: "Anywhere",
    source: "§3.2 · §3.5",
    tier: "shipping",
    from: 0.31,
    to: 0.44,
    rotation: 240,
    headline: "Grow where people are.",
    body: [
      "Homes. Balconies. Cafés. Classrooms. Kitchens.",
      "pH, EC, water temperature and reservoir level — sampled continuously, logged permanently, visible on a phone.",
      "Every system ships with a written operating procedure. The SOP is what turns equipment into a farm someone with no hydroponics background can actually run.",
    ],
    limit: LIMIT_EC,
  },
  {
    id: "two-products",
    index: 5,
    name: "Two products",
    source: "§4",
    tier: "shipping",
    from: 0.44,
    to: 0.54,
    rotation: 400,
    headline: "Two products. One platform.",
    body: [
      "A smart tower for homes and cafés. Full NFT installations for commercial growers.",
      "They share the controller, the dosing logic, the software, the consumables and the agronomy.",
    ],
  },
  {
    id: "farm",
    index: 6,
    name: "The farm",
    source: "§3.6 · §4.1",
    tier: "shipping",
    from: 0.54,
    to: 0.68,
    rotation: 470,
    headline: "The same system, at scale.",
    body: [
      "An active commercial deployment with a lettuce grower serving the export market. A paying customer, a real crop, a real buyer.",
      "Every reading is stored. Every command is acknowledged by the device that carried it out — or refused, and told you why.",
    ],
  },
  {
    id: "compounds",
    index: 7,
    name: "What compounds",
    source: "§8",
    tier: "shipping",
    from: 0.68,
    to: 0.8,
    rotation: 545,
    headline: "We make what goes in the water.",
    body: [
      "Because we design the hardware, camera geometry and lighting are identical on every unit we have ever shipped.",
      "Because we make the nutrients, we know the exact ionic composition behind every plant — not an approximation, the actual recipe.",
      "Because we write the SOP, we know the schedule and the intervention history behind every reading.",
      "Because we own the dashboard, every correction a grower makes is recorded against the condition that prompted it.",
    ],
    limit: LIMIT_SCALE,
  },
  {
    id: "building",
    index: 8,
    name: "Being built",
    source: "§5",
    tier: "building",
    from: 0.8,
    to: 0.91,
    rotation: 625,
    headline: "First, the software learns to catch what breaks.",
    body: [
      "Pump failure. pH excursion. EC drift. Level fault. Rule-based, unglamorous, and it prevents real crop loss.",
      "Then: the same plant, from the same angle, under the same light, every day of its life.",
      "That turns plant health from an image problem into a time problem. If one plant's growth decelerates while its identical neighbours do not, something is wrong with that plant. No disease labels required.",
    ],
    limit: LIMIT_CAMERA,
  },
  {
    id: "destination",
    index: 9,
    name: "Destination",
    source: "§9",
    tier: "direction",
    from: 0.91,
    to: 1,
    rotation: 690,
    headline: "We sell farms that guarantee output. We don't just install them — we run them.",
    body: [
      "That becomes a sellable claim once monitoring is proven across multiple sites. We will say it when it is true.",
      "Let's grow something real.",
    ],
  },
];

/** Total rotation across the story: two full turns, back to the opening face. */
export const STORY_ROTATION_DEG = 720;
