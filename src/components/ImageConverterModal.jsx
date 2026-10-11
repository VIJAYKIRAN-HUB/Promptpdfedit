import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, ArrowRight } from 'lucide-react';
import api from '../services/api';

export default function ImageConverterModal({ isOpen, onClose, onConverted }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fitA4, setFitA4] = useState(true);
  const [margin, setMargin] = useState(40);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;

    setIsConverting(true);
    setError(null);
    try {
      const doc = await api.convertImagesToPdf(selectedFiles, fitA4, margin);
      onConverted(doc);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Image conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Image to PDF Converter</h3>
              <p className="text-xs text-slate-500">Combine photos and graphics into a clean, unified PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Upload Dropzone */}
        <div className="mt-5">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-6 cursor-pointer bg-slate-50/70 hover:bg-indigo-50/30 transition">
            <Upload className="w-8 h-8 text-indigo-500 mb-2" />
            <span className="text-sm font-semibold text-slate-800">Select Images</span>
            <span className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP &bull; Multiple files supported</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 max-h-36 overflow-y-auto space-y-2 pr-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Files to convert ({selectedFiles.length})
            </span>
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-4 h-4 rounded bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-mono">
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 rounded text-slate-400 hover:text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Fit to Standard A4 Pages</span>
            <input
              type="checkbox"
              checked={fitA4}
              onChange={(e) => setFitA4(e.target.checked)}
              className="rounded accent-indigo-600 w-4 h-4 cursor-pointer"
            />
          </div>
          {fitA4 && (
            <div className="space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Page Margins</span>
                <span className="font-mono text-slate-700">{margin}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedFiles.length === 0 || isConverting}
            className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition"
          >
            {isConverting ? (
              <span>Converting...</span>
            ) : (
              <>
                <span>Create PDF</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
