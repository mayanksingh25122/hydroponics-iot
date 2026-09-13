import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { easing } from "maath";
import { Color, Group, Vector3 } from "three";
import type { AmbientLight, DirectionalLight } from "three";
import { Backdrop } from "./Backdrop";
import { ENV_INTERIOR, sampleEnvironment } from "./environments";
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
  { at: 0.0, position: [0.0, 1.15, 4.35], lookAt: [0, 0.92, 0] },
  { at: 0.28, position: [0.0, 1.0, 3.75], lookAt: [0, 0.9, 0] },
  { at: 0.55, position: [0.35, 1.25, 4.05], lookAt: [0, 0.98, 0] },
  { at: 0.8, position: [0.0, 1.5, 4.9], lookAt: [0, 0.95, 0] },
  { at: 1.0, position: [0.0, 1.55, 5.7], lookAt: [0, 0.9, 0] },
];

/**
 * Horizontal framing offset, by viewport aspect.
 *
 * On a wide viewport the narrative copy occupies the left third, so the
 * tower is panned right out from under it — the camera and its look-at
 * point shift together by the same amount, which slides the object
 * across the frame without rotating the view or introducing parallax
 * that would betray the move.
 *
 * On a portrait viewport the copy stacks below the object instead, so
 * the tower stays centred and the offset is zero.
 */
function framingShift(aspect: number): number {
  if (aspect < 1.1) return 0;
  // Ramps in across the range where a side-by-side layout starts to fit.
  const t = Math.min(1, (aspect - 1.1) / 0.5);
  return -0.46 * t;
}

function samplePath(progress: number, shiftX: number, out: Vector3, lookOut: Vector3) {
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

  // The framing shift is folded into the write rather than added
  // afterwards: these vectors are scratch buffers owned by the caller,
  // and writing them once keeps the frame loop free of read-modify-write
  // on values that live across renders.
  out.set(
    shiftX + a.position[0] + (b.position[0] - a.position[0]) * s,
    a.position[1] + (b.position[1] - a.position[1]) * s,
    a.position[2] + (b.position[2] - a.position[2]) * s
  );
  lookOut.set(
    shiftX + a.lookAt[0] + (b.lookAt[0] - a.lookAt[0]) * s,
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
    samplePath(progress, framingShift(state.viewport.aspect), desired, desiredLook);

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

const lerpValue = (from: number, to: number, mix: number) => from + (to - from) * mix;

function StoryRig({ onTelemetry, reducedMotion }: StoryRigProps) {
  const towerRef = useRef<Group>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const fillRef = useRef<AmbientLight>(null);
  const keyFrom = useMemo(() => new Color(), []);
  const keyTo = useMemo(() => new Color(), []);
  const fillFrom = useMemo(() => new Color(), []);
  const fillTo = useMemo(() => new Color(), []);
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

    // Lighting is sampled from the SAME environment curve the backdrop
    // uses, so the key light always arrives from the window that is
    // actually in frame. Damping on top means a fast scroll through a
    // boundary still relights at a watchable rate rather than snapping.
    const { from, to, mix } = sampleEnvironment(progress);
    const key = keyRef.current;
    if (key) {
      easing.damp(key, "intensity", lerpValue(from.keyIntensity, to.keyIntensity, mix), 0.4, delta);
      easing.damp3(
        key.position,
        [
          lerpValue(from.keyPosition[0], to.keyPosition[0], mix),
          lerpValue(from.keyPosition[1], to.keyPosition[1], mix),
          lerpValue(from.keyPosition[2], to.keyPosition[2], mix),
        ],
        0.55,
        delta
      );
      keyFrom.set(from.keyColor);
      keyTo.set(to.keyColor);
      key.color.copy(keyFrom).lerp(keyTo, mix);
    }

    const fill = fillRef.current;
    if (fill) {
      easing.damp(fill, "intensity", lerpValue(from.fillIntensity, to.fillIntensity, mix), 0.4, delta);
      fillFrom.set(from.fillColor);
      fillTo.set(to.fillColor);
      fill.color.copy(fillFrom).lerp(fillTo, mix);
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
      <fogExp2
        attach="fog"
        args={[ENV_INTERIOR.fogColor, ENV_INTERIOR.fogDensity]}
      />
      <ambientLight ref={fillRef} intensity={ENV_INTERIOR.fillIntensity} color={ENV_INTERIOR.fillColor} />
      <hemisphereLight args={["#f2f5f1", "#b9c6bc", 0.55]} />
      <directionalLight
        ref={keyRef}
        position={ENV_INTERIOR.keyPosition}
        intensity={ENV_INTERIOR.keyIntensity}
        color={ENV_INTERIOR.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={26}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-1.5}
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

      <Backdrop />

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
