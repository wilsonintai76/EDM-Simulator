/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';

import { DiagnosticIssue } from '../../utils/gcodeValidator';

interface GCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  activeLine?: number;
  issues?: DiagnosticIssue[];
}

export const GCodeEditor: React.FC<GCodeEditorProps> = ({ value, onChange, activeLine, issues = [] }) => {
  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const highlight = (code: string) => {
    const lines = code.split('\n');
    let htmlLines = lines.map((line, lineIdx) => {
      // Escape HTML
      let html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Syntax highlighting rules
      html = html.replace(/(G\d+)/gi, '<span class="text-brand-accent font-bold">$1</span>');
      html = html.replace(/(M\d+)/gi, '<span class="text-amber-400 font-bold">$1</span>');
      html = html.replace(/([XYUVWZF])([-+]?\d*\.?\d+)/gi, '<span class="text-indigo-300">$1</span><span class="text-white">$2</span>');
      html = html.replace(/(N\d+)/gi, '<span class="opacity-40">$1</span>');
      html = html.replace(/(\(.*?\)|;.*)/g, '<span class="text-brand-text-dim italic opacity-60">$1</span>');

      // Diagnostic highlighting
      const lineIssues = issues.filter(issue => issue.line === lineIdx);
      if (lineIssues.length > 0) {
        const isError = lineIssues.some(i => i.type === 'error');
        const colorClass = isError ? 'bg-red-500/20 underline decoration-red-500/50' : 'bg-amber-500/20 underline decoration-amber-500/50';
        html = `<span class="${colorClass}">${html}</span>`;
      }

      return html;
    });

    return htmlLines.join('\n');
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const lines = value.split('\n');

  return (
    <div className="relative flex-1 font-mono text-[11px] leading-[1.6] overflow-hidden bg-black/20 group">
      {/* Highlighting Layer */}
      <pre
        ref={preRef}
        className="absolute inset-0 p-4 m-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-all"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlight(value) + '\n' }}
      />
      
      {/* Active Line Highlight */}
      {typeof activeLine === 'number' && activeLine >= 0 && (
        <div 
          className="absolute left-0 right-0 bg-brand-accent/10 border-l-2 border-brand-accent pointer-events-none transition-all duration-200"
          style={{ 
            top: `calc(1rem + ${activeLine * 1.6}em)`, 
            height: '1.6em' 
          }}
        />
      )}

      {/* Input Layer */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="absolute inset-0 w-full h-full p-4 m-0 bg-transparent text-transparent caret-brand-accent resize-none focus:outline-none whitespace-pre-wrap break-all border-none overflow-y-auto custom-scrollbar"
      />

      <div className="absolute top-2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <span className="bg-brand-surface/80 border border-brand-border px-1.5 py-0.5 rounded-[2px] text-[8px] text-brand-text-dim uppercase tracking-widest">
          ISO-6983
        </span>
      </div>
    </div>
  );
};
