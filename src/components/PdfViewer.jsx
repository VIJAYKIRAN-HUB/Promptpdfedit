import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SplitSquareVertical,
  CheckCircle2,
  MousePointer,
  Sparkles,
  Save,
  Type
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import InteractiveCanvas from './InteractiveCanvas';
import api from '../services/api';

// Configure pdfjs worker to use standard CDN matching pdfjs-dist version
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

export default function PdfViewer({
  documentId,
  docUrl,
  originalUrl,
  pageCount = 1,
  compareMode = false,
  activeVersion = 1,
  onToggleCompare,
  isProcessing = false,
  pendingEdits = {},
  onSaveDirectEdit,
  onDeleteDirectEdit,
  onAddDirectText,
  onApplyDirectEdits
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [totalPages, setTotalPages] = useState(pageCount || 1);
  const [loading, setLoading] = useState(false);
  const [loadedPdfDoc, setLoadedPdfDoc] = useState(null);
  const [loadedOriginalPdfDoc, setLoadedOriginalPdfDoc] = useState(null);
  const [isDirectEditMode, setIsDirectEditMode] = useState(true);
  const [textElementsData, setTextElementsData] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const originalPdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const originalRenderTaskRef = useRef(null);

  // Fetch TextElements for WYSIWYG editing
  useEffect(() => {
    let isCancelled = false;
    if (!documentId) return;

    api.getTextElements(documentId, currentPage, activeVersion)
      .then((data) => {
        if (!isCancelled) {
          setTextElementsData(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load text elements for page:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [documentId, currentPage, activeVersion]);

  // Load Main PDF Document
  useEffect(() => {
    let isCancelled = false;
    if (!documentId && !docUrl) return;

    setLoading(true);

    const loadPdfDoc = async () => {
      try {
        let loadingTask;
        if (documentId) {
          const blob = await api.getDocumentFileBlob(documentId, activeVersion);
          if (isCancelled) return;
          const arrayBuffer = await blob.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else {
          const fullUrl = docUrl.startsWith('http') ? docUrl : `${window.location.origin}${docUrl}`;
          loadingTask = pdfjsLib.getDocument({ url: fullUrl });
        }

        const pdf = await loadingTask.promise;
        if (isCancelled) return;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setLoadedPdfDoc(pdf);
      } catch (err) {
        if (!isCancelled) {
          console.error('PDF.js main document load error:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadPdfDoc();

    return () => {
      isCancelled = true;
    };
  }, [documentId, activeVersion, docUrl]);

  // Load Original PDF Document for Compare Mode
  useEffect(() => {
    let isCancelled = false;
    if (!compareMode) return;
    if (!documentId && !originalUrl) return;

    const loadOriginalPdf = async () => {
      try {
        let loadingTask;
        if (documentId) {
          const blob = await api.getDocumentFileBlob(documentId, 1);
          if (isCancelled) return;
          const arrayBuffer = await blob.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else {
          const fullUrl = originalUrl.startsWith('http') ? originalUrl : `${window.location.origin}${originalUrl}`;
          loadingTask = pdfjsLib.getDocument({ url: fullUrl });
        }

        const pdf = await loadingTask.promise;
        if (isCancelled) return;
        originalPdfDocRef.current = pdf;
        setLoadedOriginalPdfDoc(pdf);
      } catch (err) {
        console.warn('Original PDF load error:', err);
      }
    };

    loadOriginalPdf();

    return () => {
      isCancelled = true;
    };
  }, [compareMode, documentId, originalUrl]);

  // Re-render when page, scale, loadedPdfDoc, or compareMode changes
  useEffect(() => {
    if (loadedPdfDoc && canvasRef.current) {
      renderCurrentPage(loadedPdfDoc, currentPage, canvasRef.current, scale, renderTaskRef);
    }
  }, [loadedPdfDoc, currentPage, scale]);

  useEffect(() => {
    if (compareMode && loadedOriginalPdfDoc && originalCanvasRef.current) {
      renderCurrentPage(loadedOriginalPdfDoc, currentPage, originalCanvasRef.current, scale, originalRenderTaskRef);
    }
  }, [compareMode, loadedOriginalPdfDoc, currentPage, scale]);

  const renderCurrentPage = async (pdfDoc, pageNum, canvasElement, currentScale, activeRenderRef) => {
    if (!pdfDoc || !canvasElement) return;

    try {
      if (activeRenderRef && activeRenderRef.current) {
        try {
          activeRenderRef.current.cancel();
        } catch (_) {}
        activeRenderRef.current = null;
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale * 1.5 });
      const canvas = canvasElement;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      if (activeRenderRef) {
        activeRenderRef.current = renderTask;
      }

      await renderTask.promise;

      // Update screen dimensions for interactive overlay
      const rect = canvas.getBoundingClientRect();
      setCanvasDimensions({
        width: rect.width || canvas.width / 1.5,
        height: rect.height || canvas.height / 1.5
      });
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  };

  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const handleZoomIn = () => setScale((s) => Math.min(2.5, s + 0.15));
  const handleZoomOut = () => setScale((s) => Math.max(0.6, s - 0.15));
  const handleResetZoom = () => setScale(1.0);

  const pendingCount = Object.keys(pendingEdits).length;

  return (
    <div className="flex flex-col h-full bg-slate-100/70 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Top Toolbar */}
      <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Page Navigation */}
        <div className="flex items-center space-x-1.5 bg-slate-100 rounded-lg p-1">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 transition"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 transition"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-medium text-slate-700 min-w-[44px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition"
            title="Reset scale"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Direct Click-to-Edit & Compare Mode Toggles */}
        <div className="flex items-center space-x-2">
          {!compareMode && (
            <button
              onClick={() => setIsDirectEditMode(!isDirectEditMode)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                isDirectEditMode
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Click on any text on the page to edit it directly"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Click-to-Edit: {isDirectEditMode ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {pendingCount > 0 && !compareMode && (
            <button
              onClick={onApplyDirectEdits}
              disabled={isProcessing}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition animate-pulse"
              title="Save all direct edits onto the PDF"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes ({pendingCount})</span>
            </button>
          )}

          <button
            onClick={onToggleCompare}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              compareMode
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <SplitSquareVertical className="w-4 h-4" />
            <span>Compare Mode: {compareMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Direct-Click Hint Banner */}
      {isDirectEditMode && !compareMode && (
        <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-1.5 flex items-center justify-between text-[11px] text-indigo-700">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
            <span><strong>Click any text</strong> on the PDF to edit or delete it. Click empty space to add new text.</span>
          </div>
          {pendingCount > 0 && (
            <span className="font-semibold text-emerald-700">
              {pendingCount} edit{pendingCount === 1 ? '' : 's'} staged
            </span>
          )}
        </div>
      )}

      {/* Viewer Main Stage */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center">
        {compareMode ? (
          /* Side-by-Side Diff Layout */
          <div className="flex flex-col w-full max-w-6xl space-y-3">
            {/* Diff Header Bar */}
            <div className="w-full flex flex-wrap items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs gap-2">
              <div className="flex items-center space-x-2">
                <SplitSquareVertical className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-800">Visual Verification Diff</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium">Synchronized Page {currentPage} of {totalPages}</span>
              </div>

              <div className="flex items-center space-x-3 text-[11px]">
                <span className="flex items-center space-x-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-slate-600">Original Baseline (v1)</span>
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="flex items-center space-x-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-emerald-700 font-semibold">AI Edited Result (v{activeVersion})</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              {/* Original PDF Pane */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-2 px-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Original Document (v1)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Baseline
                  </span>
                </div>
                <div className="p-2 rounded-2xl bg-white shadow-md border border-slate-200 overflow-hidden max-w-full relative min-h-[350px] min-w-[260px] flex items-center justify-center">
                  {(!loadedOriginalPdfDoc || loading) && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
                    </div>
                  )}
                  <canvas
                    ref={originalCanvasRef}
                    className="rounded bg-white max-w-full h-auto object-contain block"
                    style={{ maxHeight: '72vh' }}
                  />
                </div>
              </div>

              {/* Edited PDF Pane */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-2 px-1">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Edited Document (v{activeVersion})</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified AI Output</span>
                  </span>
                </div>
                <div className="p-2 rounded-2xl bg-white shadow-md border-2 border-indigo-400/80 overflow-hidden max-w-full relative min-h-[350px] min-w-[260px] flex items-center justify-center">
                  {(!loadedPdfDoc || loading || isProcessing) && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-10 space-y-2">
                      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-xs font-semibold text-slate-600">
                        {isProcessing ? 'Updating document...' : 'Loading document...'}
                      </p>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    className="rounded bg-white max-w-full h-auto object-contain block"
                    style={{ maxHeight: '72vh' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Single Pane Viewer with Interactive Canvas Overlay */
          <div className="flex flex-col items-center max-w-full">
            <div className="relative inline-block select-none rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden min-h-[400px] min-w-[300px]">
              {/* Spinner Overlay when loading or processing */}
              {(!loadedPdfDoc || loading || isProcessing) && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-30 space-y-3">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-semibold text-slate-600">
                    {isProcessing ? 'Applying visual redactions & font metrics...' : 'Loading document...'}
                  </p>
                </div>
              )}

              <canvas
                ref={canvasRef}
                className="rounded-2xl bg-white max-w-full h-auto object-contain block"
                style={{ maxHeight: '78vh' }}
              />

              {/* WYSIWYG Direct Click Overlay */}
              {isDirectEditMode && textElementsData && canvasDimensions.width > 0 && (
                <InteractiveCanvas
                  elements={textElementsData.elements}
                  pageSize={{ width: textElementsData.width, height: textElementsData.height }}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                  pageNumber={currentPage}
                  pendingEdits={pendingEdits}
                  onSaveEdit={onSaveDirectEdit}
                  onDeleteElement={onDeleteDirectEdit}
                  onAddText={onAddDirectText}
                  isDirectEditEnabled={isDirectEditMode}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
