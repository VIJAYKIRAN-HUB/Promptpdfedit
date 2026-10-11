import React, { useState, useEffect } from 'react';
import { FileText, Upload, Download, Sparkles, Image, Lock, ShieldCheck } from 'lucide-react';

export default function Header({
  activeDoc,
  activeVersion,
  onUploadClick,
  onImageConverterClick,
  onDownloadClick,
  onResetToHome
}) {
  const [secondsLeft, setSecondsLeft] = useState(3599);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 3600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Nav */}
        <div className="flex items-center space-x-8">
          <button
            onClick={onResetToHome}
            className="flex items-center space-x-2.5 group text-left focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:bg-indigo-700 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight flex items-center">
                PromptPDF<span className="text-indigo-600">Edit</span>
              </span>
            </div>
          </button>

          {/* Minimal Nav Links */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
            <button
              onClick={onResetToHome}
              className="hover:text-indigo-600 transition"
            >
              AI Editor
            </button>
            <button
              onClick={onImageConverterClick}
              className="hover:text-indigo-600 transition"
            >
              Image to PDF
            </button>
            <span className="hover:text-indigo-600 transition cursor-pointer text-slate-400">
              Pricing
            </span>
          </nav>
        </div>

        {/* Right Actions: Subtle Privacy Badge & CTAs */}
        <div className="flex items-center space-x-3">
          {/* Subtle Trust Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Auto-purges in {formatCountdown(secondsLeft)}</span>
          </div>

          <button
            onClick={onImageConverterClick}
            className="hidden lg:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <Image className="w-4 h-4 text-slate-500" />
            <span>Image to PDF</span>
          </button>

          <button
            onClick={onUploadClick}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeDoc ? 'Upload New' : 'Upload'}</span>
          </button>

          {activeDoc && (
            <button
              onClick={onDownloadClick}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
