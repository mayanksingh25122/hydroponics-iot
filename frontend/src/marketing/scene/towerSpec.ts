/**
 * VERDA tower dimensions and site count — plain numbers, no dependencies.
 *
 * Deliberately separate from towerLayout.ts, which imports three.js to
 * compute pod socket transforms. Marketing pages quote the site count
 * and height as product facts; importing them from the layout module
 * would drag the whole WebGL renderer into /tower's bundle to display
 * two integers. This module is the safe half to import from anywhere.
 *
 * SCENE UNITS: 1 unit = 1 metre. Every value is a real measurement, so
 * the authored Blender asset is modelled to these figures directly and
 * exported at scale 1 with no conversion step.
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

/**
 * Growing column spans base top → cap bottom, divided into segments.
 *
 * 8 × 5 = 40 growing sites, mid-range of the 30–48 quoted for the smart
 * tower in the company narrative (§4.2). Site count is the single most
 * load-bearing product number in this file: it is quoted to customers,
 * it sets consumable volume, and it drives the whole canopy. Change it
 * here and the geometry, the plant canopy, the growth stagger and the
 * figure on /tower all follow — nothing downstream hardcodes 40.
 */
export const SEGMENT_COUNT = 8;
export const PODS_PER_SEGMENT = 5;
export const POD_COUNT = SEGMENT_COUNT * PODS_PER_SEGMENT;

export const COLUMN_BOTTOM = BASE_HEIGHT;
export const COLUMN_TOP = TOWER_HEIGHT - CAP_HEIGHT;
export const COLUMN_HEIGHT = COLUMN_TOP - COLUMN_BOTTOM;
export const SEGMENT_HEIGHT = COLUMN_HEIGHT / SEGMENT_COUNT;

/**
 * Each segment is rotated relative to the one below it, so the pods
 * describe a helix rather than vertical columns of pods.
 *
 * Derived, not hardcoded: one pod-pitch (360° / pods-per-segment) spread
 * across the full stack. By the top segment the pods sit exactly between
 * the bottom segment's, which is what stops the tower reading as a flat
 * facade from any single angle — and it stays true for any site count.
 */
export const SEGMENT_TWIST_DEG = 360 / PODS_PER_SEGMENT / SEGMENT_COUNT;

/**
 * Pod collar protrudes from the shell, angled up so water drains inward.
 *
 * Protrusion is deliberately shallow. A long collar with a dark disc in
 * it reads as a camera lens — five of them around a white column turn
 * the tower into a face. Keeping the collar close to the shell makes the
 * pod read as an aperture cut INTO the surface, which is both what real
 * vertical towers look like and what keeps the object architectural.
 */
export const POD_LENGTH = 0.046;
export const POD_RADIUS_OUTER = 0.043;
export const POD_RADIUS_INNER = 0.031;
export const POD_TILT_DEG = 34;
