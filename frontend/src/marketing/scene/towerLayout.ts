import { Euler, Quaternion, Vector3 } from "three";

/**
 * Canonical VERDA tower dimensions and pod layout.
 *
 * SCENE UNITS: 1 unit = 1 metre. Every number below is a real-world
 * measurement, so the authored Blender asset can be modelled to these
 * figures directly and exported at scale 1 with no conversion step.
 *
 * This module is the CONTRACT between the procedural prototype tower and
 * the authored GLB that will eventually replace it. The GLB must expose
 * 24 pod sockets whose world transforms match `POD_SOCKETS` below; when
 * it does, PlantSystem binds to the real asset with no code change — it
 * reads socket transforms from here either way.
 */

/** Overall height, floor to cap. */
export const TOWER_HEIGHT = 1.8;

/** Radius of the main growing column (not the base, which is wider). */
export const COLUMN_RADIUS = 0.155;

/** Base reservoir: a wider, shorter cylinder the column stands on. */
export const BASE_HEIGHT = 0.3;
export const BASE_RADIUS_TOP = 0.21;
export const BASE_RADIUS_BOTTOM = 0.24;

/** Cap assembly above the top growing segment. */
export const CAP_HEIGHT = 0.12;
export const CAP_RADIUS = 0.17;

/** Growing column spans base top → cap bottom, divided into segments. */
export const SEGMENT_COUNT = 6;
export const PODS_PER_SEGMENT = 4;
export const POD_COUNT = SEGMENT_COUNT * PODS_PER_SEGMENT;

export const COLUMN_BOTTOM = BASE_HEIGHT;
export const COLUMN_TOP = TOWER_HEIGHT - CAP_HEIGHT;
export const COLUMN_HEIGHT = COLUMN_TOP - COLUMN_BOTTOM;
export const SEGMENT_HEIGHT = COLUMN_HEIGHT / SEGMENT_COUNT;

/**
 * Each segment is rotated relative to the one below it, so the pods
 * describe a helix rather than four vertical columns. 15° per segment
 * over 6 segments sweeps 90° in total — by the top segment the pods sit
 * exactly between the bottom segment's, which is what stops the tower
 * reading as a flat facade from any single angle.
 */
export const SEGMENT_TWIST_DEG = 15;

/**
 * Pod collar protrudes from the shell, angled up so water drains inward.
 *
 * Protrusion is deliberately shallow. A long collar with a dark disc in
 * it reads as a camera lens — four of them around a white column turn
 * the tower into a face. Keeping the collar close to the shell makes the
 * pod read as an aperture cut INTO the surface, which is both what real
 * vertical towers look like and what keeps the object architectural.
 */
export const POD_LENGTH = 0.052;
export const POD_RADIUS_OUTER = 0.05;
export const POD_RADIUS_INNER = 0.036;
export const POD_TILT_DEG = 34;

export interface PodSocket {
  /** Stable identity, matching the Blender node name `Pod_00` … `Pod_23`. */
  name: string;
  index: number;
  segment: number;
  /** Centre of the pod's outer mouth — where a plant's root crown sits. */
  position: Vector3;
  /** Orientation with +Y along the pod axis (outward and upward). */
  rotation: Euler;
  /** Unit vector along the pod axis. Plants grow along this, then bend up. */
  axis: Vector3;
  /**
   * Position of the collar's midpoint rather than its mouth — used to
   * place the collar mesh itself, since a cylinder is centred on its axis.
   */
  collarPosition: Vector3;
}

const UP = new Vector3(0, 1, 0);

function buildSockets(): PodSocket[] {
  const sockets: PodSocket[] = [];
  const tilt = Math.tan((POD_TILT_DEG * Math.PI) / 180);

  for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
    // Pods sit at the vertical centre of their segment.
    const y = COLUMN_BOTTOM + (segment + 0.5) * SEGMENT_HEIGHT;
    const twist = (segment * SEGMENT_TWIST_DEG * Math.PI) / 180;

    for (let pod = 0; pod < PODS_PER_SEGMENT; pod++) {
      const theta = twist + (pod * Math.PI * 2) / PODS_PER_SEGMENT;

      // Axis points radially outward, lifted by the tilt angle.
      const axis = new Vector3(Math.sin(theta), tilt, Math.cos(theta)).normalize();

      // A cylinder's local axis is +Y, so rotate +Y onto the pod axis.
      const quaternion = new Quaternion().setFromUnitVectors(UP, axis);
      const rotation = new Euler().setFromQuaternion(quaternion);

      // Start at the shell surface, then travel along the axis.
      const root = new Vector3(Math.sin(theta) * COLUMN_RADIUS, y, Math.cos(theta) * COLUMN_RADIUS);
      const position = root.clone().addScaledVector(axis, POD_LENGTH);
      const collarPosition = root.clone().addScaledVector(axis, POD_LENGTH * 0.5);

      const index = segment * PODS_PER_SEGMENT + pod;
      sockets.push({
        name: `Pod_${String(index).padStart(2, "0")}`,
        index,
        segment,
        position,
        rotation,
        axis,
        collarPosition,
      });
    }
  }

  return sockets;
}

/** Computed once at module load — the layout is static. */
export const POD_SOCKETS: readonly PodSocket[] = buildSockets();

/**
 * Per-pod growth from global story progress.
 *
 * Pods do not all grow at once, and they do not grow in index order —
 * that would read as a mechanical sweep up the tower. Instead each pod
 * gets a deterministic pseudo-random offset within its segment's window,
 * so growth propagates upward as a loose, organic wave.
 *
 * `spread` is how much of the progress range is consumed by the stagger;
 * the remainder is each individual pod's own growth duration.
 */
const SEEDLING_FLOOR = 0.16;

export function podGrowth(index: number, progress: number, spread = 0.55): number {
  const segment = Math.floor(index / PODS_PER_SEGMENT);
  const withinSegment = index % PODS_PER_SEGMENT;

  // Deterministic jitter in [0, 1) — a hash, not Math.random(), so the
  // layout is identical on every load and on every machine.
  const jitter = ((Math.sin(index * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;

  const segmentPhase = segment / SEGMENT_COUNT;
  const podPhase = (withinSegment + jitter) / (PODS_PER_SEGMENT * SEGMENT_COUNT);
  const start = (segmentPhase + podPhase) * spread;
  const duration = 1 - spread;

  // The opening frame is not an empty tower: the bottom row already
  // holds seedlings, so the visitor sees a system that is running and
  // watches it fill, rather than watching it switch on. Storyboard Act
  // 01 calls for exactly this — four seedlings, twenty empty pods.
  const floor = index < PODS_PER_SEGMENT ? SEEDLING_FLOOR : 0;

  const t = (progress - start) / duration;
  if (t <= 0) return floor;
  if (t >= 1) return 1;
  // Smoothstep: a plant should ease into and out of its growth, never
  // start or stop at a constant rate.
  return Math.max(floor, t * t * (3 - 2 * t));
}
