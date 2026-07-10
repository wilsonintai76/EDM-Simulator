/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { PathPoint } from '../../types';
import * as THREE from 'three';
import { DischargeParticles } from './DischargeParticles';

interface WireProps {
  path: PathPoint[];
  progress: number;
  height?: number;
  kerf: number;
  active: boolean;
  speed: number;
}

export const Wire: React.FC<WireProps> = ({ path, progress, height = 40, kerf, active, speed }) => {
  const totalDistance = path.length > 0 ? path[path.length - 1].distance : 0;
  const currentDist = totalDistance * progress;

  // Interpolate position based on progress
  const position = useMemo(() => {
    if (path.length === 0) return { x: 0, y: 0, u: 0, v: 0 };
    
    // Find segments
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i+1];
      if (currentDist >= p1.distance && currentDist <= p2.distance) {
        const segDist = p2.distance - p1.distance;
        const alpha = segDist === 0 ? 0 : (currentDist - p1.distance) / segDist;
        
        return {
          x: p1.x + (p2.x - p1.x) * alpha,
          y: p1.y + (p2.y - p1.y) * alpha,
          u: p1.u + (p2.u - p1.u) * alpha,
          v: p1.v + (p2.v - p1.v) * alpha,
        };
      }
    }
    return path[path.length - 1];
  }, [path, currentDist]);

  const lowerPoint = new THREE.Vector3(position.x, position.y, -height / 2);
  const upperPoint = new THREE.Vector3(position.x + position.u, position.y + position.v, height / 2);
  
  const midPoint = new THREE.Vector3().addVectors(lowerPoint, upperPoint).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(upperPoint, lowerPoint);
  const length = direction.length();
  
  // To orient the cylinder between two points
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <group>
      {/* Wire itself (Electrode) */}
      <mesh position={midPoint} quaternion={quaternion}>
        <cylinderGeometry args={[0.1, 0.1, length, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Kerf / Spark Gap Visualization (The offset ring) */}
      <mesh position={[position.x, position.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.11, kerf, 32]} />
        <meshBasicMaterial color="#ff9f0a" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Tool Path Center Dot */}
      <mesh position={[position.x, position.y, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Animated Discharge Particles */}
      <DischargeParticles 
        position={position} 
        active={active && progress > 0 && progress < 1} 
        speed={speed} 
        height={height}
        kerf={kerf}
      />

      {/* Spark Effect (Simplified) */}
      {progress > 0 && progress < 1 && (
        <mesh position={[position.x, position.y, 0]}>
          <sphereGeometry args={[kerf * 0.8, 8, 8]} />
          <meshBasicMaterial color="#ff9f0a" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Upper/Lower Guides */}
      <mesh position={lowerPoint}>
        <cylinderGeometry args={[1, 1, 2, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={upperPoint}>
        <cylinderGeometry args={[1, 1, 2, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};
