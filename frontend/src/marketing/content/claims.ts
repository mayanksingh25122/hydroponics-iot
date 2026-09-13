/**
 * Claim governance.
 *
 * Every public-facing statement about what VERDA can do carries a tier.
 * The tier is not decoration — it decides the grammar the copy is
 * allowed to use, and `NEVER_CLAIM` is a hard list of sentences that
 * must not appear on this site in any form, including metadata and
 * structured data.
 *
 * Source: company narrative §0 ("three tenses, deliberately separated"),
 * §6 ("what we are honest about") and §10 ("what we are deliberately not
 * doing"), cross-checked against the firmware GPIO map, the
 * sensor_readings schema and the frontend API types.
 */

export type ClaimTier = "shipping" | "building" | "direction";

export const TIER_LABEL: Record<ClaimTier, string> = {
  shipping: "Running today",
  building: "Being built",
  direction: "Direction",
};

export const TIER_RULE: Record<ClaimTier, string> = {
  shipping: "Stated as fact. You can come and see it.",
  building: "Work in progress, with the mechanism exposed so you can judge it.",
  direction: "Where this goes. Not a description of today.",
};

/**
 * Sensor channels that actually exist.
 *
 * VERIFIED against firmware/finalhardwarefile/finalhardwarefile.ino
 * (GPIO34 pH, GPIO35 TDS/EC, GPIO4 DS18B20, GPIO5+18 HC-SR04) and
 * backend/app/models/sensor_reading.py.
 *
 * Narrative §3.2 additionally lists air temperature, humidity and
 * substrate moisture. NONE of those exist in this repository — no
 * sensor in the GPIO map, no column in the schema, no field in the API
 * types — so they are deliberately absent here. Do not add a channel to
 * this list until a reading for it can be pulled from a real device.
 */
export const MEASURED_CHANNELS = [
  { label: "pH", detail: "Acidity of the nutrient solution" },
  { label: "EC / TDS", detail: "Total dissolved salt — solution strength" },
  { label: "Water temperature", detail: "Root-zone temperature at the reservoir" },
  { label: "Reservoir level", detail: "Ultrasonic distance to the waterline" },
] as const;

/** Actuators under closed-loop or remote control. Firmware-verified. */
export const CONTROLLED_ACTUATORS = [
  { label: "Nutrient pump A", detail: "12 V dosing pump, metered in millilitres" },
  { label: "Nutrient pump B", detail: "Second part of the two-part formulation" },
  { label: "Circulation pump", detail: "230 V AC, gated against dry running" },
] as const;

/**
 * Sentences that must never be published. Not "not yet" — never.
 *
 * Narrative §6 stakes the company's credibility on being precise about
 * exactly these, so publishing one of them costs more than any claim it
 * could win. Reviewed on every copy change.
 */
export const NEVER_CLAIM = [
  "Pre-symptomatic detection of any kind",
  "A per-ion concentration inferred from EC or TDS (“calcium is 142 ppm”)",
  "Detection of root-zone disease by camera",
  "Hyperspectral sensing (as opposed to inferred or reconstructed spectral data)",
  "Exponential data network effects",
  "Spectral super-resolution anywhere in product literature",
  "Plural customers, deployments or farms while there is one",
] as const;

/**
 * The limits, stated beside the claims they bound rather than collected
 * into a disclaimer at the bottom of the page. Narrative §6: "stating
 * them first is why the rest is believed."
 */
export interface Limit {
  id: string;
  heading: string;
  body: string;
}

export const LIMIT_EC: Limit = {
  id: "ec",
  heading: "What EC cannot do",
  body:
    "EC tells us total solution strength. It cannot tell us calcium — six unknown ions, one equation, and no calibration " +
    "creates information that is not in the signal. A TDS probe is an EC probe with a conversion factor: one measurement " +
    "reported as two numbers. We dose on strength, and we do not claim a number we do not have.",
};

export const LIMIT_CAMERA: Limit = {
  id: "camera",
  heading: "What the camera cannot do",
  body:
    "We expect to detect problems earlier than a person notices them. We do not expect to detect them before symptoms " +
    "exist — that needs near-infrared, fluorescence or thermal optics, not more photographs. And root-zone disease is " +
    "below the waterline, where a camera cannot see it at all.",
};

export const LIMIT_SCALE: Limit = {
  id: "scale",
  heading: "What scale does not do",
  body:
    "Data grows linearly with customers, not exponentially, and model performance improves logarithmically. What compounds " +
    "is variance — which is why a farm in a different city with different water is worth more to us than another tower on a " +
    "site we already run.",
};
