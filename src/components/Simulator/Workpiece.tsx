/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PathPoint } from '../../types';

interface WorkpieceProps {
  path: PathPoint[];
  progress: number;
  thickness?: number;
  width?: number;
  height?: number;
  currentPass: 'rough' | 'skim';
  kerf: number;
  predrillPos: { x: number; y: number };
  material: 'tool_steel' | 'aluminum' | 'graphite' | 'brass';
  isInternalView: boolean;
}

const MATERIAL_COLORS = {
  tool_steel: "#4b5563",
  aluminum: "#94a3b8",
  graphite: "#1f2937",
  brass: "#d97706",
};

export const Workpiece: React.FC<WorkpieceProps> = ({
  path,
  progress,
  thickness = 40, // Increased default thickness for better taper visualization
  width = 60,
  height = 60,
  currentPass,
  kerf,
  predrillPos,
  material,
  isInternalView,
}) => {
  // Define a clipping plane for the internal view
  const clippingPlanes = useMemo(() => {
    if (!isInternalView) return [];
    // Cut along the Y axis to show the XZ plane internal (looking from front)
    // Or maybe dynamic? Let's fix it to Y=0 for now.
    return [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
  }, [isInternalView]);

  // Create the workpiece block
  const workpieceGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hh = height / 2;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.lineTo(-hw, -hh);

    // Create the hole (pre-drill) at user defined position
    const holePath = new THREE.Path();
    holePath.absarc(predrillPos.x, predrillPos.y, 2.5, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [width, height, thickness, predrillPos]);

  // Create the "cut" geometry by lofting between lower and upper path
  const cutGeom = useMemo(() => {
    if (path.length < 2) return null;

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    
    // We'll build a "ribbon" that represents the cut surfaces
    // In a real EDM sim, this would be a CSG operation, but here we visualize the "walls" of the cut
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];

      // Lower path (XY)
      const l1 = new THREE.Vector3(p1.x, p1.y, -thickness / 2);
      const l2 = new THREE.Vector3(p2.x, p2.y, -thickness / 2);

      // Upper path (XY + UV)
      const u1 = new THREE.Vector3(p1.x + p1.u, p1.y + p1.v, thickness / 2);
      const u2 = new THREE.Vector3(p2.x + p2.u, p2.y + p2.v, thickness / 2);

      // Quad for the cut face
      // Triangle 1
      vertices.push(l1.x, l1.y, l1.z);
      vertices.push(l2.x, l2.y, l2.z);
      vertices.push(u1.x, u1.y, u1.z);
      
      // Triangle 2
      vertices.push(l2.x, l2.y, l2.z);
      vertices.push(u2.x, u2.y, u2.z);
      vertices.push(u1.x, u1.y, u1.z);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [path, thickness]);

  return (
    <group>
      {/* Main Workpiece Block */}
      <mesh geometry={workpieceGeom} position={[0, 0, -thickness / 2]}>
        <meshStandardMaterial 
          color={MATERIAL_COLORS[material]} 
          metalness={material === 'graphite' ? 0.1 : 0.6} 
          roughness={material === 'graphite' ? 0.9 : 0.4} 
          transparent 
          opacity={isInternalView ? 0.8 : 0.4}
          clippingPlanes={clippingPlanes}
          clipShadows
        />
      </mesh>

      {/* The cut surfaces representing where the wire has been */}
      {cutGeom && (
        <mesh geometry={cutGeom}>
          <meshPhongMaterial 
            color={currentPass === 'rough' ? "#f43f5e" : "#fb923c"} 
            side={THREE.DoubleSide}
            transparent
            opacity={0.6}
            shininess={100}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      )}
    </group>
  );
};
