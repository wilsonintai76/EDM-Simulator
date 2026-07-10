/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { DiagnosticIssue } from '../../utils/gcodeValidator';
import { motion, AnimatePresence } from 'motion/react';

interface GCodeDiagnosticsProps {
  issues: DiagnosticIssue[];
  onSelectLine: (line: number) => void;
}

export const GCodeDiagnostics: React.FC<GCodeDiagnosticsProps> = ({ issues, onSelectLine }) => {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center opacity-40">
        <ShieldAlert size={32} className="mb-2 text-emerald-400" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Syntax Valid</span>
        <p className="text-[9px] mt-1">No potential issues detected in current block.</p>
      </div>
    );
  }

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-brand-border flex justify-between items-center bg-black/40">
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-[10px] font-bold text-white">{errors.length} Errors</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-[10px] font-bold text-white">{warnings.length} Warnings</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        <AnimatePresence>
          {issues.map((issue, idx) => (
            <motion.button
              key={`${issue.line}-${idx}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => onSelectLine(issue.line)}
              className={`w-full text-left p-2 rounded border transition-colors flex gap-2 group ${
                issue.type === 'error' 
                  ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10' 
                  : issue.type === 'warning'
                    ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                    : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
              }`}
            >
              <div className="mt-0.5">
                {issue.type === 'error' && <AlertCircle size={12} className="text-red-500" />}
                {issue.type === 'warning' && <AlertTriangle size={12} className="text-amber-500" />}
                {issue.type === 'info' && <Info size={12} className="text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] font-bold text-brand-text-dim uppercase">Line {issue.line + 1}</span>
                  {issue.code && (
                    <span className="text-[9px] font-mono bg-black/40 px-1 rounded text-white">{issue.code}</span>
                  )}
                </div>
                <p className="text-[10px] text-white leading-tight break-words">
                  {issue.message}
                </p>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
