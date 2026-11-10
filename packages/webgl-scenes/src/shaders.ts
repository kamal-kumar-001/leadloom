export const loomCoreVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const loomCoreFragmentShader = `
  uniform float uTime;
  uniform vec3 uColorA; // Electric Indigo: #6366F1
  uniform vec3 uColorB; // Weave Purple / Matrix Emerald
  uniform float uFresnelPower;
  uniform float uPulseSpeed;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormal)), uFresnelPower);
    
    // Subtle rhythmic pulse simulating queue heartbeat
    float pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);
    
    vec3 color = mix(uColorA, uColorB, fresnel * 0.85 + pulse * 0.15);
    float alpha = clamp(fresnel + 0.25, 0.0, 0.95);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const fiberSplineVertexShader = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fiberSplineFragmentShader = `
  uniform vec3 uColor;
  uniform float uProgress;
  varying vec2 vUv;

  void main() {
    // Light pulse traveling down the spline fiber
    float spark = smoothstep(uProgress - 0.15, uProgress, vUv.x) * smoothstep(uProgress + 0.15, uProgress, vUv.x);
    vec3 sparkColor = mix(uColor, vec3(1.0, 1.0, 1.0), spark * 0.8);
    gl_FragColor = vec4(sparkColor, 0.6 + spark * 0.4);
  }
`;
