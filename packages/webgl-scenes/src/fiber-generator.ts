import * as THREE from 'three';

export interface FiberCurveData {
  curve: THREE.CatmullRomCurve3;
  color: THREE.Color;
  speed: number;
}

export function generateLoomFibers(count: number = 48, radius: number = 3.5): FiberCurveData[] {
  const fibers: FiberCurveData[] = [];
  const palette = [
    new THREE.Color('#6366F1'), // Loom Indigo
    new THREE.Color('#A855F7'), // Weave Violet
    new THREE.Color('#10B981'), // Verified Emerald
    new THREE.Color('#38BDF8'), // Sky Blue
  ];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * 3;
    
    // Outer chaotic signal position
    const startPoint = new THREE.Vector3(
      Math.cos(angle) * (radius + Math.random() * 2),
      elevation,
      Math.sin(angle) * (radius + Math.random() * 2)
    );

    // Mid waypoint arching toward Loom vortex
    const midPoint = new THREE.Vector3(
      Math.cos(angle + 0.5) * (radius * 0.5),
      elevation * 0.4 + (Math.random() - 0.5) * 0.5,
      Math.sin(angle + 0.5) * (radius * 0.5)
    );

    // Central Loom Core entry terminus
    const endPoint = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4
    );

    const curve = new THREE.CatmullRomCurve3([startPoint, midPoint, endPoint]);
    fibers.push({
      curve,
      color: palette[i % palette.length],
      speed: 0.2 + Math.random() * 0.5,
    });
  }

  return fibers;
}
