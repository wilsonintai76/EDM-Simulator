/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiagnosticIssue {
  line: number;
  type: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
}

const SUPPORTED_G_CODES = [0, 1, 90, 91, 92];
const SUPPORTED_M_CODES = [0, 2, 30, 80, 81]; // 80/81 for wire EDM thread/cut

export function validateGCode(gcode: string): DiagnosticIssue[] {
  const lines = gcode.split('\n');
  const issues: DiagnosticIssue[] = [];

  const limits = {
    x: { min: -150, max: 150 },
    y: { min: -150, max: 150 },
    u: { min: -30, max: 30 },
    v: { min: -30, max: 30 },
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const commentSplit = rawLine.split(';');
    const line = commentSplit[0].trim().toUpperCase();
    
    if (!line) continue;

    // Syntax check: letters followed by numbers
    const tokens = line.split(/\s+/);
    for (const token of tokens) {
      if (!/^[A-Z](-?\d*\.?\d+)$/.test(token)) {
        issues.push({
          line: i,
          type: 'error',
          message: `Invalid token format: "${token}"`,
          code: token
        });
      }
    }

    // Command specific checks
    const gMatch = line.match(/G(\d+)/);
    if (gMatch) {
      const gCode = parseInt(gMatch[1]);
      if (!SUPPORTED_G_CODES.includes(gCode)) {
        issues.push({
          line: i,
          type: 'warning',
          message: `G${gCode} is not handled by this simulator.`,
          code: `G${gCode}`
        });
      }
    }

    const mMatch = line.match(/M(\d+)/);
    if (mMatch) {
      const mCode = parseInt(mMatch[1]);
      if (!SUPPORTED_M_CODES.includes(mCode)) {
        issues.push({
          line: i,
          type: 'warning',
          message: `M${mCode} is unhandled or may have no effect.`,
          code: `M${mCode}`
        });
      }
    }

    // Range checks
    const coordMatches = {
      X: line.match(/X([-+]?\d*\.?\d+)/),
      Y: line.match(/Y([-+]?\d*\.?\d+)/),
      U: line.match(/U([-+]?\d*\.?\d+)/),
      V: line.match(/V([-+]?\d*\.?\d+)/),
    };

    if (coordMatches.X) {
      const val = parseFloat(coordMatches.X[1]);
      if (val < limits.x.min || val > limits.x.max) {
        issues.push({
          line: i,
          type: 'error',
          message: `X coordinate (${val}) exceeds machine travel limits [${limits.x.min}, ${limits.x.max}].`,
          code: 'X'
        });
      }
    }

    if (coordMatches.Y) {
      const val = parseFloat(coordMatches.Y[1]);
      if (val < limits.y.min || val > limits.y.max) {
        issues.push({
          line: i,
          type: 'error',
          message: `Y coordinate (${val}) exceeds machine travel limits [${limits.y.min}, ${limits.y.max}].`,
          code: 'Y'
        });
      }
    }

    if (coordMatches.U) {
      const val = parseFloat(coordMatches.U[1]);
      if (val < limits.u.min || val > limits.u.max) {
        issues.push({
          line: i,
          type: 'error',
          message: `U (Taper) offset (${val}) exceeds head pivot limits [${limits.u.min}, ${limits.u.max}].`,
          code: 'U'
        });
      }
    }

    if (coordMatches.V) {
      const val = parseFloat(coordMatches.V[1]);
      if (val < limits.v.min || val > limits.v.max) {
        issues.push({
          line: i,
          type: 'error',
          message: `V (Taper) offset (${val}) exceeds head pivot limits [${limits.v.min}, ${limits.v.max}].`,
          code: 'V'
        });
      }
    }
  }

  return issues;
}
