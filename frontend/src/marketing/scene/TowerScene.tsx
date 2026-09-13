import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { easing } from "maath";
import { Group, Vector3 } from "three";
import type { DirectionalLight } from "three";
import { Backdrop } from "./Backdrop";
import { ENV_GLASSHOUSE, ENV_INTERIOR } from "./environments";
import { PlantSystem } from "./PlantSystem";
import { Tower } from "./Tower";
import { useScrollStory } from "./useScrollStory";

/**
 * The persistent cinematic scene.
 *
 * ONE canvas, mounted once, never remounted. The tower lives directly in
 * it and is never unmounted by an act change — that is what makes the
 * object continuous across environment transitions, and it is the single
 * most important structural decision in the whole experience.
 *
 * Everything scroll-driven is damped INSIDE the render loop. Scroll
 * writes a raw number to a store; nothing in React re-renders on scroll.
 */

/** Two full revolutions across the story, landing back on the opening face. */
export const TOTAL_ROTATION = Math.PI * 4;

/** Rotation smoothing, in seconds-to-target. Higher = heavier object. */
const ROTATION_SMOOTH_TIME = 0.38;
/** Camera is deliberately slower than the tower so moves feel operated, not snapped. */
const CAMERA_SMOOTH_TIME = 0.55;

export interface SceneTelemetry {
  fps: number;
  progress: number;
  /** Rendered rotation in degrees — NOT the target, so lag is visible. */
  rotationDeg: number;
  /** Degrees between target and rendered. This number IS the feel. */
  lagDeg: number;
  dpr: number;
}

interface CameraKey {
  at: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

/**
 * Camera path for the prototype. Deliberately restrained: a slow push-in,
 * a settle, then a pull-back that begins to imply scale. The production
 * acts extend this table; the interpolation code does not change.
 */
const CAMERA_PATH: CameraKey[] = [
  { at: 0.0, position: [0.0, 1.18, 3.55], lookAt: [0, 0.95, 0] },
  { at: 0.28, position: [0.0, 1.02, 2.95], lookAt: [0, 0.92, 0] },
  { at: 0.55, position: [0.35, 1.25, 3.2], lookAt: [0, 1.0, 0] },
  { at: 0.8, position: [0.0, 1.45, 4.1], lookAt: [0, 0.95, 0] },
  { at: 1.0, position: [0.0, 1.5, 4.9], lookAt: [0, 0.9, 0] },
];

function samplePath(progress: number, out: Vector3, lookOut: Vector3) {
  let upper = 1;
  while (upper < CAMERA_PATH.length - 1 && CAMERA_PATH[upper].at < progress) upper++;
  const a = CAMERA_PATH[upper - 1];
  const b = CAMERA_PATH[upper];
  const span = b.at - a.at;
  const raw = span > 0 ? (progress - a.at) / span : 0;
  const t = Math.min(1, Math.max(0, raw));
  // Smoothstep between keys so the path has no velocity discontinuity
  // where two segments meet — damping alone would not hide a corner.
  const s = t * t * (3 - 2 * t);

  out.set(
    a.position[0] + (b.position[0] - a.position[0]) * s,
    a.position[1] + (b.position[1] - a.position[1]) * s,
    a.position[2] + (b.position[2] - a.position[2]) * s
  );
  lookOut.set(
    a.lookAt[0] + (b.lookAt[0] - a.lookAt[0]) * s,
    a.lookAt[1] + (b.lookAt[1] - a.lookAt[1]) * s,
    a.lookAt[2] + (b.lookAt[2] - a.lookAt[2]) * s
  );
}

function CameraRig() {
  const desired = useMemo(() => new Vector3(), []);
  const desiredLook = useMemo(() => new Vector3(), []);
  const currentLook = useMemo(() => new Vector3(0, 0.95, 0), []);

  useFrame((state, delta) => {
    const progress = useScrollStory.getState().progress;
    samplePath(progress, desired, desiredLook);

    easing.damp3(state.camera.position, desired, CAMERA_SMOOTH_TIME, delta);
    // The look-at point is damped too. Pointing straight at the raw
    // target would make the camera snap its aim even while its position
    // eases — a subtle wrongness that reads as cheapness.
    easing.damp3(currentLook, desiredLook, CAMERA_SMOOTH_TIME, delta);
    state.camera.lookAt(currentLook);
  });

  return null;
}

interface StoryRigProps {
  onTelemetry?: (telemetry: SceneTelemetry) => void;
  reducedMotion: boolean;
}

function StoryRig({ onTelemetry, reducedMotion }: StoryRigProps) {
  const towerRef = useRef<Group>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const frames = useRef(0);
  const elapsed = useRef(0);
  const fps = useRef(60);

  useFrame((state, delta) => {
    const tower = towerRef.current;
    if (!tower) return;

    const progress = useScrollStory.getState().progress;
    const target = progress * TOTAL_ROTATION;

    if (reducedMotion) {
      // No easing, no inertia: the frame is composed correctly for the
      // current scroll position and nothing moves on its own.
      tower.rotation.y = target;
    } else {
      easing.damp(tower.rotation, "y", target, ROTATION_SMOOTH_TIME, delta);
    }

    // Key light drifts with the environment cross-fade so the two
    // environments are lit differently without the tower's own exposure
    // visibly jumping at the boundary.
    const key = keyRef.current;
    if (key) {
      const envMix = Math.min(1, Math.max(0, (progress - 0.44) / 0.19));
      easing.damp(
        key,
        "intensity",
        ENV_INTERIOR.keyIntensity +
          (ENV_GLASSHOUSE.keyIntensity - ENV_INTERIOR.keyIntensity) * envMix,
        0.4,
        delta
      );
      easing.damp(key.position, "x", -3.2 + 4.4 * envMix, 0.6, delta);
      easing.damp(key.position, "y", 4.2 + 1.6 * envMix, 0.6, delta);
    }

    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current >= 0.25) {
      fps.current = frames.current / elapsed.current;
      frames.current = 0;
      elapsed.current = 0;
      const rendered = tower.rotation.y;
      onTelemetry?.({
        fps: fps.current,
        progress,
        rotationDeg: (rendered * 180) / Math.PI,
        lagDeg: ((target - rendered) * 180) / Math.PI,
        dpr: state.gl.getPixelRatio(),
      });
    }
  });

