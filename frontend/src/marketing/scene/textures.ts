import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Texture } from "three";

/**
 * Procedurally generated surface textures.
 *
 * Everything here is drawn into a canvas at load rather than fetched,
 * for two reasons: the page ships no image bytes for its environments,
 * and a texture that is generated can be authored as code — the grain
 * density of the wood is a number in this file, not a decision frozen
 * into a PNG by whoever made it.
 *
 * Every texture is GREYSCALE and centred on mid-grey. It carries
 * luminance detail only; hue always comes from the material colour or
 * the per-instance colour it multiplies against. That separation is
 * what lets one wood texture serve walnut, oak and a pale birch bench
 * without three images.
 */

export type PropMaterial = "plaster" | "wood" | "fabric" | "metal";

/** Atlas tile order. Index into this is what the shader receives. */
export const PROP_MATERIALS: readonly PropMaterial[] = [
  "plaster",
  "wood",
  "fabric",
  "metal",
] as const;

export function propMaterialIndex(material: PropMaterial | undefined): number {
  if (!material) return 0;
  const index = PROP_MATERIALS.indexOf(material);
  return index < 0 ? 0 : index;
}

/** Deterministic value noise — no Math.random, so every load is identical. */
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function fill(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, value: number) {
  const v = Math.max(0, Math.min(255, Math.round(value)));
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(x, y, size, size);
}

/** Fine speckle. Plaster, paint, matte board. */
function drawPlaster(ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) {
  fill(ctx, ox, oy, size, 128);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = hash2(x, y);
      ctx.fillStyle = `rgba(${n > 0.5 ? 255 : 0},${n > 0.5 ? 255 : 0},${n > 0.5 ? 255 : 0},0.035)`;
      ctx.fillRect(ox + x, oy + y, 2, 2);
    }
  }
}

/** Horizontal grain with occasional darker lines. Timber, veneer. */
function drawWood(ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) {
  fill(ctx, ox, oy, size, 128);
  for (let y = 0; y < size; y++) {
    // Slow band variation plus a fast fine grain on top of it.
    const band = Math.sin(y * 0.09 + Math.sin(y * 0.021) * 3.2) * 11;
    const fine = (hash2(0, y) - 0.5) * 9;
    const v = 128 + band + fine;
    ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    ctx.fillRect(ox, oy + y, size, 1);
  }
  // A few knots and darker figure lines.
  for (let i = 0; i < 5; i++) {
    const y = hash2(i * 7.3, 1) * size;
    ctx.strokeStyle = "rgba(0,0,0,0.09)";
    ctx.lineWidth = 1 + hash2(i, 2) * 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy + y);
    ctx.bezierCurveTo(
      ox + size * 0.3,
      oy + y + 6,
      ox + size * 0.7,
      oy + y - 6,
      ox + size,
      oy + y + 2
    );
    ctx.stroke();
  }
}

/** Cross-hatch weave. Upholstery, rug, curtain. */
function drawFabric(ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) {
  fill(ctx, ox, oy, size, 128);
  const pitch = 4;
  for (let y = 0; y < size; y += pitch) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(ox, oy + y, size, 1);
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(ox, oy + y + 2, size, 1);
  }
  for (let x = 0; x < size; x += pitch) {
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(ox + x, oy, 1, size);
    ctx.fillStyle = "rgba(0,0,0,0.045)";
    ctx.fillRect(ox + x + 2, oy, 1, size);
  }
  // Slubs — the small irregularities that stop a weave reading as a grid.
  for (let i = 0; i < 90; i++) {
    const x = hash2(i, 11) * size;
    const y = hash2(i, 13) * size;
    ctx.fillStyle = hash2(i, 17) > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(ox + x, oy + y, 2, 1);
  }
}

/** Fine vertical brushing. Stainless, anodised, appliance. */
function drawMetal(ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) {
  fill(ctx, ox, oy, size, 128);
  for (let x = 0; x < size; x++) {
    const v = 128 + (hash2(x, 5) - 0.5) * 14 + Math.sin(x * 0.7) * 2.5;
    ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    ctx.fillRect(ox + x, oy, 1, size);
  }
}

/**
 * A 2×2 atlas of the four prop materials.
 *
 * One atlas means the entire furnished world stays a single
 * InstancedMesh with a single material — instances pick their tile by
 * index, so a sofa and a stainless counter render in the same draw
 * call.
 */
export function createPropAtlas(): Texture {
  const tile = 256;
  const canvas = document.createElement("canvas");
  canvas.width = tile * 2;
  canvas.height = tile * 2;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    drawPlaster(ctx, 0, 0, tile);
    drawWood(ctx, tile, 0, tile);
    drawFabric(ctx, 0, tile, tile);
    drawMetal(ctx, tile, tile, tile);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Floorboards with a subtle plank break. Used for the ground plane. */
export function createFloorTexture(): Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    fill(ctx, 0, 0, size, 132);
    const plank = 64;
    for (let i = 0; i * plank < size; i++) {
      const y = i * plank;
      const tone = 132 + (hash2(i, 3) - 0.5) * 16;
      ctx.fillStyle = `rgb(${tone | 0},${tone | 0},${tone | 0})`;
      ctx.fillRect(0, y, size, plank);
      // Grain within the plank.
      for (let g = 0; g < plank; g += 2) {
        const v = tone + (hash2(i * 31 + g, 7) - 0.5) * 7;
        ctx.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.55)`;
        ctx.fillRect(0, y + g, size, 1);
      }
      // Plank seam.
      ctx.fillStyle = "rgba(0,0,0,0.13)";
      ctx.fillRect(0, y, size, 1.5);
      // Staggered end joints.
      const joint = hash2(i, 23) * size;
      ctx.fillRect(joint, y, 1.5, plank);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(9, 9);
  texture.anisotropy = 8;
  return texture;
}

/** Very low-contrast plaster for the back wall and ceiling. */
export function createWallTexture(): Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) drawPlaster(ctx, 0, 0, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(22, 7);
  return texture;
}
