import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { BackSide, Color, Mesh, MeshStandardMaterial, ShaderMaterial } from "three";
import { ENV_GLASSHOUSE, ENV_INTERIOR } from "./environments";
import type { EnvironmentPalette } from "./environments";
import { useScrollStory } from "./useScrollStory";

/**
 * Environment backdrop and ground, plus the one environment transition
 * the feasibility prototype needs to prove.
 *
 * This is the 2.5D approach from the blueprint reduced to its cheapest
 * honest form: a gradient sky shell with a directional light bloom, and a
 * ground plane. No room geometry, no props. The production acts swap the
 * gradient for depth-layered backplates using exactly this cross-fade
 * mechanism — one `uMix` uniform, damped, driving every colour at once.
 *
 * The point being tested: can an environment change completely WITHOUT
 * the tower appearing to cut, flicker, or shift? If the backdrop
 * cross-fades while tower lighting is continuous, the object survives the
 * transition and the brief's core rule holds.
 */

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vDirection;

  uniform vec3 uTopA, uHorizonA, uBottomA, uGlowA, uGlowDirA;
  uniform vec3 uTopB, uHorizonB, uBottomB, uGlowB, uGlowDirB;
  uniform float uMix;

  void main() {
    vec3 dir = normalize(vDirection);
    float h = dir.y;

    // Two-stop vertical gradient meeting at the horizon, with a soft
    // knee rather than a hard band.
    float upper = smoothstep(0.0, 0.62, h);
    float lower = smoothstep(0.0, -0.45, h);

    vec3 a = mix(uHorizonA, uTopA, upper);
    a = mix(a, uBottomA, lower);
    vec3 b = mix(uHorizonB, uTopB, upper);
    b = mix(b, uBottomB, lower);

    // A broad, very soft bloom standing in for a window or glazing.
    // Exponent kept low so it reads as diffuse light, never as a sun.
    float bloomA = pow(max(dot(dir, normalize(uGlowDirA)), 0.0), 3.2);
    float bloomB = pow(max(dot(dir, normalize(uGlowDirB)), 0.0), 3.2);
    a += uGlowA * bloomA * 0.42;
    b += uGlowB * bloomB * 0.42;

    gl_FragColor = vec4(mix(a, b, uMix), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface BackdropProps {
  from?: EnvironmentPalette;
  to?: EnvironmentPalette;
  /** Scroll window over which the environment cross-fades. */
  transitionStart?: number;
  transitionEnd?: number;
}

export function Backdrop({
  from = ENV_INTERIOR,
  to = ENV_GLASSHOUSE,
  transitionStart = 0.44,
  transitionEnd = 0.63,
}: BackdropProps) {
  const groundRef = useRef<Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTopA: { value: new Color(from.top) },
      uHorizonA: { value: new Color(from.horizon) },
      uBottomA: { value: new Color(from.bottom) },
      uGlowA: { value: new Color(from.glow) },
      uGlowDirA: { value: from.glowDirection },
      uTopB: { value: new Color(to.top) },
      uHorizonB: { value: new Color(to.horizon) },
      uBottomB: { value: new Color(to.bottom) },
      uGlowB: { value: new Color(to.glow) },
      uGlowDirB: { value: to.glowDirection },
      uMix: { value: 0 },
    }),
    [from, to]
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [uniforms]
  );

  const groundColors = useMemo(
    () => ({ from: new Color(from.ground), to: new Color(to.ground), scratch: new Color() }),
    [from, to]
  );

  useFrame((_, delta) => {
    const progress = useScrollStory.getState().progress;

    // Raw target, then damped. The smoothstep alone would already be
    // continuous, but damping means a fast scroll THROUGH the transition
    // still cross-fades at a watchable rate instead of snapping.
    const target =
      transitionEnd > transitionStart
        ? Math.min(1, Math.max(0, (progress - transitionStart) / (transitionEnd - transitionStart)))
        : 0;
    const eased = target * target * (3 - 2 * target);

    easing.damp(uniforms.uMix, "value", eased, 0.28, delta);

    const ground = groundRef.current;
    if (ground) {
      const mat = ground.material as MeshStandardMaterial;
      groundColors.scratch.copy(groundColors.from).lerp(groundColors.to, uniforms.uMix.value);
      mat.color.copy(groundColors.scratch);
    }
  });

  return (
    <group name="Backdrop">
      <mesh name="Sky_Shell" material={material} renderOrder={-1}>
        <sphereGeometry args={[42, 32, 16]} />
      </mesh>

      <mesh
        name="Ground"
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color={from.ground} roughness={0.92} metalness={0} />
      </mesh>
    </group>
  );
}
