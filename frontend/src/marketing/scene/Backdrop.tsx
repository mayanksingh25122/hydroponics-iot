import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial } from "three";
import type {
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { ENV_INTERIOR, sampleEnvironment } from "./environments";
import { useScrollStory } from "./useScrollStory";

/**
 * The world around the tower: sky shell, ground, back wall, window and
 * three massing blocks.
 *
 * NOTHING here is ever mounted or unmounted by an act change. The same
 * meshes exist for the whole story and are reshaped and recoloured as
 * scroll moves between environment keyframes — which is the mechanism
 * that lets a living room become a glasshouse without the tower
 * appearing to cut, flicker or shift.
 *
 * The three massing blocks are deliberately abstract. They read as
 * furniture, counters or channel runs depending on their proportions
 * and the light on them, and at the contrast this scene runs at, that
 * is enough to say "a room" without modelling one. It also means the
 * whole environment costs five draw calls.
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

/** Scratch colours, allocated once — never inside the frame loop. */
function makeScratch() {
  return {
    top: new Color(),
    horizon: new Color(),
    bottom: new Color(),
    glow: new Color(),
    ground: new Color(),
    wall: new Color(),
    window: new Color(),
    mass: new Color(),
    fog: new Color(),
    a: new Color(),
    b: new Color(),
  };
}

function lerpColor(
  out: Color,
  from: string,
  to: string,
  mix: number,
  a: Color,
  b: Color,
) {
  a.set(from);
  b.set(to);
  out.copy(a).lerp(b, mix);
}

const lerp = (from: number, to: number, mix: number) =>
  from + (to - from) * mix;

export function Backdrop() {
  const skyRef = useRef<Mesh>(null);
  const groundRef = useRef<Mesh>(null);
  const wallRef = useRef<Mesh>(null);
  const windowRef = useRef<Mesh>(null);
  const massGroupRef = useRef<Group>(null);

  const scratch = useMemo(() => makeScratch(), []);

  // The sky material owns its own uniforms, and the frame loop reads
  // them back off the mesh rather than closing over a value created
  // during render. Same reason as PlantSystem's growth buffer: the
  // uniforms belong to the GPU object, not to the component.
  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTop: { value: new Color(ENV_INTERIOR.top) },
          uHorizon: { value: new Color(ENV_INTERIOR.horizon) },
          uBottom: { value: new Color(ENV_INTERIOR.bottom) },
          uGlow: { value: new Color(ENV_INTERIOR.glow) },
          uGlowDir: {
            value: [...ENV_INTERIOR.glowDirection] as [number, number, number],
          },
        },
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
        // The sky shell must never be dimmed by the scene fog that
        // gives the masses their atmospheric falloff — it IS the
        // distance, so fogging it would flatten the whole depth cue.
        fog: false,
      }),
    [],
  );

  useFrame((state, delta) => {
    const progress = useScrollStory.getState().progress;
    const { from, to, mix } = sampleEnvironment(progress);

    /* ---- Sky ---- */
    const sky = skyRef.current;
    const uniforms = (sky?.material as ShaderMaterial | undefined)?.uniforms;
    if (uniforms) {
      lerpColor(
        uniforms.uTop.value,
        from.top,
        to.top,
        mix,
        scratch.a,
        scratch.b,
      );
      lerpColor(
        uniforms.uHorizon.value,
        from.horizon,
        to.horizon,
        mix,
        scratch.a,
        scratch.b,
      );
      lerpColor(
        uniforms.uBottom.value,
        from.bottom,
        to.bottom,
        mix,
        scratch.a,
        scratch.b,
      );
      lerpColor(
        uniforms.uGlow.value,
        from.glow,
        to.glow,
        mix,
        scratch.a,
        scratch.b,
      );
      for (let i = 0; i < 3; i++) {
        uniforms.uGlowDir.value[i] = lerp(
          from.glowDirection[i],
          to.glowDirection[i],
          mix,
        );
      }
    }

    /* ---- Atmospheric perspective ----
       Fog is what keeps the background subordinate: the further a mass
       sits, the closer it drifts to the wall colour, so nothing at
       distance ever competes with the tower for contrast. */
    const fog = state.scene.fog as FogExp2 | null;
    if (fog) {
      lerpColor(
        scratch.fog,
        from.fogColor,
        to.fogColor,
        mix,
        scratch.a,
        scratch.b,
      );
      fog.color.copy(scratch.fog);
      fog.density = lerp(from.fogDensity, to.fogDensity, mix);
    }

    /* ---- Ground ---- */
    const ground = groundRef.current;
    if (ground) {
      lerpColor(
        scratch.ground,
        from.ground,
        to.ground,
        mix,
        scratch.a,
        scratch.b,
      );
      (ground.material as MeshStandardMaterial).color.copy(scratch.ground);
    }

    /* ---- Room presence ----
       At 0 the built environment is gone and the tower stands in a
       graded void. Scaling to zero rather than toggling visibility
       keeps the transition continuous; there is no frame where a wall
       simply stops existing. */
    const presence = lerp(from.presence, to.presence, mix);

    /* ---- Back wall ---- */
    const wall = wallRef.current;
    if (wall) {
      lerpColor(
        scratch.wall,
        from.wallColor,
        to.wallColor,
        mix,
        scratch.a,
        scratch.b,
      );
      const material = wall.material as MeshStandardMaterial;
      material.color.copy(scratch.wall);
      material.opacity = presence;
      wall.position.z = -lerp(from.wallDistance, to.wallDistance, mix);
      wall.visible = presence > 0.01;
    }

    /* ---- Window ---- */
    const windowMesh = windowRef.current;
    if (windowMesh) {
      lerpColor(
        scratch.window,
        from.windowColor,
        to.windowColor,
        mix,
        scratch.a,
        scratch.b,
      );
      const material = windowMesh.material as MeshBasicMaterial;
      material.color.copy(scratch.window);
      material.opacity = presence;
      windowMesh.position.set(
        lerp(from.windowPosition[0], to.windowPosition[0], mix),
        lerp(from.windowPosition[1], to.windowPosition[1], mix),
        // Sits a few centimetres proud of the wall so it never z-fights.
        -lerp(from.wallDistance, to.wallDistance, mix) + 0.04,
      );
      windowMesh.scale.set(
        lerp(from.windowSize[0], to.windowSize[0], mix),
        lerp(from.windowSize[1], to.windowSize[1], mix),
        1,
      );
      windowMesh.visible = presence > 0.01;
    }

    /* ---- Massing blocks ---- */
    const masses = massGroupRef.current;
    if (masses) {
      lerpColor(
        scratch.mass,
        from.massColor,
        to.massColor,
        mix,
        scratch.a,
        scratch.b,
      );
      masses.visible = presence > 0.01;

      for (let i = 0; i < masses.children.length; i++) {
        const mass = masses.children[i] as Mesh;
        const a = from.masses[i];
        const b = to.masses[i];
        if (!a || !b) continue;

        mass.position.set(
          lerp(a[0], b[0], mix),
          lerp(a[1], b[1], mix),
          lerp(a[2], b[2], mix),
        );
        // Geometry is a unit cube, so scale IS the dimension in metres.
        // Presence multiplies in, so masses shrink away into the void
        // rather than vanishing on a frame boundary.
        mass.scale.set(
          lerp(a[3], b[3], mix) * presence,
          lerp(a[4], b[4], mix) * presence,
          lerp(a[5], b[5], mix) * presence,
        );
        (mass.material as MeshStandardMaterial).color.copy(scratch.mass);
      }
    }

    void delta;
  });

  return (
    <group name="Environment">
      <mesh
        ref={skyRef}
        name="Sky_Shell"
        material={skyMaterial}
        renderOrder={-1}
      >
        <sphereGeometry args={[42, 32, 16]} />
      </mesh>

      <mesh
        name="Ground"
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[26, 64]} />
        <meshStandardMaterial
          color={ENV_INTERIOR.ground}
          roughness={0.92}
          metalness={0}
        />
      </mesh>

      <mesh
        name="Back_Wall"
        ref={wallRef}
        position={[0, 3, -ENV_INTERIOR.wallDistance]}
        receiveShadow
      >
        <planeGeometry args={[34, 12]} />
        <meshStandardMaterial
          color={ENV_INTERIOR.wallColor}
          roughness={0.95}
          metalness={0}
          transparent
        />
      </mesh>

      {/* Unlit on purpose: a window is a hole onto something brighter
          than the room, and shading it would make it read as a painted
          white rectangle instead of daylight. */}
      <mesh name="Window" ref={windowRef}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={ENV_INTERIOR.windowColor}
          toneMapped={false}
          transparent
          fog={false}
        />
      </mesh>

      <group name="Masses" ref={massGroupRef}>
        {ENV_INTERIOR.masses.map((mass, i) => (
          <mesh
            key={i}
            position={[mass[0], mass[1], mass[2]]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={ENV_INTERIOR.massColor}
              roughness={0.88}
              metalness={0}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
