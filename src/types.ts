/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GCodeCommand {
  type: 'G0' | 'G1';
  x?: number;
  y?: number;
  u?: number;
  v?: number;
  f?: number; // Feed rate
  originalLine: string;
}

export interface PathPoint {
  x: number;
  y: number;
  u: number; // Taper offset X (upper guide)
  v: number; // Taper offset Y (upper guide)
  feed: number;
  distance: number; // Cumulative distance from start
  lineIndex?: number;
}

export interface SimulatorState {
  isPlaying: boolean;
  progress: number; // 0 to 1
  speed: number;
  showPath: boolean;
  showWorkpiece: boolean;
  viewMode: '3D' | '2D';
  currentPass: 'rough' | 'skim';
  kerf: number;
  isWireBroken: boolean;
  breakReason: string | null;
  predrillPos: { x: number; y: number };
  isThreading: boolean;
  tension: number;
  material: 'tool_steel' | 'aluminum' | 'graphite' | 'brass';
  isInternalView: boolean;
}
