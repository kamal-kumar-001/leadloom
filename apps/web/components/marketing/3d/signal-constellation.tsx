'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

/**
 * Signal constellation (Approval Key direction, Kamal 2026-11-12): a slow field
 * of buying-signal points with hairline connections drifting behind the hero.
 * Amber (approval) and violet (brand) points on additive blending; the whole
 * field parallaxes gently toward the pointer. Motion is deliberately slow -
 * nothing floats without reason. Reduced motion / no WebGL: a static
 * gradient fallback, and the hero works without it.
 */

const AMBER = new THREE.Color('#F3E3A0');
const VIOLET = new THREE.Color('#8b7cf6');

function Constellation() {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  const { positions, colors, linePositions } = useMemo(() => {
    const count = 110;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      // Wide shallow band: denser toward the right (behind the slab).
      const x = (Math.random() - 0.35) * 16;
      const y = (Math.random() - 0.5) * 8;
      const z = (Math.random() - 0.5) * 4 - 1;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    pts.forEach((p, i) => {
      positions.set([p.x, p.y, p.z], i * 3);
      const c = Math.random() < 0.3 ? AMBER : VIOLET;
      colors.set([c.r, c.g, c.b], i * 3);
    });
    // Hairline arcs between near neighbours.
    const segs: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (pts[i].distanceTo(pts[j]) < 2.1) {
          segs.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
        }
      }
    }
    return { positions, colors, linePositions: new Float32Array(segs) };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // Slow drift plus eased pointer parallax (Apple-like: barely there).
    g.rotation.y += delta * 0.018;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.current.y * 0.04, 1.4, delta);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, pointer.current.x * -0.03, 1.4, delta);
    g.position.x = THREE.MathUtils.damp(g.position.x, pointer.current.x * 0.35, 1.4, delta);
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.055}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#6d64c8"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function ConstellationFallback() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(900px 480px at 78% 30%, rgba(139,124,246,0.14), transparent 70%), radial-gradient(560px 320px at 62% 62%, rgba(243,227,160,0.07), transparent 70%)',
      }}
    />
  );
}

export function SignalConstellation() {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!mounted || reduced) return <ConstellationFallback />;

  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Suspense fallback={<ConstellationFallback />}>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 42 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        >
          <Constellation />
        </Canvas>
      </Suspense>
    </div>
  );
}