  // Shadow frustum is sized to the tower, not the world — a loose
  // frustum spreads the same 1024² map over empty ground and the
  // contact shadow goes soft and muddy.
  return (
    <>
      <ambientLight intensity={ENV_INTERIOR.fillIntensity} color={ENV_INTERIOR.fillColor} />
      <hemisphereLight args={["#f2f5f1", "#b9c6bc", 0.55]} />
      <directionalLight
        ref={keyRef}
        position={[-3.2, 4.2, 2.6]}
        intensity={ENV_INTERIOR.keyIntensity}
        color={ENV_INTERIOR.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={3.0}
        shadow-camera-bottom={-0.6}
      />

      {/* Procedural IBL: gives the shell's clearcoat something real to
          reflect without fetching an HDRI over the network. */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.4}
          position={[-3.4, 2.2, 1.4]}
          scale={[5, 7, 1]}
          target={[0, 1, 0]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          position={[3.2, 1.4, -2.2]}
          scale={[4, 4, 1]}
          target={[0, 1, 0]}
          color="#e4efe8"
        />
        <Lightformer
          form="ring"
          intensity={0.5}
          position={[0, 6, 0]}
          scale={7}
          target={[0, 0, 0]}
          color="#ffffff"
        />
      </Environment>

      <Backdrop from={ENV_INTERIOR} to={ENV_GLASSHOUSE} />

      {/* The tower group is the ONLY thing scroll rotates. Plants are
          children, so the canopy travels with the object for free. */}
      <group ref={towerRef} name="TowerRoot">
        <Tower />
        <PlantSystem />
      </group>
    </>
  );
}

export interface TowerSceneProps {
  onTelemetry?: (telemetry: SceneTelemetry) => void;
  onPerformanceChange?: (factor: number) => void;
  reducedMotion?: boolean;
}

export function TowerScene({
  onTelemetry,
  onPerformanceChange,
  reducedMotion = false,
}: TowerSceneProps) {
  return (
    <Canvas
      /*
        Deliberately left on the default "always" loop.
        A visibility gate that flips frameloop to "never" looks like an
        obvious power win and is a trap: if the document is already
        hidden at mount, the canvas renders zero frames and there is no
        invalidate() path to recover, so the page stays permanently
        blank. Browsers already throttle rAF hard for hidden documents,
        which is the real saving; the DPR misreading that throttling
        used to cause is handled by PerformanceMonitor's bounds below.
      */
      // NOT shadows="soft": three 0.186 removed PCFSoftShadowMap, and
      // r3f's "soft" maps straight onto it — it warns on every frame and
      // silently falls back to plain PCF. Softness comes from a larger
      // map plus normalBias instead.
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 34, near: 0.1, far: 60, position: [0, 1.18, 3.55] }}
      // Decorative: the entire narrative also exists as DOM text, so a
      // screen reader gets the story with the canvas removed.
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}
    >
      {/*
        Bounds are derived from the display's ACTUAL refresh rate rather
        than left at the default, which assumes 60Hz. On a 30Hz panel —
        or any throttled context — a 60Hz assumption means the monitor
        sees every frame as a failure and ratchets DPR down permanently,
        so the page looks soft on hardware that was never struggling.
      */}
      <PerformanceMonitor
        onChange={({ factor }) => onPerformanceChange?.(factor)}
        bounds={(refreshRate) =>
          refreshRate > 90 ? [50, 90] : refreshRate > 45 ? [45, 60] : [24, 34]
        }
        flipflops={3}
      />
      <AdaptiveDpr pixelated={false} />
      <CameraRig />
      <StoryRig onTelemetry={onTelemetry} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
