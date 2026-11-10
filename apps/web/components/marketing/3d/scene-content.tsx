'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  loomCoreVertexShader,
  loomCoreFragmentShader,
  generateLoomFibers,
} from '@leadloom/webgl-scenes';

export interface SceneContentProps {
  lightingState?: 'indigo' | 'matrix';
}

export function SceneContent({ lightingState = 'indigo' }: SceneContentProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { mouse } = useThree();

  const fibers = useMemo(() => generateLoomFibers(36, 3.2), []);

  const fiberLines = useMemo(() => fibers.map(fiber => {
    const geometry = new THREE.BufferGeometry().setFromPoints(fiber.curve.getPoints(40));
    const material = new THREE.LineBasicMaterial({ color: lightingState === 'matrix' ? '#10B981' : fiber.color, transparent: true, opacity: 0.5 });
    return new THREE.Line(geometry, material);
  }), [fibers, lightingState]);
  useEffect(() => () => { for (const line of fiberLines) { line.geometry.dispose(); line.material.dispose(); } }, [fiberLines]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#6366F1') },
      uColorB: { value: new THREE.Color('#A855F7') },
      uFresnelPower: { value: 2.2 },
      uPulseSpeed: { value: 2.5 },
    }),
    []
  );

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;

    // Smooth spherical lerp tracking mouse pointer
    if (meshRef.current) {
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        mouse.x * 0.6 + uniforms.uTime.value * 0.2,
        0.05
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        -mouse.y * 0.4,
        0.05
      );
    }

    // Dynamic lighting state morph
    const targetColorB =
      lightingState === 'matrix'
        ? new THREE.Color('#10B981') // Emerald Matrix
        : new THREE.Color('#A855F7'); // Electric Weave

    uniforms.uColorB.value.lerp(targetColorB, 0.08);
  });

  return (
    <group>
      {/* Ambient and point lights */}
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color={lightingState === 'matrix' ? '#10B981' : '#6366F1'} />

      {/* Central Geometric Loom Core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.2, 2]} />
        <shaderMaterial
          vertexShader={loomCoreVertexShader}
          fragmentShader={loomCoreFragmentShader}
          uniforms={uniforms}
          transparent
          wireframe={lightingState === 'matrix'}
        />
      </mesh>

      {/* Fiber-Optic Splines converging into the Core */}
      {fiberLines.map((line, index) => <primitive key={index} object={line} />)}
    </group>
  );
}
