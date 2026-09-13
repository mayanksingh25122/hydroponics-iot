import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
} from "three";
import type { WebGLProgramParametersWithUniforms } from "three";
import { POD_SOCKETS, podGrowth } from "./towerLayout";
import { useScrollStory } from "./useScrollStory";

/**
 * Instanced plant canopy with shader-driven growth.
 *
 * The architecture being proven here is the one the farm acts need: ALL
 * plants live in a single InstancedMesh (one draw call), their static
 * transforms are baked into instanceMatrix once at mount, and the only
 * per-frame work is writing one float per instance into a growth
 * attribute and uploading it. Growth — length, width, droop and colour —
 * is then evaluated on the GPU.
 *
 * The alternative (rebuilding instance matrices on the CPU every frame)
 * looks identical at 168 instances and falls over at the thousands the
 * greenhouse act needs. Proving the scalable path now is the point.
 */

/** Attribute name shared by the shader injection and the frame loop. */
const GROWTH_ATTRIBUTE = "aGrowth";

const LEAVES_PER_POD = 7;
const INSTANCE_COUNT = POD_SOCKETS.length * LEAVES_PER_POD;

/** Blade dimensions in metres — a mature leaf is ~11cm long. */
const LEAF_LENGTH = 0.11;
const LEAF_WIDTH = 0.042;
const LEAF_CURVE = 0.022;
const LEAF_SEGMENTS = 4;

/** Young growth is paler and yellower; mature leaves deepen and cool. */
const YOUNG_COLOR = new Color("#9fc98a");
const MATURE_COLOR = new Color("#3f7d4f");

/**
 * A single leaf blade pointing along +Y, width in X, arcing in +Z.
 * Eight triangles. Built once and shared by every instance.
 */
function createLeafGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= LEAF_SEGMENTS; i++) {
    const t = i / LEAF_SEGMENTS;
    const y = t * LEAF_LENGTH;
    // Widest at ~40% of the blade, tapering to a point at the tip.
    const halfWidth = (LEAF_WIDTH * Math.sin(Math.PI * Math.pow(t, 0.7))) / 2;
    const z = LEAF_CURVE * t * t;

    positions.push(-halfWidth, y, z, halfWidth, y, z);
    normals.push(0, 0, 1, 0, 0, 1);
    uvs.push(0, t, 1, t);

    if (i < LEAF_SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic hash in [0,1) — no Math.random, so every load is identical. */
function hash(n: number): number {
  return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
}

export function PlantSystem() {
  const meshRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => createLeafGeometry(), []);


  /** Which pod each leaf belongs to — lets one pod's leaves grow together. */
  const podOfInstance = useMemo(() => {
    const map = new Uint16Array(INSTANCE_COUNT);
    for (let i = 0; i < INSTANCE_COUNT; i++) map[i] = Math.floor(i / LEAVES_PER_POD);
    return map;
  }, []);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      side: DoubleSide,
      roughness: 0.72,
      metalness: 0,
    });

    mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute float aGrowth;
           varying float vGrowth;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vGrowth = aGrowth;
           float g = clamp(aGrowth, 0.0, 1.0);

           // Length runs ahead of width: a seedling is a thin spike
           // before it is a leaf, which is what makes early growth read
           // as emerging rather than as an object scaling up.
           transformed.y *= g;
           float widthFactor = 0.22 + 0.78 * g * g;
           transformed.x *= widthFactor;

           // Blades arc further from the stem as they lengthen, so the
           // canopy opens outward instead of inflating in place.
           float alongBlade = transformed.y / ${LEAF_LENGTH.toFixed(4)};
           transformed.z = transformed.z * widthFactor + alongBlade * alongBlade * ${LEAF_CURVE.toFixed(4)} * g;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying float vGrowth;`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           diffuseColor.rgb *= mix(
             vec3(${YOUNG_COLOR.r.toFixed(4)}, ${YOUNG_COLOR.g.toFixed(4)}, ${YOUNG_COLOR.b.toFixed(4)}),
             vec3(${MATURE_COLOR.r.toFixed(4)}, ${MATURE_COLOR.g.toFixed(4)}, ${MATURE_COLOR.b.toFixed(4)}),
             smoothstep(0.0, 0.85, vGrowth)
           );`
        );
    };

    return mat;
  }, []);

  // Static transforms: baked once. Nothing here runs per frame.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new Object3D();
    const socketQuat = new Quaternion();
    const spinQuat = new Quaternion();
    const pitchQuat = new Quaternion();
    const axisY = new Euler();

    for (let podIndex = 0; podIndex < POD_SOCKETS.length; podIndex++) {
      const socket = POD_SOCKETS[podIndex];
      socketQuat.setFromEuler(socket.rotation);

      for (let leaf = 0; leaf < LEAVES_PER_POD; leaf++) {
        const instance = podIndex * LEAVES_PER_POD + leaf;
        const jitter = hash(instance * 3.7);

        // Golden-angle phyllotaxis around the pod axis: the arrangement
        // real rosette plants use, and the reason the canopy never reads
        // as a repeating pattern even with one leaf mesh.
        const azimuth = leaf * 2.39996 + jitter * 0.35;
        // Outer leaves sit lower, inner leaves stand up.
        const pitch = 0.32 + (leaf / LEAVES_PER_POD) * 0.72 + jitter * 0.14;

        axisY.set(0, azimuth, 0);
        spinQuat.setFromEuler(axisY);
        pitchQuat.setFromEuler(new Euler(pitch, 0, 0));

        dummy.position.copy(socket.position);
        dummy.quaternion.copy(socketQuat).multiply(spinQuat).multiply(pitchQuat);
        const scale = 0.82 + jitter * 0.36;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;

    // The growth buffer is owned by the geometry, not by render scope.
    // useFrame reads it back off the mesh each frame, so no value
    // captured during render is ever mutated by the frame loop — which
    // is both what the hooks lint rule requires and the correct
    // lifetime: the buffer belongs to the GPU object, not the component.
    mesh.geometry.setAttribute(
      GROWTH_ATTRIBUTE,
      new InstancedBufferAttribute(new Float32Array(INSTANCE_COUNT), 1)
    );
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const growthAttribute = mesh.geometry.getAttribute(GROWTH_ATTRIBUTE) as
      | InstancedBufferAttribute
      | undefined;
    // The attribute is attached by the mount effect; a frame can fire
    // before that on the very first tick.
    if (!growthAttribute) return;

    const progress = useScrollStory.getState().progress;
    const growthArray = growthAttribute.array as Float32Array;

    // The only per-frame work: one float per leaf, then one upload.
    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const pod = podOfInstance[i];
      // Leaves within a pod lag each other slightly so a pod fills in
      // rather than appearing all at once.
      const leafOffset = (i % LEAVES_PER_POD) * 0.018;
      growthArray[i] = podGrowth(pod, Math.max(0, progress - leafOffset));
    }
    growthAttribute.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      name="Plant_Canopy"
      args={[geometry, material, INSTANCE_COUNT]}
      // Deliberately NOT castShadow. At 2048² over a 4.4m frustum the
      // shadow map resolves individual leaves, and 168 crisp leaf
      // silhouettes on the floor read as debris rather than as a plant.
      // The canopy is grounded by the tower's own shadow instead.
      // Instances are positioned by baked matrices that three cannot
      // cheaply bound; skipping the frustum test avoids the canopy
      // popping out of view when the tower rotates near a frame edge.
      frustumCulled={false}
    />
  );
}
