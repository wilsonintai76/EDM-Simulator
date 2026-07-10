/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search } from 'lucide-react';

interface MicroscopeViewProps {
  isOpen: boolean;
  onClose: () => void;
  speed: number;
  active: boolean;
  kerf: number;
  material: string;
}

const SparkGapEffect: React.FC<{ active: boolean; speed: number; kerf: number }> = ({ active, speed, kerf }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uActive.value = active ? 1.0 : 0.0;
    material.uniforms.uIntensity.value = 0.5 + speed;
  });

  const shaderArgs = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
      uIntensity: { value: 0 },
      uKerf: { value: kerf }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uActive;
      uniform float uIntensity;
      uniform float uKerf;
      varying vec2 vUv;

      void main() {
        if (uActive < 0.5) discard;
        
        // Distance from center (where the wire is)
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center);
        
        // Wire is at center, radius ~0.2 in UV space for this visualization
        float wireRadius = 0.15;
        float gapRadius = 0.25;
        
        // Highlight the gap area
        if (dist > wireRadius && dist < gapRadius) {
          float spark = step(0.95, sin(dist * 100.0 - uTime * 20.0));
          float glow = (1.0 - smoothstep(wireRadius, gapRadius, dist)) * uIntensity;
          
          vec3 color = vec3(0.0, 0.8, 1.0) * glow; // Electric blue
          color += vec3(1.0, 0.9, 0.5) * spark * uIntensity; // Yellow sparks
          
          gl_FragColor = vec4(color, glow * 0.8);
        } else {
          discard;
        }
      }
    `
  }), [kerf]);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial 
        args={[shaderArgs]} 
        transparent 
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

export const MicroscopeView: React.FC<MicroscopeViewProps> = ({ 
  isOpen, 
  onClose, 
  speed, 
  active,
  kerf,
  material
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="absolute bottom-24 right-4 w-64 h-64 bg-black/90 border border-brand-border rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-brand-border bg-brand-surface/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Search size={12} className="text-brand-accent" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Plasma Gap View</span>
            </div>
            <button onClick={onClose} className="text-brand-text-dim hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Viewport */}
          <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]">
            <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
              <ambientLight intensity={0.5} />
              
              {/* Material Cross-section (Left) */}
              <mesh position={[-2.2, 0, 0]}>
                <boxGeometry args={[3, 4, 0.1]} />
                <meshStandardMaterial color="#333" roughness={0.8} />
              </mesh>
              
              {/* Material Cross-section (Right) */}
              <mesh position={[2.2, 0, 0]}>
                <boxGeometry args={[3, 4, 0.1]} />
                <meshStandardMaterial color="#333" roughness={0.8} />
              </mesh>

              {/* The Wire (Cross-section Circle) */}
              <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.6, 0.6, 0.1, 32]} />
                <meshStandardMaterial color="#ffcc33" metalness={1} roughness={0.2} />
              </mesh>

              {/* Spark Gap Shader */}
              <SparkGapEffect active={active} speed={speed} kerf={kerf} />

              {/* Grid for scale reference */}
              <gridHelper args={[10, 10, "#222", "#111"]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} />
            </Canvas>

            {/* Labels Overlay */}
            <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-[8px] text-brand-text-dim uppercase">Magnification</span>
                  <span className="text-[10px] font-mono text-brand-accent font-bold">500x</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-brand-text-dim uppercase">Erosion Zone</span>
                  <div className="w-12 h-0.5 bg-brand-accent/50 mt-1" />
                </div>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[8px] text-brand-text-dim uppercase">State</span>
                  <span className={`text-[10px] font-mono font-bold ${active ? 'text-brand-accent' : 'text-brand-text-dim'}`}>
                    {active ? 'STABLE DISCHARGE' : 'IDLE'}
                  </span>
                </div>
                <div className="bg-black/60 px-1.5 py-0.5 rounded border border-brand-border/30">
                  <span className="text-[8px] text-brand-text-dim uppercase mr-1">GAP:</span>
                  <span className="text-[9px] font-mono text-white">0.025mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="px-3 py-2 bg-brand-surface/30 flex items-center justify-between">
            <span className="text-[8px] text-brand-text-dim uppercase">Spark Interval</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i} 
                  className={`w-3 h-1 rounded-full ${active && (Math.random() > 0.3) ? 'bg-brand-accent shadow-[0_0_5px_rgba(255,204,51,0.5)]' : 'bg-white/10'}`} 
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
