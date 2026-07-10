/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GCodeCommand, PathPoint } from '../types';

export function parseGCode(gcode: string): PathPoint[] {
  const lines = gcode.split('\n');
  const path: PathPoint[] = [];
  
  let currentX = 0;
  let currentY = 0;
  let currentU = 0;
  let currentV = 0;
  let currentF = 100;
  let totalDistance = 0;

  // Add starting point
  path.push({ x: 0, y: 0, u: 0, v: 0, feed: currentF, distance: 0, lineIndex: -1 });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = line.split(';')[0].trim().toUpperCase();
    if (!cleanLine) continue;

    const matches = {
      g: cleanLine.match(/G(\d+)/),
      x: cleanLine.match(/X([-+]?\d*\.?\d+)/),
      y: cleanLine.match(/Y([-+]?\d*\.?\d+)/),
      u: cleanLine.match(/U([-+]?\d*\.?\d+)/),
      v: cleanLine.match(/V([-+]?\d*\.?\d+)/),
      f: cleanLine.match(/F([-+]?\d*\.?\d+)/),
    };

    if (matches.g) {
      const gType = parseInt(matches.g[1]);
      if (gType === 0 || gType === 1) {
        const nextX = matches.x ? parseFloat(matches.x[1]) : currentX;
        const nextY = matches.y ? parseFloat(matches.y[1]) : currentY;
        const nextU = matches.u ? parseFloat(matches.u[1]) : currentU;
        const nextV = matches.v ? parseFloat(matches.v[1]) : currentV;
        const nextF = matches.f ? parseFloat(matches.f[1]) : currentF;

        const dx = nextX - currentX;
        const dy = nextY - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        totalDistance += dist;

        path.push({
          x: nextX,
          y: nextY,
          u: nextU,
          v: nextV,
          feed: nextF,
          distance: totalDistance,
          lineIndex: i,
        });

        currentX = nextX;
        currentY = nextY;
        currentU = nextU;
        currentV = nextV;
        currentF = nextF;
      }
    }
  }

  return path;
}

export const DEFAULT_GCODE = `
G00 X-20 Y-20
G01 X20 Y-20
G01 X20 Y20
G01 X-20 Y20
G01 X-20 Y-20
G01 X-10 Y-10
G01 X10 Y-10 U2 V0
G01 X10 Y10 U2 V2
G01 X-10 Y10 U0 V2
G01 X-10 Y-10 U0 V0
`.trim();
