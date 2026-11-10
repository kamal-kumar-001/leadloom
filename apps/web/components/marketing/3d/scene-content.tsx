'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  loomCoreVertexShader,
  loomCoreFragmentShader,
} from '@leadloom/webgl-scenes';

export interface SceneContentProps {
  lightingState?: 'indigo' | 'matrix';
}

const GLOBE_RADIUS = 1.2;

/** Clean lat/long wireframe grid for the globe (meridians + parallels). */
function buildGlobeGrid(radius: number, meridians: number, parallels: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const SEGMENTS = 72;

  for (let m = 0; m < meridians; m++) {
    const phi = (m / meridians) * Math.PI * 2;
    let prev: THREE.Vector3 | null = null;
    for (let s = 0; s <= SEGMENTS; s++) {
      const theta = (s / SEGMENTS) * Math.PI * 2;
      const p = new THREE.Vector3(
        radius * Math.cos(theta) * Math.cos(phi),
        radius * Math.sin(theta),
        radius * Math.cos(theta) * Math.sin(phi),
      );
      if (prev) points.push(prev.clone(), p.clone());
      prev = p;
    }
  }

  for (let p = 1; p < parallels; p++) {
    const lat = (p / parallels) * Math.PI - Math.PI / 2;
    const r = radius * Math.cos(lat);
    const y = radius * Math.sin(lat);
    let prev: THREE.Vector3 | null = null;
    for (let s = 0; s <= SEGMENTS; s++) {
      const theta = (s / SEGMENTS) * Math.PI * 2;
      const point = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
      if (prev) points.push(prev.clone(), point.clone());
      prev = point;
    }
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}

/** Deterministic pseudo-random signal nodes on the sphere surface. */
function buildSignalNodes(radius: number, count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * r * Math.cos(theta);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * r * Math.sin(theta);
  }
  return positions;
}

/** One restrained orbital ring (a "thread" weaving around the loom). */
function buildOrbitRing(radius: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const SEGMENTS = 128;
  for (let s = 0; s <= SEGMENTS; s++) {
    const theta = (s / SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(radius * Math.cos(theta), 0, radius * Math.sin(theta)));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function SceneContent({ lightingState = 'indigo' }: SceneContentProps) {
  const globeRef = useRef<THREE.Group>(null);
  const orbitsRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  const isMatrix = lightingState === 'matrix';
  const gridColor = isMatrix ? '#10B981' : '#6366F1';
  const nodeColor = isMatrix ? '#34D399' : '#A855F7';
  const orbitColor = isMatrix ? '#10B981' : '#38BDF8';

  const gridGeometry = useMemo(() => buildGlobeGrid(GLOBE_RADIUS, 12, 8), []);
  const nodePositions = useMemo(() => buildSignalNodes(GLOBE_RADIUS * 1.002, 90), []);
  const orbitGeometries = useMemo(
    () => [buildOrbitRing(1.55), buildOrbitRing(1.75), buildOrbitRing(1.95)],
    [],
  );
  useEffect(
    () => () => {
      gridGeometry.dispose();
      for (const g of orbitGeometries) g.dispose();
    },
    [gridGeometry, orbitGeometries],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#6366F1') },
      uColorB: { value: new THREE.Color('#A855F7') },
      uFresnelPower: { value: 2.6 },
      uPulseSpeed: { value: 1.6 },
    }),
    [],
  );

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;

    // Restrained continuous rotation with subtle mouse parallax.
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.12;
      globeRef.current.rotation.x = THREE.MathUtils.lerp(
        globeRef.current.rotation.x,
        -mouse.y * 0.12,
        0.04,
      );
    }
    if (orbitsRef.current) {
      orbitsRef.current.rotation.y -= delta * 0.05;
    }

    const targetColorB = new THREE.Color(isMatrix ? '#10B981' : '#A855F7');
    uniforms.uColorB.value.lerp(targetColorB, 0.08);
  });

  return (
    <group>
      <ambientLight intensity={0.4} />

      {/* Rotating globe: smooth glow body + wireframe grid + signal nodes */}
      <group ref={globeRef} rotation={[0.35, 0, 0]}>
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 0.985, 64, 64]} />
          <shaderMaterial
            vertexShader={loomCoreVertexShader}
            fragmentShader={loomCoreFragmentShader}
            uniforms={uniforms}
            transparent
          />
        </mesh>

        <lineSegments geometry={gridGeometry}>
          <lineBasicMaterial color={gridColor} transparent opacity={0.28} />
        </lineSegments>

        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[nodePositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color={nodeColor} size={0.035} transparent opacity={0.9} sizeAttenuation />
        </points>
      </group>

      {/* Restrained orbital threads */}
      <group ref={orbitsRef} rotation={[0.35, 0, 0]}>
        {orbitGeometries.map((geometry, index) => (
          <lineLoop key={index} geometry={geometry} rotation={[index * 0.55 - 0.5, index * 0.8, 0]}>
            <lineBasicMaterial color={orbitColor} transparent opacity={0.22 - index * 0.04} />
          </lineLoop>
        ))}
      </group>
    </group>
  );
}
