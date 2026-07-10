/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Grid, Center, Environment, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause, RotateCcw, Box, Eye, Layout, Settings2, Code, ChevronRight, Sliders, Activity, Zap, Droplets, AlertTriangle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { parseGCode, DEFAULT_GCODE } from '../../utils/gcodeParser';
import { validateGCode, DiagnosticIssue } from '../../utils/gcodeValidator';
import { SimulatorState, PathPoint } from '../../types';
import { Workpiece } from './Workpiece';
import { Wire } from './Wire';
import { FileUploader } from './FileUploader';
import { GCodeEditor } from './GCodeEditor';
import { GCodeDiagnostics } from './GCodeDiagnostics';
import { MicroscopeView } from './MicroscopeView';

const MATERIALS = {
  tool_steel: { name: 'Tool Steel (P20)', speedMult: 1.0, riskMult: 1.0 },
  aluminum: { name: 'Aluminum (6061)', speedMult: 1.5, riskMult: 1.3 },
  graphite: { name: 'Graphite (EDM)', speedMult: 2.2, riskMult: 0.6 },
  brass: { name: 'Brass (Yellow)', speedMult: 1.1, riskMult: 1.4 },
};

export const Simulator: React.FC = () => {
  const [gcode, setGcode] = useState(DEFAULT_GCODE);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [state, setState] = useState<SimulatorState>({
    isPlaying: false,
    progress: 0,
    speed: 0.1,
    showPath: true,
    showWorkpiece: true,
    viewMode: '3D',
    currentPass: 'rough',
    kerf: 0.5,
    isWireBroken: false,
    breakReason: null,
    predrillPos: { x: 0, y: 0 },
    isThreading: false,
    tension: 0,
    material: 'tool_steel',
    isInternalView: false,
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticIssue[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<'editor' | 'diagnostics'>('editor');
  const [isMicroscopeOpen, setIsMicroscopeOpen] = useState(false);

  const orbitControlsRef = useRef<any>(null);

  const setCameraPreset = (type: 'top' | 'front' | 'iso' | 'side') => {
    if (!orbitControlsRef.current) return;
    
    const controls = orbitControlsRef.current;
    const camera = controls.object;

    switch (type) {
      case 'top':
        camera.position.set(0, 0, 100);
        controls.target.set(0, 0, 0);
        break;
      case 'front':
        camera.position.set(0, -100, 0);
        controls.target.set(0, 0, 0);
        break;
      case 'iso':
        camera.position.set(60, -60, 60);
        controls.target.set(0, 0, 0);
        break;
      case 'side':
        camera.position.set(100, 0, 0);
        controls.target.set(0, 0, 0);
        break;
    }
    controls.update();
  };

  useEffect(() => {
    // Adjust kerf based on pass type
    setState(prev => ({
      ...prev,
      kerf: prev.currentPass === 'rough' ? 0.5 : 0.2,
    }));
  }, [state.currentPass]);

  useEffect(() => {
    setPath(parseGCode(gcode));
    setDiagnostics(validateGCode(gcode));
  }, [gcode]);

  const fullPath = useMemo(() => {
    if (path.length === 0) return [];
    
    // Create the threading move from predrill to the first path point
    const firstPoint = path[0];
    const threadPoint: PathPoint = {
      ...firstPoint,
      x: state.predrillPos.x,
      y: state.predrillPos.y,
      u: 0,
      v: 0,
      lineIndex: -2, // Special index for threading
      distance: 0,
    };

    // If predrill is same as first point, no need to prepend
    if (threadPoint.x === firstPoint.x && threadPoint.y === firstPoint.y) return path;

    // Recalculate distances for the entire path starting from predrill
    let currentDist = 0;
    const newPath = [threadPoint, ...path].map((p, i, arr) => {
      if (i > 0) {
        const prev = arr[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        currentDist += Math.sqrt(dx * dx + dy * dy);
      }
      return { ...p, distance: currentDist };
    });

    return newPath;
  }, [path, state.predrillPos]);

  const pathPoints = useMemo(() => fullPath.map(p => new THREE.Vector3(p.x, p.y, 0)), [fullPath]);
  
  const cutPoints = useMemo(() => {
    if (fullPath.length === 0) return [];
    const totalDistance = fullPath[fullPath.length - 1].distance;
    const currentDist = totalDistance * state.progress;
    
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < fullPath.length - 1; i++) {
      const p1 = fullPath[i];
      const p2 = fullPath[i+1];
      pts.push(new THREE.Vector3(p1.x, p1.y, 0));
      
      if (currentDist >= p1.distance && currentDist <= p2.distance) {
        const segDist = p2.distance - p1.distance;
        const alpha = segDist === 0 ? 0 : (currentDist - p1.distance) / segDist;
        pts.push(new THREE.Vector3(
          p1.x + (p2.x - p1.x) * alpha,
          p1.y + (p2.y - p1.y) * alpha,
          0
        ));
        return pts;
      }
    }
    // If progress is 1, return all points
    if (state.progress >= 0.999) return fullPath.map(p => new THREE.Vector3(p.x, p.y, 0));
    return pts;
  }, [fullPath, state.progress]);

  const currentPoint = useMemo(() => {
    const defaultPoint = { x: 0, y: 0, u: 0, v: 0, lineIndex: -1 };
    if (!fullPath || fullPath.length === 0) return defaultPoint;
    
    const totalDistance = fullPath[fullPath.length - 1].distance;
    const currentDist = totalDistance * state.progress;

    for (let i = 0; i < fullPath.length - 1; i++) {
      const p1 = fullPath[i];
      const p2 = fullPath[i+1];
      if (currentDist >= p1.distance && currentDist <= p2.distance) {
        const segDist = p2.distance - p1.distance;
        const alpha = segDist === 0 ? 0 : (currentDist - p1.distance) / segDist;
        return {
          x: p1.x + (p2.x - p1.x) * alpha,
          y: p1.y + (p2.y - p1.y) * alpha,
          u: p1.u + (p2.u - p1.u) * alpha,
          v: p1.v + (p2.v - p1.v) * alpha,
          lineIndex: p1.lineIndex
        };
      }
    }
    return fullPath[fullPath.length - 1];
  }, [fullPath, state.progress]);

  // Animation Loop logic
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (state.isPlaying && !state.isWireBroken) {
        setState(prev => {
          const mat = MATERIALS[prev.material];
          const nextProgress = prev.progress + delta * prev.speed * mat.speedMult;
          let currentTension = prev.speed * 40 * mat.riskMult;
          
          // Check for wire break conditions
          if (fullPath.length > 2) {
            const totalDistance = fullPath[fullPath.length - 1].distance;
            const currentDist = totalDistance * nextProgress;
            
            // Find current segment in fullPath
            for (let i = 0; i < fullPath.length - 1; i++) {
              const p1 = fullPath[i];
              const p2 = fullPath[i+1];
              
              if (currentDist >= p1.distance && currentDist <= p2.distance) {
                // Check local geometry for tension
                if (i > 0 && i < fullPath.length - 1) {
                  const pPrev = fullPath[i-1];
                  const pCurr = fullPath[i];
                  const pNext = fullPath[i+1];

                  const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
                  const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

                  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

                  if (mag1 > 0.1 && mag2 > 0.1) {
                    const dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
                    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
                    currentTension += (angle / 90) * 40 * mat.riskMult;
                    currentTension += (Math.abs(pCurr.u) + Math.abs(pCurr.v)) * 2 * mat.riskMult;

                    const breakThreshold = 0.4 / mat.speedMult;
                    if (angle > 45 && prev.speed > breakThreshold && Math.random() < (0.05 * mat.riskMult)) {
                      return { 
                        ...prev, 
                        isPlaying: false, 
                        isWireBroken: true, 
                        tension: 100,
                        breakReason: `Wire breakage at segment ${i}. Cause: Excessive tension on ${mat.name} at sharp corner (${angle.toFixed(1)}°).`
                      };
                    }
                  }
                }
                break;
              }
            }
          }

          currentTension += (Math.random() - 0.5) * 5;
          currentTension = Math.max(0, Math.min(100, currentTension));

          if (nextProgress >= 1) {
            return { ...prev, progress: 1, isPlaying: false, tension: 0 };
          }
          return { ...prev, progress: nextProgress, tension: currentTension };
        });
      } else if (!state.isPlaying) {
        setState(prev => ({ ...prev, tension: 0 }));
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [state.isPlaying, state.speed, state.isWireBroken, fullPath]);


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-brand-bg select-none">
      {/* HEADER */}
      <header className="h-[50px] bg-brand-surface border-b border-brand-border flex items-center px-4 md:px-5 justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <span className="font-black tracking-tighter text-base md:text-lg">SPARK<span className="text-brand-accent">CAD</span></span>
          <div className="hidden sm:block bg-[#222] border border-brand-border px-2.5 py-1 rounded text-[10px] font-mono text-brand-accent">
            WIRE EDM SIMULATOR v4.0.2
          </div>
        </div>
        
        <div className="flex gap-4 md:gap-6 text-[10px] md:text-[11px] font-mono text-brand-text-dim">
          <div className="flex gap-1.5 md:gap-2 items-center">
            <Activity size={10} className="text-brand-accent" />
            <span className="hidden xs:inline">FEED:</span> <span className="text-white">2.4</span>
          </div>
          <div className="flex gap-1.5 md:gap-2 items-center">
            <Droplets size={10} className="text-emerald-500" />
            <span className="hidden xs:inline">FLUSH:</span> <span className="text-emerald-500 font-bold">ON</span>
          </div>
          <div className="flex gap-1.5 md:gap-2 items-center">
            <Zap size={10} className="text-brand-accent" />
            <span className="hidden xs:inline">VOLT:</span> <span className="text-white">84V</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex md:grid md:grid-cols-[220px_1fr_260px] lg:grid-cols-[240px_1fr_280px] gap-[1px] bg-brand-border overflow-hidden relative">
        
        <div className="absolute top-16 left-4 right-4 z-40 flex justify-between pointer-events-none md:hidden">
          <button 
            onClick={() => setIsEditorOpen(!isEditorOpen)}
            className="pointer-events-auto bg-brand-surface/90 backdrop-blur border border-brand-border p-2 rounded shadow-lg text-brand-accent"
          >
            <Code size={18} />
          </button>
          <button 
            onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
            className="pointer-events-auto bg-brand-surface/90 backdrop-blur border border-brand-border p-2 rounded shadow-lg text-brand-accent"
          >
            <Sliders size={18} />
          </button>
        </div>

        {/* LEFT PANEL: G-CODE EDITOR */}
        <section className={`
          ${isEditorOpen ? 'flex' : 'hidden'} 
          md:flex absolute md:relative inset-0 md:inset-auto z-40 md:z-auto
          bg-brand-bg flex-col overflow-hidden w-full md:w-auto
        `}>
          <div className="px-4 py-2.5 border-b border-brand-border flex justify-between items-center bg-brand-surface/30">
            <div className="flex flex-col">
              <div className="flex gap-4 mb-1">
                <button 
                  onClick={() => setLeftPanelTab('editor')}
                  className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${leftPanelTab === 'editor' ? 'text-brand-accent' : 'text-brand-text-dim hover:text-white'}`}
                >
                  Editor
                </button>
                <button 
                  onClick={() => setLeftPanelTab('diagnostics')}
                  className={`text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-1.5 ${leftPanelTab === 'diagnostics' ? 'text-brand-accent' : 'text-brand-text-dim hover:text-white'}`}
                >
                  Diagnostics
                  {diagnostics.length > 0 && (
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-black ${diagnostics.some(d => d.type === 'error') ? 'bg-red-500' : 'bg-amber-500'}`}>
                      {diagnostics.length}
                    </span>
                  )}
                </button>
              </div>
              <span className="text-[8px] text-brand-accent font-mono uppercase opacity-60">
                {leftPanelTab === 'diagnostics' ? 'System Analysis' : (isManualEditing ? 'Manual Editing Mode' : 'Live Visualization Mode')}
              </span>
            </div>
            <button onClick={() => setIsEditorOpen(false)} className="md:hidden text-brand-text-dim"><ChevronRight size={14} className="rotate-180" /></button>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            {leftPanelTab === 'diagnostics' ? (
              <GCodeDiagnostics 
                issues={diagnostics} 
                onSelectLine={(line) => {
                  setLeftPanelTab('editor');
                  // Since we don't have a direct line selection in the editor yet,
                  // we'll just switch back. The user can see the line numbers.
                }}
              />
            ) : isManualEditing ? (
              <GCodeEditor 
                value={gcode} 
                onChange={(val) => setGcode(val)}
                activeLine={currentPoint?.lineIndex}
                issues={diagnostics}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-0 font-mono text-xs custom-scrollbar bg-black/20">
                {gcode.split('\n').map((line, i) => {
                  const isActive = currentPoint?.lineIndex === i;
                  return (
                    <div 
                      key={i} 
                      className={`px-4 py-1.5 border-l-[3px] transition-colors ${isActive ? 'bg-[#1c1c1c] text-white border-brand-accent' : 'text-brand-text-dim border-transparent'}`}
                    >
                      <span className="opacity-30 mr-3 text-[9px]">{(i + 1).toString().padStart(3, '0')}</span>
                      <span className="break-all">{line}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-brand-border bg-brand-surface/20 space-y-4">
            <FileUploader onUpload={(content) => {
              setGcode(content);
              setState(p => ({ ...p, progress: 0, isPlaying: false }));
              setIsManualEditing(false);
            }} />
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setGcode(DEFAULT_GCODE);
                  setState(p => ({ ...p, progress: 0, isPlaying: false }));
                  setIsManualEditing(false);
                }}
                className="flex-1 py-2 bg-brand-border/40 hover:bg-brand-border/60 text-[10px] font-bold uppercase tracking-wider rounded transition-colors text-brand-text-dim flex items-center justify-center gap-2"
              >
                <RotateCcw size={12} />
                Reset
              </button>
              <button 
                onClick={() => setIsManualEditing(!isManualEditing)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 ${isManualEditing ? 'bg-brand-accent text-black shadow-[0_0_15px_rgba(255,159,10,0.3)]' : 'bg-brand-border/40 hover:bg-brand-border/60 text-brand-text-dim'}`}
              >
                <Settings2 size={12} />
                {isManualEditing ? 'Save Edit' : 'Edit'}
              </button>
            </div>
          </div>
        </section>

        {/* CENTER PANEL: VIEWPORT */}
        <section className="flex-1 relative bg-black group overflow-hidden">
          {/* Grid Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-20" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }} 
          />
          
          <div className="absolute top-0 left-0 right-0 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center z-10 bg-gradient-to-b from-black/80 to-transparent gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-bold text-brand-text-dim tracking-widest uppercase">3D Workspace View</span>
              <span className="text-[8px] md:text-[9px] text-brand-accent font-mono uppercase tracking-tighter">4-Axis Taper Simulation</span>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-brand-surface/80 border border-brand-border rounded overflow-hidden">
                <button 
                  onClick={() => setState(p => ({ ...p, currentPass: 'rough' }))}
                  className={`px-2.5 md:px-3 py-1 text-[8px] md:text-[9px] font-bold uppercase transition-colors ${state.currentPass === 'rough' ? 'bg-brand-accent text-black' : 'text-brand-text-dim hover:text-white'}`}
                >
                  Rough
                </button>
                <button 
                  onClick={() => setState(p => ({ ...p, currentPass: 'skim' }))}
                  className={`px-2.5 md:px-3 py-1 text-[8px] md:text-[9px] font-bold uppercase transition-colors ${state.currentPass === 'skim' ? 'bg-brand-accent text-black' : 'text-brand-text-dim hover:text-white'}`}
                >
                  Skim
                </button>
              </div>
              <button 
                onClick={() => setState(p => ({ ...p, viewMode: p.viewMode === '3D' ? '2D' : '3D' }))}
                className="bg-brand-surface/80 border border-brand-border px-2.5 md:px-3 py-1 rounded text-[8px] md:text-[10px] font-bold text-brand-text-dim hover:text-white transition-colors"
              >
                {state.viewMode}
              </button>
            </div>
          </div>

          {/* Floating Camera Presets */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
            <div className="bg-brand-surface/90 border border-brand-border rounded-lg shadow-xl overflow-hidden backdrop-blur-md flex flex-col">
              <button 
                onClick={() => setCameraPreset('top')}
                className="p-2.5 hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent transition-all flex items-center gap-2 group"
                title="Top View"
              >
                <Box size={16} />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden group-hover:block">Top</span>
              </button>
              <button 
                onClick={() => setCameraPreset('front')}
                className="p-2.5 hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent transition-all border-t border-brand-border flex items-center gap-2 group"
                title="Front View"
              >
                <Eye size={16} />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden group-hover:block">Front</span>
              </button>
              <button 
                onClick={() => setCameraPreset('iso')}
                className="p-2.5 hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent transition-all border-t border-brand-border flex items-center gap-2 group"
                title="Isometric View"
              >
                <Layout size={16} />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden group-hover:block">ISO</span>
              </button>
              <button 
                onClick={() => setCameraPreset('side')}
                className="p-2.5 hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent transition-all border-t border-brand-border flex items-center gap-2 group"
                title="Side View"
              >
                <Sliders size={16} className="rotate-90" />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden group-hover:block">Side</span>
              </button>
              <button 
                onClick={() => setState(p => ({ ...p, isInternalView: !p.isInternalView }))}
                className={`p-2.5 transition-all border-t border-brand-border flex items-center gap-2 group ${state.isInternalView ? 'bg-brand-accent/30 text-brand-accent' : 'hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent'}`}
                title="Toggle Internal X-Ray View"
              >
                <Zap size={16} className={state.isInternalView ? 'animate-pulse' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden group-hover:block">X-Ray</span>
              </button>
              <button 
                onClick={() => setIsMicroscopeOpen(!isMicroscopeOpen)}
                className={`p-2.5 transition-all border-t border-brand-border flex items-center gap-2 group ${isMicroscopeOpen ? 'bg-brand-accent/30 text-brand-accent' : 'hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent'}`}
                title="Toggle Microscope Plasma View"
              >
                <Search size={16} />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden group-hover:block">Gap</span>
              </button>
            </div>
          </div>

          <Canvas shadows gl={{ antialias: true, localClippingEnabled: true }}>
            <AnimatePresence mode="wait">
              {state.viewMode === '3D' ? (
                <PerspectiveCamera key="3d" makeDefault position={[60, 60, 60]} fov={45} />
              ) : (
                <OrthographicCamera key="2d" makeDefault position={[0, 0, 100]} zoom={10} />
              )}
            </AnimatePresence>
            
            <OrbitControls ref={orbitControlsRef} makeDefault enableDamping dampingFactor={0.05} />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <pointLight position={[100, 100, 100]} intensity={1} castShadow />

            <group rotation={[-Math.PI / 2, 0, 0]}>
              <Grid 
                infiniteGrid 
                fadeDistance={100} 
                cellColor="#222" 
                sectionColor="#333" 
                cellSize={5} 
                sectionSize={25}
                position={[0, -0.1, 0]}
              />
              
              <Center>
                <Workpiece 
                  path={fullPath} 
                  progress={state.progress} 
                  currentPass={state.currentPass} 
                  kerf={state.kerf} 
                  predrillPos={state.predrillPos}
                  material={state.material}
                  isInternalView={state.isInternalView}
                />
                <Wire 
                  path={fullPath} 
                  progress={state.progress} 
                  kerf={state.kerf} 
                  active={state.isPlaying && !state.isWireBroken && currentPoint?.lineIndex !== -2}
                  speed={state.speed}
                />
                
                {/* WCS Origin Marker / Predrill visualization */}
                <axesHelper args={[10]} />
                <mesh position={[state.predrillPos.x, state.predrillPos.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.8, 2.2, 32]} />
                  <meshBasicMaterial color="#ff9f0a" />
                </mesh>
                <mesh position={[state.predrillPos.x, state.predrillPos.y, 0]}>
                  <sphereGeometry args={[0.5, 16, 16]} />
                  <meshBasicMaterial color="#ff9f0a" transparent opacity={0.5} />
                </mesh>
                  <Line 
                    points={pathPoints} 
                    color="#6366f1" 
                    lineWidth={1} 
                    transparent 
                    opacity={0.3} 
                  />

                <Line 
                  points={cutPoints} 
                  color={state.viewMode === '2D' ? '#ff9f0a' : '#f43f5e'} 
                  lineWidth={2} 
                />
              </Center>
            </group>
          </Canvas>

          {/* Viewport Overlays - Repositioned for mobile */}
          <div className="absolute bottom-4 left-4 flex flex-col xs:flex-row gap-2 z-10">
            <div className="bg-black/80 border border-brand-border p-2 rounded shadow-xl backdrop-blur-sm">
              <div className="text-[8px] font-bold text-brand-text-dim uppercase tracking-tighter mb-0.5">Layer</div>
              <div className="text-[10px] font-mono text-white whitespace-nowrap">ROUGH (1/4)</div>
            </div>
            <div className="bg-black/80 border border-brand-border p-2 rounded shadow-xl backdrop-blur-sm">
              <div className="text-[8px] font-bold text-brand-text-dim uppercase tracking-tighter mb-0.5">Taper</div>
              <div className="text-[10px] font-mono text-white">+{currentPoint?.u > 0 ? (Math.atan(currentPoint.u / 40) * 180 / Math.PI).toFixed(2) : '0.00'}°</div>
            </div>
          </div>

          {/* Wire Break Warning Overlay */}
          {state.isWireBroken && (
            <div className="absolute inset-0 z-30 bg-red-950/40 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="max-w-md bg-brand-surface border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)] p-8 rounded-2xl space-y-6">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto ring-8 ring-red-500/10">
                  <AlertTriangle size={40} className="text-red-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Machine Fault: Wire Broken</h3>
                  <p className="text-sm text-brand-text-dim leading-relaxed">
                    {state.breakReason}
                  </p>
                </div>
                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={() => setState(p => ({ ...p, isWireBroken: false, breakReason: null }))}
                    className="w-full py-3 bg-red-500 hover:bg-red-600 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all transform active:scale-95"
                  >
                    Thread New Wire (AWT)
                  </button>
                  <p className="text-[9px] text-red-500/60 font-mono uppercase">Standard operating procedure required</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: TELEMETRY */}
        <section className={`
          ${isTelemetryOpen ? 'flex' : 'hidden'}
          md:flex absolute md:relative inset-0 md:inset-auto z-40 md:z-auto
          bg-brand-bg flex-col border-l border-brand-border w-full md:w-auto
        `}>
          <div className="px-4 py-2.5 border-b border-brand-border bg-brand-surface/30 flex justify-between items-center">
            <span className="text-[10px] font-bold text-brand-text-dim tracking-widest uppercase">Telemetry & Parameters</span>
            <button onClick={() => setIsTelemetryOpen(false)} className="md:hidden text-brand-text-dim"><ChevronRight size={14} className="rotate-180" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-0 border-b border-brand-border divide-y divide-brand-border/30">
              {[
                { label: 'X-Axis', value: currentPoint?.x || 0, color: 'text-white' },
                { label: 'Y-Axis', value: currentPoint?.y || 0, color: 'text-white' },
                { label: 'U-Axis', value: currentPoint?.u || 0, color: 'text-brand-accent' },
                { label: 'V-Axis', value: currentPoint?.v || 0, color: 'text-brand-accent' }
              ].map((axis, idx) => (
                <div key={idx} className="flex justify-between items-center px-4 py-2.5 font-mono">
                  <span className="text-[10px] text-brand-text-dim uppercase">{axis.label}</span>
                  <span className={`text-sm font-bold ${axis.color}`}>{axis.value.toFixed(3)}</span>
                </div>
              ))}

              {/* Real-time Wire Tension Gauge */}
              <div className="px-4 py-4 border-t border-brand-border bg-brand-accent/5">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Activity size={12} className={state.tension > 70 ? 'text-red-500 animate-pulse' : 'text-brand-accent'} />
                    <span className="text-[9px] font-bold text-brand-text-dim uppercase tracking-widest">Wire Tension</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${state.tension > 80 ? 'text-red-500' : state.tension > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {state.tension.toFixed(1)}%
                  </span>
                </div>
                
                {/* Visual Gauge */}
                <div className="relative h-4 bg-[#111] rounded-sm overflow-hidden flex items-end p-0.5 gap-px">
                  {[...Array(24)].map((_, i) => {
                    const threshold = (i / 24) * 100;
                    const isActive = state.tension > threshold;
                    return (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={{ 
                          height: isActive ? `${Math.min(100, 20 + (Math.random() * 80))}%` : '15%',
                          backgroundColor: isActive 
                            ? (threshold > 80 ? '#ef4444' : threshold > 50 ? '#fbbf24' : '#10b981')
                            : 'rgba(255,255,255,0.05)'
                        }}
                        className="flex-1 rounded-t-[1px]"
                      />
                    );
                  })}
                  
                  {/* Danger Zone Overlay */}
                  <div className="absolute right-0 top-0 bottom-0 w-[20%] bg-red-500/10 border-l border-red-500/20 pointer-events-none" />
                </div>

                {state.tension > 75 && (
                  <div className="mt-2.5 flex items-center gap-2 text-[8px] text-red-400 font-bold uppercase tracking-wider animate-pulse">
                    <AlertTriangle size={10} />
                    Critical Stress: Risk of Breakage
                  </div>
                )}
                
                {/* Tension Factors Tag Cloud */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {state.speed > 0.5 && <span className="text-[7px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.5 rounded uppercase font-bold">High Feed</span>}
                  {(Math.abs(currentPoint?.u || 0) > 1 || Math.abs(currentPoint?.v || 0) > 1) && <span className="text-[7px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded uppercase font-bold">Taper Drag</span>}
                  {state.tension > 40 && <span className="text-[7px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded uppercase font-bold">Dynamic Stress</span>}
                  <span className="text-[7px] bg-brand-accent/10 text-brand-accent border border-brand-accent/20 px-1 py-0.5 rounded uppercase font-bold">{MATERIALS[state.material].name}</span>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-brand-border space-y-3 bg-brand-surface/20">
                <span className="text-[9px] font-bold text-brand-text-dim uppercase tracking-widest block">Workpiece Material</span>
                <div className="relative">
                  <select 
                    value={state.material}
                    onChange={(e) => setState(p => ({ ...p, material: e.target.value as any }))}
                    className="w-full bg-black/40 border border-brand-border rounded p-2 text-white font-mono text-xs focus:outline-none appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                  >
                    {Object.entries(MATERIALS).map(([key, mat]) => (
                      <option key={key} value={key} className="bg-brand-surface text-white">
                        {mat.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-dim">
                    <ChevronRight size={12} className="rotate-90" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[7px] text-brand-text-dim uppercase">Speed Multiplier</span>
                    <span className="text-[10px] font-mono text-brand-accent">x{MATERIALS[state.material].speedMult.toFixed(1)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-brand-text-dim uppercase">Risk Factor</span>
                    <span className="text-[10px] font-mono text-brand-accent">x{MATERIALS[state.material].riskMult.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2.5 border-t border-brand-border bg-brand-accent/5">
                <span className="text-[9px] font-bold text-brand-accent uppercase">WCS Reference</span>
                <span className="text-[10px] font-mono text-white">G54 (Predrill Center)</span>
              </div>
              
              <div className="px-4 py-3 border-t border-brand-border space-y-3">
                <span className="text-[9px] font-bold text-brand-text-dim uppercase tracking-widest block">Predrill Position (mm)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/40 border border-brand-border rounded p-1.5 flex flex-col">
                    <span className="text-[8px] text-brand-text-dim uppercase">X-Pos</span>
                    <input 
                      type="number" 
                      value={state.predrillPos.x}
                      onChange={(e) => setState(p => ({ ...p, predrillPos: { ...p.predrillPos, x: parseFloat(e.target.value) || 0 } }))}
                      className="bg-transparent text-white font-mono text-xs focus:outline-none w-full"
                    />
                  </div>
                  <div className="bg-black/40 border border-brand-border rounded p-1.5 flex flex-col">
                    <span className="text-[8px] text-brand-text-dim uppercase">Y-Pos</span>
                    <input 
                      type="number" 
                      value={state.predrillPos.y}
                      onChange={(e) => setState(p => ({ ...p, predrillPos: { ...p.predrillPos, y: parseFloat(e.target.value) || 0 } }))}
                      className="bg-transparent text-white font-mono text-xs focus:outline-none w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-2.5 font-mono border-t border-brand-border">
                <span className="text-[10px] text-brand-text-dim uppercase">Z-Plane</span>
                <span className="text-sm font-bold text-white">40.000</span>
              </div>
            </div>

            <div className="p-4 border-b border-brand-border space-y-4">
              <div className="bg-brand-accent/5 border border-brand-accent/20 p-3 rounded flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-brand-accent uppercase tracking-widest">Active Status</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${currentPoint?.lineIndex === -2 ? 'bg-amber-500/20 text-amber-400' : (state.currentPass === 'rough' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}`}>
                    {currentPoint?.lineIndex === -2 ? 'THREADING' : state.currentPass.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px] text-brand-text-dim leading-tight">
                  {currentPoint?.lineIndex === -2 
                    ? "Automatic Wire Threading (AWT) in progress. Moving to start point."
                    : (state.currentPass === 'rough' 
                      ? "Material removal with high energy discharge." 
                      : "Precision finishing for surface quality.")}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest mb-3 block">Simulation Speed</label>
                <div className="space-y-2">
                  <div className="h-1 bg-[#222] rounded-full relative">
                    <div 
                      className="absolute top-0 left-0 h-full bg-brand-accent rounded-full" 
                      style={{ width: `${state.speed * 100}%` }} 
                    />
                    <input 
                      type="range"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={state.speed}
                      onChange={(e) => setState(p => ({ ...p, speed: parseFloat(e.target.value) }))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-brand-text-dim font-mono">
                    <span>0.1x</span>
                    <span className="text-brand-accent">{(state.speed * 10).toFixed(1)}x</span>
                    <span>10x</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest block">Visualization</label>
              {[
                { label: 'Show Path Overcut', active: state.showPath, toggle: () => setState(p => ({ ...p, showPath: !p.showPath })) },
                { label: 'Show Stock Block', active: state.showWorkpiece, toggle: () => setState(p => ({ ...p, showWorkpiece: !p.showWorkpiece })) }
              ].map((opt, i) => (
                <button 
                  key={i}
                  onClick={opt.toggle}
                  className="flex items-center gap-3 w-full text-left"
                >
                  <div className={`w-3 h-3 border border-brand-border rounded-sm transition-colors ${opt.active ? 'bg-brand-accent border-brand-accent' : ''}`} />
                  <span className={`text-[11px] transition-colors ${opt.active ? 'text-white' : 'text-brand-text-dim'}`}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <MicroscopeView 
          isOpen={isMicroscopeOpen}
          onClose={() => setIsMicroscopeOpen(false)}
          active={state.isPlaying && !state.isWireBroken && currentPoint?.lineIndex !== -2}
          speed={state.speed}
          kerf={state.kerf}
          material={state.material}
        />
      </main>

      {/* FOOTER: CONTROLS & TIMELINE */}
      <footer className="h-[70px] md:h-[80px] bg-brand-surface border-t border-brand-border flex items-center px-4 md:px-6 gap-4 md:gap-8 shrink-0 z-50">
        <div className="flex gap-1.5 md:gap-2">
          <button 
            disabled={state.isWireBroken}
            onClick={() => setState(p => ({ ...p, isPlaying: !p.isPlaying }))}
            className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-md transition-all ${state.isPlaying ? 'bg-brand-border text-white' : 'bg-brand-accent text-black font-bold'} ${state.isWireBroken ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            {state.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5 md:ml-1" fill="currentColor" />}
          </button>
          <button 
            onClick={() => setState(p => ({ ...p, progress: 0, isPlaying: false, isWireBroken: false, breakReason: null }))}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-md bg-brand-border text-white hover:bg-brand-border/80"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="hidden sm:block text-[9px] md:text-[10px] font-bold text-brand-text-dim uppercase tracking-widest mb-1.5 md:mb-2">Program Timeline</div>
          <div className="h-3 md:h-4 bg-[#222] rounded-sm relative overflow-hidden border border-brand-border/50">
            <div 
              className="absolute top-0 left-0 h-full bg-brand-accent/30" 
              style={{ width: `${state.progress * 100}%` }} 
            />
            <div 
              className="absolute top-0 left-0 h-full w-[2px] bg-brand-accent shadow-[0_0_10px_rgba(255,159,10,0.5)]" 
              style={{ left: `${state.progress * 100}%` }} 
            />
            <input 
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={state.progress}
              onChange={(e) => setState(p => ({ ...p, progress: parseFloat(e.target.value), isPlaying: false }))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
          <div className="flex justify-between text-[8px] md:text-[10px] font-mono text-brand-text-dim mt-1.5 md:mt-2 uppercase">
            <span>00:00:00</span>
            <span className="text-white font-bold hidden xs:inline">EST: 00:14:22</span>
            <span>00:24:00</span>
          </div>
        </div>

        <div className="hidden lg:flex gap-3">
          <button className="bg-brand-surface border border-brand-border px-3 py-1.5 rounded text-[10px] font-bold text-brand-text-dim hover:text-white transition-colors">
            REPORT
          </button>
        </div>
      </footer>
    </div>
  );

};
