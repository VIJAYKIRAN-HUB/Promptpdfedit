import React, { useState } from 'react';
import {
  GripVertical,
  Trash2,
  Maximize2,
  Minimize2,
  Scaling,
  Upload,
  ArrowRight,
  FileCheck,
  Plus,
  RefreshCw,
  Mail,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Layers
} from 'lucide-react';
import api from '../services/api';

export default function ImageGridWorkspace({
  initialFiles = [],
  onClose,
  onPdfGenerated
}) {
  // Each sheet item: { id, file, previewUrl, name, size, fitMode: 'fit' | 'fill' | 'original' }
  const [sheets, setSheets] = useState(() =>
    initialFiles.map((file, idx) => ({
      id: `sheet_${idx}_${Date.now()}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      fitMode: 'fit' // 'fit' (Fit to Page), 'fill' (Fill Page), 'original' (Original size)
    }))
  );

  const [globalMargin, setGlobalMargin] = useState(20);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // File addition handler
  const handleAddFiles = (e) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map((file, idx) => ({
        id: `sheet_${sheets.length + idx}_${Date.now()}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        fitMode: 'fit'
      }));
      setSheets((prev) => [...prev, ...newItems]);
    }
  };

  // Reordering handlers (HTML5 Drag & Drop)
  const handleDragStart = (idx) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIdx) return;

    setSheets((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedIndex, 1);
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
    setDraggedIndex(targetIdx);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Move buttons for accessible 1-click reordering
  const moveSheet = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= sheets.length) return;
    setSheets((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated;
    });
  };

  // Change fit mode for a specific sheet
  const updateFitMode = (id, newMode) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, fitMode: newMode } : s))
    );
  };

  // Delete sheet
  const removeSheet = (id) => {
    setSheets((prev) => prev.filter((s) => s.id !== id));
  };

  // Generate ReportLab PDF
  const handleExportPdf = async () => {
    if (sheets.length === 0) return;

    setIsGenerating(true);
    setError(null);

    try {
      const filesList = sheets.map((s) => s.file);
      const sheetSettings = sheets.map((s) => ({
        filename: s.name,
        fit_mode: s.fitMode,
        margin: globalMargin
      }));

      const doc = await api.convertImagesToPdfWithReportLab(
        filesList,
        sheetSettings,
        globalMargin
      );

      if (onPdfGenerated) {
        onPdfGenerated(doc);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate PDF document.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 md:p-8 animate-in fade-in">
      <div className="bg-slate-50 w-full max-w-6xl mx-auto rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto">
        {/* Workspace Top Toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Image to PDF Studio
              </h2>
              <p className="text-xs text-slate-500">
                Word-style multi-sheet workspace &bull; Drag to reorder pages &bull; ReportLab canvas engine
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 bg-slate-100 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-600 font-medium">Margin:</span>
              <select
                value={globalMargin}
                onChange={(e) => setGlobalMargin(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={0}>0 pt (Full Bleed)</option>
                <option value={20}>20 pt (Standard)</option>
                <option value={40}>40 pt (Spacious)</option>
              </select>
            </div>

            <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Images</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleAddFiles}
              />
            </label>

            <button
              onClick={handleExportPdf}
              disabled={sheets.length === 0 || isGenerating}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing PDF...</span>
                </>
              ) : (
                <>
                  <span>Create PDF ({sheets.length} pages)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-3 py-2 text-slate-400 hover:text-slate-700 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Word-Style Multi-Sheet Grid Stage */}
        <div className="p-6 sm:p-8 bg-slate-100/70 overflow-y-auto max-h-[68vh]">
          {sheets.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-slate-800">No images in workspace</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Click "Add Images" above to upload pictures, mockups, or documents.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sheets.map((sheet, idx) => {
                const isDragging = draggedIndex === idx;
                return (
                  <div
                    key={sheet.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`group relative bg-white rounded-2xl border transition-all flex flex-col ${
                      isDragging
                        ? 'opacity-40 scale-95 border-indigo-500 shadow-xl'
                        : 'border-slate-200 hover:border-indigo-300 shadow-md hover:shadow-xl'
                    }`}
                  >
                    {/* Sheet Header: Page Badge & Drag Handle */}
                    <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs bg-slate-50/50 rounded-t-2xl">
                      <div className="flex items-center space-x-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700">
                        <GripVertical className="w-3.5 h-3.5" />
                        <span className="font-bold text-slate-800 font-mono">
                          Page {idx + 1}
                        </span>
                      </div>

                      {/* Quick Move Arrows & Delete */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => moveSheet(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          title="Move Left"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveSheet(idx, idx + 1)}
                          disabled={idx === sheets.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          title="Move Right"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeSheet(sheet.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 transition ml-1"
                          title="Remove Page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Word-Style A4 Sheet Visual Preview */}
                    <div className="p-3 flex items-center justify-center bg-slate-100/50">
                      <div
                        className="w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center relative"
                        style={{ height: '220px' }}
                      >
                        <img
                          src={sheet.previewUrl}
                          alt={sheet.name}
                          className={`w-full h-full transition duration-200 ${
                            sheet.fitMode === 'fill'
                              ? 'object-cover'
                              : sheet.fitMode === 'original'
                              ? 'object-none'
                              : 'object-contain p-2'
                          }`}
                        />
                        <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/60 text-white px-1.5 py-0.5 rounded font-mono">
                          {sheet.fitMode.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Image Fit Controls Footer */}
                    <div className="p-3 border-t border-slate-100 space-y-2 mt-auto">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 truncate">
                        <span className="truncate max-w-[130px] font-medium text-slate-700">{sheet.name}</span>
                        <span className="font-mono">{(sheet.size / 1024).toFixed(0)} KB</span>
                      </div>

                      {/* Fit Mode Switcher Pills */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-semibold text-center">
                        <button
                          type="button"
                          onClick={() => updateFitMode(sheet.id, 'fit')}
                          className={`py-1 rounded-lg transition ${
                            sheet.fitMode === 'fit'
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Fit to Page: Keep aspect ratio, show whole image"
                        >
                          Fit Page
                        </button>
                        <button
                          type="button"
                          onClick={() => updateFitMode(sheet.id, 'fill')}
                          className={`py-1 rounded-lg transition ${
                            sheet.fitMode === 'fill'
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Fill Page: Scale to cover entire page, crop edges"
                        >
                          Fill Page
                        </button>
                        <button
                          type="button"
                          onClick={() => updateFitMode(sheet.id, 'original')}
                          className={`py-1 rounded-lg transition ${
                            sheet.fitMode === 'original'
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Original Size: Center without scaling"
                        >
                          Original
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Sheet Drop Target */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 cursor-pointer bg-white/60 hover:bg-white transition group min-h-[300px]">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition mb-3">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-800">Add Next Page</span>
                <span className="text-[11px] text-slate-400 mt-1 text-center">PNG, JPG, or WEBP</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleAddFiles}
                />
              </label>
            </div>
          )}
        </div>

        {/* SECTION 4: Software & Ad Contact Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">
                Interested in advertising on PromptPDF or need a custom software solution?
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Full-stack web applications, AI document processing pipelines, and enterprise automation.
              </p>
            </div>
          </div>

          <a
            href="mailto:karanamvijaykiran@gmail.com?subject=PromptPDF%20Inquiry%20-%20Advertising%20/%20Custom%20Software"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm shrink-0"
          >
            <span>karanamvijaykiran@gmail.com</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
}
