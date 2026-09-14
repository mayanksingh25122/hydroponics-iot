import { useMemo } from "react";
import { Instance, Instances } from "@react-three/drei";
import {
  BASE_HEIGHT,
  BASE_RADIUS_BOTTOM,
  BASE_RADIUS_TOP,
  CAP_HEIGHT,
  CAP_RADIUS,
  COLUMN_BOTTOM,
  COLUMN_HEIGHT,
  COLUMN_RADIUS,
  COLUMN_TOP,
  POD_LENGTH,
  POD_RADIUS_INNER,
  POD_RADIUS_OUTER,
  POD_SOCKETS,
  SEGMENT_COUNT,
  SEGMENT_HEIGHT,
} from "./towerLayout";

/**
 * Procedural VERDA tower — the PROTOTYPE stand-in for the authored GLB.
 *
 * This exists to answer one question ahead of any asset commission: does
 * scroll-driven rotation of a tower-shaped object at this scale actually
 * feel good? Every dimension comes from towerLayout.ts, which is also the
 * spec the Blender asset is modelled to, so replacing this component with
 * a <primitive object={gltf.scene} /> is a swap, not a rewrite.
 *
 * Materials below are the target material definitions for the authored
 * asset too — matte architectural shell, anodised seam hardware, dark
 * technical base. Deliberately no glass, no neon, no emissive wash.
 */

/** Shell white. Warm enough not to read as clinical, desaturated enough to stay architectural. */
const SHELL_COLOR = "#f1f4f0";
/** Anodised hardware — seam rings, fasteners. */
const HARDWARE_COLOR = "#aab6ac";
/** Technical base housing: reservoir, pumps, controller. */
const BASE_COLOR = "#182a21";
/**
 * Pod interiors. Dark enough to read as depth, light enough NOT to read
 * as a pupil — near-black here turned every pod into an eye.
 */
const SOCKET_COLOR = "#4a5a50";
/** VERDA trace green (tokens.css --color-verda-trace-600), used once, as a hairline. */
const TRACE_COLOR = "#237a52";

export interface TowerProps {
  /** Vertical offset applied to the whole assembly. */
  y?: number;
}

export function Tower({ y = 0 }: TowerProps) {
  // Seam rings sit at every segment boundary, plus one at the column
  // head. Computed rather than hand-listed so changing SEGMENT_COUNT in
  // the layout module cannot desynchronise the visible hardware from the
  // pod rows it is supposed to divide.
  const seamHeights = useMemo(() => {
    const heights: number[] = [];
    for (let i = 0; i <= SEGMENT_COUNT; i++) {
      heights.push(COLUMN_BOTTOM + i * SEGMENT_HEIGHT);
    }
    return heights;
  }, []);

  return (
    <group position={[0, y, 0]} name="VerdaTower">
      {/* ---- Base housing: reservoir, circulation pump, dosing, controller ---- */}
      <mesh name="Base_Housing" position={[0, BASE_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_RADIUS_TOP, BASE_RADIUS_BOTTOM, BASE_HEIGHT, 48, 1]} />
        <meshStandardMaterial color={BASE_COLOR} roughness={0.52} metalness={0.18} />
      </mesh>

      {/* Hairline trace at the base parting line — the one accent on the object. */}
      <mesh name="Base_Trace" position={[0, BASE_HEIGHT * 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BASE_RADIUS_TOP * 0.995, 0.0016, 8, 96]} />
        <meshStandardMaterial
          color={TRACE_COLOR}
          emissive={TRACE_COLOR}
          emissiveIntensity={0.55}
          roughness={0.4}
        />
      </mesh>

      {/* Plinth: the shoulder the growing column seats into. */}
      <mesh name="Base_Plinth" position={[0, BASE_HEIGHT + 0.012, 0]} castShadow>
        <cylinderGeometry args={[COLUMN_RADIUS * 1.14, BASE_RADIUS_TOP, 0.026, 48, 1]} />
        <meshStandardMaterial color={HARDWARE_COLOR} roughness={0.3} metalness={0.72} />
      </mesh>

      {/* ---- Growing column ---- */}
      <mesh
        name="Shell_Outer"
        position={[0, COLUMN_BOTTOM + COLUMN_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS, COLUMN_HEIGHT, 48, 1]} />
        <meshPhysicalMaterial
          color={SHELL_COLOR}
          roughness={0.42}
          metalness={0}
          clearcoat={0.28}
          clearcoatRoughness={0.45}
        />
      </mesh>

      {/* ---- Segment seam rings (instanced: one draw call for all seven) ---- */}
      <Instances name="Shell_Seams" limit={seamHeights.length} range={seamHeights.length} castShadow>
        <torusGeometry args={[COLUMN_RADIUS * 1.012, 0.0042, 8, 64]} />
        <meshStandardMaterial color={HARDWARE_COLOR} roughness={0.26} metalness={0.78} />
        {seamHeights.map((height, i) => (
          <Instance key={`seam-${i}`} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} />
        ))}
      </Instances>

      {/* ---- Pod collars (instanced: 24 pods, one draw call) ---- */}
      <Instances name="Pod_Collars" limit={POD_SOCKETS.length} range={POD_SOCKETS.length} castShadow receiveShadow>
        <cylinderGeometry
          args={[POD_RADIUS_OUTER, POD_RADIUS_OUTER * 1.08, POD_LENGTH, 24, 1, true]}
        />
        <meshPhysicalMaterial
          color={SHELL_COLOR}
          roughness={0.44}
          metalness={0}
          clearcoat={0.22}
          clearcoatRoughness={0.5}
          side={2 /* DoubleSide — the collar is open tube geometry */}
        />
        {POD_SOCKETS.map((socket) => (
          <Instance
            key={socket.name}
            position={socket.collarPosition.toArray()}
            rotation={socket.rotation.toArray() as [number, number, number]}
          />
        ))}
      </Instances>

      {/* ---- Pod interiors: a dark disc set just inside each mouth ---- */}
      <Instances name="Pod_Sockets" limit={POD_SOCKETS.length} range={POD_SOCKETS.length}>
        <circleGeometry args={[POD_RADIUS_INNER, 24]} />
        <meshStandardMaterial color={SOCKET_COLOR} roughness={0.85} metalness={0} side={2} />
        {POD_SOCKETS.map((socket) => (
          <Instance
            key={`${socket.name}-socket`}
            // Sunk 8mm below the mouth so the aperture reads as a cavity.
            position={socket.position.clone().addScaledVector(socket.axis, -0.016).toArray()}
            // circleGeometry faces +Z; the socket's rotation aligns +Y to
            // the pod axis, so pitch it a quarter turn to face outward.
            rotation={[
              socket.rotation.x + Math.PI / 2,
              socket.rotation.y,
              socket.rotation.z,
            ]}
          />
        ))}
      </Instances>

      {/* ---- Cap assembly ---- */}
      <mesh name="Cap" position={[0, COLUMN_TOP + CAP_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[CAP_RADIUS * 0.93, CAP_RADIUS, CAP_HEIGHT, 48, 1]} />
        <meshPhysicalMaterial
          color={SHELL_COLOR}
          roughness={0.38}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.4}
        />
      </mesh>
      <mesh name="Cap_Trace" position={[0, COLUMN_TOP + CAP_HEIGHT * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CAP_RADIUS * 0.96, 0.0016, 8, 96]} />
        <meshStandardMaterial
          color={TRACE_COLOR}
          emissive={TRACE_COLOR}
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}
