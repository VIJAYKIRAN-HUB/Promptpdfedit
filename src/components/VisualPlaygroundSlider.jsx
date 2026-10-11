import React, { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Wand2, Shield, Check, MoveHorizontal } from 'lucide-react';

export default function VisualPlaygroundSlider({ onTryPrompt }) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0 - 100
  const [activePrompt, setActivePrompt] = useState('Replace "John Doe" with "David Vance"');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const samplePrompts = [
    {
      label: 'Change Account Holder',
      prompt: 'Replace "John Doe" with "David Vance"',
      before: 'Account Holder: John Doe',
      after: 'Account Holder: David Vance'
    },
    {
      label: 'Update Agreement Date',
      prompt: 'Change date to "October 11, 2026"',
      before: 'Agreement Date: January 15, 2024',
      after: 'Agreement Date: October 11, 2026'
    },
    {
      label: 'Redact Confidential ID',
      prompt: 'Redact confidential ID numbers',
      before: 'Confidential ID: ID-984210',
      after: 'Confidential ID: [REDACTED]'
    },
    {
      label: 'Recalculate Balance',
      prompt: 'Update statement balance to "$2,850.00"',
      before: 'Statement Balance: $1,250.00',
      after: 'Statement Balance: $2,850.00'
    }
  ];

  const handlePointerMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clamped = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPosition(clamped);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handlePointerMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX);
    }
  };

  const selectPrompt = (item) => {
    setActivePrompt(item.prompt);
    // Smoothly slide to reveal the change
    setSliderPosition(35);
  };

  return (
    <section className="py-12 px-4 sm:px-6 max-w-5xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
          <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Interactive Visual Playground</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          See the layout-preserving AI in action
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mt-2">
          Drag the slider to see how plain-English prompts modify exact text while preserving original fonts, sizes, and layout geometries.
        </p>

        {/* Prompt Suggestion Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-3xl mx-auto">
          {samplePrompts.map((item, idx) => {
            const isActive = activePrompt === item.prompt;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectPrompt(item)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center space-x-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-indigo-300'
                }`}
              >
                <Sparkles className={`w-3 h-3 ${isActive ? 'text-indigo-200' : 'text-indigo-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Before / After Comparison Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden max-w-4xl mx-auto">
        {/* Active Prompt Preview Bar */}
        <div className="bg-slate-900 text-white px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-b border-slate-800">
          <div className="flex items-center space-x-2.5 truncate">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Prompt
            </span>
            <span className="font-mono text-slate-200 truncate font-medium">"{activePrompt}"</span>
          </div>

          {onTryPrompt && (
            <button
              onClick={() => onTryPrompt(activePrompt)}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shrink-0 cursor-pointer text-[11px]"
            >
              <span>Test on Live Document</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Visual Slider Stage */}
        <div
          ref={containerRef}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="relative select-none overflow-hidden h-[340px] sm:h-[380px] bg-slate-100 cursor-ew-resize"
        >
          {/* AFTER VIEW (Clean AI Result - Full Width Base) */}
          <div className="absolute inset-0 bg-white p-6 sm:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Official Statement of Account
                  </h3>
                  <span className="text-xs text-slate-500">Document No: DOC-2026-9941</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>AI Result</span>
                </span>
              </div>

              {/* Document Fields */}
              <div className="space-y-4 max-w-md font-sans text-xs sm:text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Agreement Date:</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    October 11, 2026
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Account Holder:</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    David Vance
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Confidential ID:</span>
                  <span className="font-mono text-slate-800 bg-slate-900 text-slate-900 px-3 py-0.5 rounded select-none">
                    ██████████
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Statement Balance:</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    $2,850.00
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Layout geometry: 100% matched</span>
              <span className="font-semibold text-indigo-600">Verified by PyMuPDF Core</span>
            </div>
          </div>

          {/* BEFORE VIEW (Clipped Original Left Panel) */}
          <div
            className="absolute inset-0 bg-slate-50 border-r-2 border-indigo-600 overflow-hidden shadow-2xl"
            style={{ width: `${sliderPosition}%` }}
          >
            <div className="w-[896px] p-6 sm:p-10 flex flex-col justify-between h-full bg-slate-50">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      Official Statement of Account
                    </h3>
                    <span className="text-xs text-slate-500">Document No: DOC-2026-9941</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    Original Document
                  </span>
                </div>

                {/* Original Document Fields */}
                <div className="space-y-4 max-w-md font-sans text-xs sm:text-sm">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Agreement Date:</span>
                    <span className="font-medium text-slate-800">
                      January 15, 2024
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Account Holder:</span>
                    <span className="font-medium text-slate-800">
                      John Doe
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Confidential ID:</span>
                    <span className="font-mono text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded">
                      ID-984210
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Statement Balance:</span>
                    <span className="font-medium text-slate-800">
                      $1,250.00
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                <span>Original scanned PDF layout</span>
                <span>Unedited baseline</span>
              </div>
            </div>
          </div>

          {/* Draggable Divider Handle */}
          <div
            className="absolute top-0 bottom-0 z-20 flex items-center justify-center pointer-events-none"
            style={{ left: `calc(${sliderPosition}% - 18px)` }}
          >
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white shadow-xl flex items-center justify-center border-2 border-white pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
              <MoveHorizontal className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">&larr; Drag handle left/right &rarr;</span>
            <span className="hidden sm:inline">&bull; Compare baseline against AI modifications</span>
          </div>
          <span className="font-medium text-indigo-600">Zero font distortion guarantee</span>
        </div>
      </div>
    </section>
  );
}
