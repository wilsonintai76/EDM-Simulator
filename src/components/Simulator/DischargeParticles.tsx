/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DischargeParticlesProps {
  position: { x: number; y: number; u: number; v: number };
  active: boolean;
  speed: number;
  height?: number;
  kerf: number;
}

export const DischargeParticles: React.FC<DischargeParticlesProps> = ({ 
  position, 
  active, 
  speed, 
  height = 40,
  kerf
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Create a pool of particles
  const particleCount = 200;
  const [positions, initialVelocities] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    // Initialize off-screen
    for (let i = 0; i < particleCount * 3; i++) pos[i] = -1000;
    return [pos, vel];
  }, [particleCount]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const geom = pointsRef.current.geometry;
    const posAttr = geom.getAttribute('position');
    const currentPositions = posAttr.array as Float32Array;

    // Density scales with speed (feed rate)
    // When speed is 0, we still want some idle sparks if active
    const visibleCount = active ? Math.floor(particleCount * (0.2 + speed * 0.8)) : 0;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      if (i >= visibleCount) {
        currentPositions[i3 + 1] = -1000; // Hide
        continue;
      }

      // Simple lifecycle: if particle is too far or just random reset
      const distFromWire = Math.sqrt(
        Math.pow(currentPositions[i3] - position.x, 2) + 
        Math.pow(currentPositions[i3 + 1] - position.y, 2)
      );

      if (distFromWire > kerf * 2 || Math.random() < 0.1) {
        // Reset to a random point along the wire length
        const hAlpha = Math.random();
        const px = position.x + position.u * hAlpha;
        const py = position.y + position.v * hAlpha;
        const pz = -height / 2 + height * hAlpha;
        
        // Offset by kerf in a random direction
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * kerf;
        
        currentPositions[i3] = px + Math.cos(angle) * radius;
        currentPositions[i3 + 1] = py + Math.sin(angle) * radius;
        currentPositions[i3 + 2] = pz;
        
        // Explosion velocity
        const vMag = 0.5 + Math.random() * 2;
        initialVelocities[i3] = Math.cos(angle) * vMag;
        initialVelocities[i3 + 1] = Math.sin(angle) * vMag;
        initialVelocities[i3 + 2] = (Math.random() - 0.5) * 1;
      } else {
        // Update position
        currentPositions[i3] += initialVelocities[i3] * 0.05;
        currentPositions[i3 + 1] += initialVelocities[i3 + 1] * 0.05;
        currentPositions[i3 + 2] += initialVelocities[i3 + 2] * 0.05;
        
        // Gravity or pull back? EDM particles usually explode outwards
        initialVelocities[i3] *= 0.95;
        initialVelocities[i3 + 1] *= 0.95;
        initialVelocities[i3 + 2] *= 0.95;
      }
    }
    
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3}
        color="#ffcc00"
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};
