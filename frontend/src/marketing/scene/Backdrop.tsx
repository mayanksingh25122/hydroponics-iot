import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BoxGeometry, Color, MeshStandardMaterial, Object3D, ShaderMaterial } from "three";
import type { FogExp2, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { ENV_LIVING_ROOM, MAX_PROPS, sampleEnvironment } from "./environments";
import { useScrollStory } from "./useScrollStory";

/**
 * The world around the tower: sky, ground, back wall, ceiling, window,
 * and an instanced field of furniture.
 *
 * NOTHING here is ever mounted or unmounted by an act change. Every
 * environment is the same objects at different proportions, so a living
 * room becomes a café becomes a glasshouse without the tower appearing
 * to cut, flicker or shift — the brief's one non-negotiable rule.
 *
 * All thirty props across all nine rooms are a single InstancedMesh:
 * one draw call for the entire furnished world, at any scroll position.
 * The whole built environment costs five draw calls in total.
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
  uniform vec3 uTop, uHorizon, uBottom, uGlow, uGlowDir;

  void main() {
    vec3 dir = normalize(vDirection);
    float h = dir.y;

    // Two-stop vertical gradient meeting at the horizon, soft knee
    // rather than a hard band.
    vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.62, h));
    c = mix(c, uBottom, smoothstep(0.0, -0.45, h));

    // A broad, very soft bloom standing in for daylight beyond the
    // glazing. Exponent kept low so it reads as diffuse sky, never sun.
    float bloom = pow(max(dot(dir, normalize(uGlowDir)), 0.0), 3.2);
    c += uGlow * bloom * 0.42;

    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeScratch() {
  return {
    ground: new Color(),
    wall: new Color(),
    ceiling: new Color(),
    window: new Color(),
    propDark: new Color(),
    propLight: new Color(),
    propOut: new Color(),
    propA: new Color(),
    propB: new Color(),
    fog: new Color(),
    a: new Color(),
    b: new Color(),
    dummy: new Object3D(),
  };
}

function lerpColor(out: Color, from: string, to: string, mix: number, a: Color, b: Color) {
  a.set(from);
  b.set(to);
  out.copy(a).lerp(b, mix);
}

const lerp = (from: number, to: number, mix: number) => from + (to - from) * mix;

/**
 * Parsed colours, keyed by hex string.
 *
 * Props are recoloured every frame and a room can carry thirty-six of
 * them, so parsing two hex strings per prop per frame is a few thousand
 * string parses a second for values that never change. They are all
 * literals in environments.ts, so one parse each is enough forever.
 */
const colorCache = new Map<string, Color>();
function parsed(hex: string): Color {
  let color = colorCache.get(hex);
  if (!color) {
    color = new Color(hex);
    colorCache.set(hex, color);
  }
  return color;
}

export function Backdrop() {
  const skyRef = useRef<Mesh>(null);
  const groundRef = useRef<Mesh>(null);
  const wallRef = useRef<Mesh>(null);
  const ceilingRef = useRef<Mesh>(null);
  const windowRef = useRef<Mesh>(null);
  const propsRef = useRef<InstancedMesh>(null);

  const scratch = useMemo(() => makeScratch(), []);

  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTop: { value: new Color(ENV_LIVING_ROOM.top) },
          uHorizon: { value: new Color(ENV_LIVING_ROOM.horizon) },
          uBottom: { value: new Color(ENV_LIVING_ROOM.bottom) },
          uGlow: { value: new Color(ENV_LIVING_ROOM.glow) },
          uGlowDir: { value: [...ENV_LIVING_ROOM.glowDirection] as [number, number, number] },
        },
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
        // The sky shell must never be dimmed by the scene fog that gives
        // the props their atmospheric falloff — it IS the distance, so
        // fogging it would flatten the whole depth cue.
        fog: false,
      }),
    []
  );

  const propGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const propMaterial = useMemo(
    () => new MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }),
    []
  );

  // three allocates the per-instance colour buffer lazily, on the first
  // setColorAt. Seeding it here means the frame loop can assume it
  // exists rather than branching on it every frame.
  useEffect(() => {
    const mesh = propsRef.current;
    if (!mesh) return;
    const white = new Color(1, 1, 1);
    for (let i = 0; i < MAX_PROPS; i++) mesh.setColorAt(i, white);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const progress = useScrollStory.getState().progress;
    const { from, to, mix } = sampleEnvironment(progress);

    /* ---- Sky ---- */
    const sky = skyRef.current;
    const uniforms = (sky?.material as ShaderMaterial | undefined)?.uniforms;
    if (uniforms) {
      lerpColor(uniforms.uTop.value, from.top, to.top, mix, scratch.a, scratch.b);
      lerpColor(uniforms.uHorizon.value, from.horizon, to.horizon, mix, scratch.a, scratch.b);
      lerpColor(uniforms.uBottom.value, from.bottom, to.bottom, mix, scratch.a, scratch.b);
      lerpColor(uniforms.uGlow.value, from.glow, to.glow, mix, scratch.a, scratch.b);
      for (let i = 0; i < 3; i++) {
        uniforms.uGlowDir.value[i] = lerp(from.glowDirection[i], to.glowDirection[i], mix);
      }
    }

    /* ---- Atmospheric perspective ----
       Fog is what keeps the background subordinate: the further a prop
       sits, the closer it drifts to the wall colour, so nothing at
       distance ever competes with the tower for contrast. */
    const fog = state.scene.fog as FogExp2 | null;
    if (fog) {
      lerpColor(scratch.fog, from.fogColor, to.fogColor, mix, scratch.a, scratch.b);
      fog.color.copy(scratch.fog);
      fog.density = lerp(from.fogDensity, to.fogDensity, mix);
    }

    /* ---- Presence: the whole built world fades for the cutaway act ---- */
    const presence = lerp(from.presence, to.presence, mix);
    const built = presence > 0.005;
    const wallDistance = lerp(from.wallDistance, to.wallDistance, mix);

    /* ---- Ground ---- */
    const ground = groundRef.current;
    if (ground) {
      lerpColor(scratch.ground, from.ground, to.ground, mix, scratch.a, scratch.b);
      (ground.material as MeshStandardMaterial).color.copy(scratch.ground);
    }

    /* ---- Back wall ---- */
    const wall = wallRef.current;
    if (wall) {
      lerpColor(scratch.wall, from.wallColor, to.wallColor, mix, scratch.a, scratch.b);
      const material = wall.material as MeshStandardMaterial;
      material.color.copy(scratch.wall);
      material.opacity = presence;
      wall.position.z = -wallDistance;
      wall.visible = built;
    }

    /* ---- Ceiling. Height 0 means open sky, so it lifts away rather
       than blinking out — a ceiling that vanishes on a frame boundary
       is the most obvious tell there is. ---- */
    const ceiling = ceilingRef.current;
    if (ceiling) {
      const height = lerp(from.ceilingHeight, to.ceilingHeight, mix);
      lerpColor(scratch.ceiling, from.ceilingColor, to.ceilingColor, mix, scratch.a, scratch.b);
      const material = ceiling.material as MeshBasicMaterial;
      material.color.copy(scratch.ceiling);
      material.opacity = presence;
      ceiling.position.set(0, height, -wallDistance * 0.45);
      ceiling.visible = built && height > 0.05;
    }

    /* ---- Window ---- */
    const windowMesh = windowRef.current;
    if (windowMesh) {
      lerpColor(scratch.window, from.windowColor, to.windowColor, mix, scratch.a, scratch.b);
      const material = windowMesh.material as MeshBasicMaterial;
      material.color.copy(scratch.window);
      material.opacity = presence;
      windowMesh.position.set(
        lerp(from.windowPosition[0], to.windowPosition[0], mix),
        lerp(from.windowPosition[1], to.windowPosition[1], mix),
        // Proud of the wall by a few centimetres so it never z-fights.
        -wallDistance + 0.05
      );
      windowMesh.scale.set(
        lerp(from.windowSize[0], to.windowSize[0], mix),
        lerp(from.windowSize[1], to.windowSize[1], mix),
        1
      );
      windowMesh.visible = built;
    }

    /* ---- Furniture ----
       Slot N in one room morphs into slot N in the next, which is why
       every environment is padded to the same length. A slot with no
       counterpart is padded to zero size below the floor, so it grows
       in place instead of popping. */
    const props = propsRef.current;
    if (props) {
      props.visible = built;

      lerpColor(scratch.propDark, from.propDark, to.propDark, mix, scratch.a, scratch.b);
      lerpColor(scratch.propLight, from.propLight, to.propLight, mix, scratch.a, scratch.b);

      const { dummy } = scratch;
      for (let i = 0; i < MAX_PROPS; i++) {
        const a = from.props[i];
        const b = to.props[i];
        if (!a || !b) continue;

        dummy.position.set(
          lerp(a.p[0], b.p[0], mix),
          lerp(a.p[1], b.p[1], mix),
          lerp(a.p[2], b.p[2], mix)
        );
        dummy.rotation.set(0, lerp(a.r ?? 0, b.r ?? 0, mix), 0);
        // Geometry is a unit cube, so scale IS the dimension in metres.
        // Presence multiplies in so the room shrinks away into the void
        // rather than disappearing on a frame boundary. A hard zero
        // scale produces a degenerate matrix, hence the floor.
        dummy.scale.set(
          Math.max(1e-4, lerp(a.s[0], b.s[0], mix) * presence),
          Math.max(1e-4, lerp(a.s[1], b.s[1], mix) * presence),
          Math.max(1e-4, lerp(a.s[2], b.s[2], mix) * presence)
        );
        dummy.updateMatrix();
        props.setMatrixAt(i, dummy.matrix);

        // A prop with its own colour uses it; one without takes a
        // position on the room's two-tone ramp. A slot can change which
        // it uses between rooms — a sage sofa becoming an untinted
        // counter — so both ends are resolved independently and then
        // blended, which keeps that transition continuous.
        if (a.c || b.c) {
          if (a.c) scratch.propA.copy(parsed(a.c));
          else scratch.propA.copy(scratch.propDark).lerp(scratch.propLight, a.t ?? 0.5);
          if (b.c) scratch.propB.copy(parsed(b.c));
          else scratch.propB.copy(scratch.propDark).lerp(scratch.propLight, b.t ?? 0.5);
          scratch.propOut.copy(scratch.propA).lerp(scratch.propB, mix);
        } else {
          scratch.propOut
            .copy(scratch.propDark)
            .lerp(scratch.propLight, lerp(a.t ?? 0.5, b.t ?? 0.5, mix));
        }
        props.setColorAt(i, scratch.propOut);
      }

      props.instanceMatrix.needsUpdate = true;
      if (props.instanceColor) props.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group name="Environment">
      <mesh ref={skyRef} name="Sky_Shell" material={skyMaterial} renderOrder={-1}>
        <sphereGeometry args={[42, 32, 16]} />
      </mesh>

      <mesh name="Ground" ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={ENV_LIVING_ROOM.ground} roughness={0.94} metalness={0} />
      </mesh>

      <mesh
        name="Back_Wall"
        ref={wallRef}
        position={[0, 3, -ENV_LIVING_ROOM.wallDistance]}
        receiveShadow
      >
        <planeGeometry args={[40, 14]} />
        <meshStandardMaterial
          color={ENV_LIVING_ROOM.wallColor}
          roughness={0.96}
          metalness={0}
          transparent
        />
      </mesh>

      {/* Unlit, like the window. A ceiling is lit from below by bounce
          off every surface in the room, which a single key light cannot
          simulate — shaded normally its underside goes to ambient only
          and reads as a heavy grey slab over a bright room. Painting it
          flat at the wall's value is both cheaper and truer. */}
      <mesh
        name="Ceiling"
        ref={ceilingRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, ENV_LIVING_ROOM.ceilingHeight, -3]}
      >
        <planeGeometry args={[30, 22]} />
        <meshBasicMaterial color={ENV_LIVING_ROOM.ceilingColor} transparent />
      </mesh>

      {/* Unlit on purpose: a window is a hole onto something brighter
          than the room, and shading it would make it read as a painted
          white rectangle instead of daylight. */}
      <mesh name="Window" ref={windowRef}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={ENV_LIVING_ROOM.windowColor}
          toneMapped={false}
          transparent
          fog={false}
        />
      </mesh>

      <instancedMesh
        name="Furniture"
        ref={propsRef}
        args={[propGeometry, propMaterial, MAX_PROPS]}
        castShadow
        receiveShadow
        // Instance transforms change every frame and span the whole room;
        // a bounding sphere computed once would cull furniture the moment
        // the camera pulls back into the glasshouse.
        frustumCulled={false}
      />
    </group>
  );
}
