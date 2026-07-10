/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Upload, FileCode, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (content: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'gcode' && extension !== 'nc' && extension !== 'txt') {
      setError('Invalid file type. Please upload .GCODE or .NC files.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onUpload(content);
      }
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer text-center
          ${isDragging 
            ? 'border-brand-accent bg-brand-accent/5' 
            : 'border-brand-border hover:border-brand-text-dim bg-brand-surface/20'}
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          accept=".gcode,.nc,.txt"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-colors
            ${isDragging ? 'bg-brand-accent text-black' : 'bg-brand-surface text-brand-text-dim'}
          `}>
            {isDragging ? <Upload size={24} /> : <FileCode size={24} />}
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-bold text-brand-text">
              {isDragging ? 'Drop to upload' : 'Click or drag G-Code'}
            </p>
            <p className="text-[10px] text-brand-text-dim uppercase tracking-widest">
              Supports .NC, .GCODE, .TXT
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};
