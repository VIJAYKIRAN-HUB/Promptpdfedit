import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  ArrowRight,
  RefreshCw,
  Move,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Image as ImageIcon,
  Copy,
  ChevronDown,
  X,
  FileText,
  Sparkles
} from 'lucide-react';
import BusinessBanner from './BusinessBanner';
import api from '../services/api';

// Standard A4 dimensions in PDF points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

export default function MultiPageCanvas({
  initialFiles = [],
  onClose,
  onPdfGenerated
}) {
  // Gallery assets: list of uploaded image files
  const [galleryImages, setGalleryImages] = useState(() =>
    initialFiles.map((file, idx) => ({
      id: `img_${idx}_${Date.now()}`,
      file,
      filename: file.name,
      previewUrl: URL.createObjectURL(file),
      size: file.size
    }))
  );

  // Pages state: array of pages, each with an array of placed images
  // Placed image: { id, fileId, filename, x, y, width, height, zIndex }
  const [pages, setPages] = useState([
    {
      page_num: 1,
      images: []
    }
  ]);

  const [activePageNum, setActivePageNum] = useState(1);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [zoomScale, setZoomScale] = useState(0.85); // visual preview scale
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Drag-from-sidebar state
  const [draggedGalleryItem, setDraggedGalleryItem] = useState(null);

  // Active moving / resizing state
  const [dragState, setDragState] = useState(null); // { imageId, pageNum, startMouseX, startMouseY, startX, startY, startW, startH, mode: 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw' }

  // Add more files to the gallery
  const handleAddGalleryFiles = (e) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map((file, idx) => ({
        id: `img_${galleryImages.length + idx}_${Date.now()}`,
        file,
        filename: file.name,
        previewUrl: URL.createObjectURL(file),
        size: file.size
      }));
      setGalleryImages((prev) => [...prev, ...newItems]);
    }
  };

  // Place an image onto a page
  const placeImageOnPage = (galleryItem, targetPageNum, customX = null, customY = null) => {
    const defaultW = 240;
    const defaultH = 180;
    const posX = customX !== null ? Math.max(10, Math.min(A4_WIDTH - defaultW - 10, customX)) : 80;
    const posY = customY !== null ? Math.max(10, Math.min(A4_HEIGHT - defaultH - 10, customY)) : 100;

    const newPlacedImage = {
      id: `placed_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fileId: galleryItem.filename,
      filename: galleryItem.filename,
      previewUrl: galleryItem.previewUrl,
      x: posX,
      y: posY,
      width: defaultW,
      height: defaultH,
      zIndex: Date.now()
    };

    setPages((prev) =>
      prev.map((page) =>
        page.page_num === targetPageNum
          ? { ...page, images: [...page.images, newPlacedImage] }
          : page
      )
    );

    setSelectedImageId(newPlacedImage.id);
  };

  // Add new A4 Page
  const handleAddNewPage = () => {
    const nextNum = pages.length + 1;
    setPages((prev) => [...prev, { page_num: nextNum, images: [] }]);
    setActivePageNum(nextNum);
  };

  // Remove Page
  const handleDeletePage = (pageNum) => {
    if (pages.length <= 1) return;
    setPages((prev) =>
      prev
        .filter((p) => p.page_num !== pageNum)
        .map((p, idx) => ({ ...p, page_num: idx + 1 }))
    );
    setActivePageNum((prev) => Math.max(1, prev > pageNum ? prev - 1 : prev));
  };

  // Remove image from page
  const handleDeletePlacedImage = (imageId) => {
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        images: page.images.filter((img) => img.id !== imageId)
      }))
    );
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  };

  // Drag and Drop from Gallery onto Page Container
  const handlePageDrop = (e, targetPageNum) => {
    e.preventDefault();
    if (!draggedGalleryItem) return;

    const pageContainer = e.currentTarget;
    const rect = pageContainer.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen coordinates back to PDF points
    const pdfX = screenX / zoomScale;
    const pdfY = screenY / zoomScale;

    placeImageOnPage(draggedGalleryItem, targetPageNum, pdfX - 100, pdfY - 80);
    setDraggedGalleryItem(null);
  };

  // Mouse move handler for moving & scaling images
  const handleMouseMove = (e) => {
    if (!dragState) return;

    const deltaX = (e.clientX - dragState.startMouseX) / zoomScale;
    const deltaY = (e.clientY - dragState.startMouseY) / zoomScale;

    setPages((prev) =>
      prev.map((page) => {
        if (page.page_num !== dragState.pageNum) return page;

        return {
          ...page,
          images: page.images.map((img) => {
            if (img.id !== dragState.imageId) return img;

            if (dragState.mode === 'move') {
              const newX = Math.max(0, Math.min(A4_WIDTH - img.width, dragState.startX + deltaX));
              const newY = Math.max(0, Math.min(A4_HEIGHT - img.height, dragState.startY + deltaY));
              return { ...img, x: Math.round(newX), y: Math.round(newY) };
            }

            if (dragState.mode === 'resize-se') {
              const newW = Math.max(40, Math.min(A4_WIDTH - img.x, dragState.startW + deltaX));
              const newH = Math.max(30, Math.min(A4_HEIGHT - img.y, dragState.startH + deltaY));
              return { ...img, width: Math.round(newW), height: Math.round(newH) };
            }

            if (dragState.mode === 'resize-sw') {
              const newW = Math.max(40, dragState.startW - deltaX);
              const newX = dragState.startX + (dragState.startW - newW);
              const newH = Math.max(30, dragState.startH + deltaY);
              return { ...img, x: Math.round(newX), width: Math.round(newW), height: Math.round(newH) };
            }

            if (dragState.mode === 'resize-ne') {
              const newW = Math.max(40, dragState.startW + deltaX);
              const newH = Math.max(30, dragState.startH - deltaY);
              const newY = dragState.startY + (dragState.startH - newH);
              return { ...img, y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) };
            }

            if (dragState.mode === 'resize-nw') {
              const newW = Math.max(40, dragState.startW - deltaX);
              const newH = Math.max(30, dragState.startH - deltaY);
              const newX = dragState.startX + (dragState.startW - newW);
              const newY = dragState.startY + (dragState.startH - newH);
              return { ...img, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) };
            }

            return img;
          })
        };
      })
    );
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Start moving image
  const startMove = (e, img, pageNum) => {
    e.stopPropagation();
    setSelectedImageId(img.id);
    setDragState({
      imageId: img.id,
      pageNum,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: img.x,
      startY: img.y,
      startW: img.width,
      startH: img.height,
      mode: 'move'
    });
  };

  // Start resizing image
  const startResize = (e, img, pageNum, handleType) => {
    e.stopPropagation();
    setDragState({
      imageId: img.id,
      pageNum,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: img.x,
      startY: img.y,
      startW: img.width,
      startH: img.height,
      mode: `resize-${handleType}`
    });
  };

  // Bring image to front
  const bringToFront = (imgId, pageNum) => {
    setPages((prev) =>
      prev.map((page) => {
        if (page.page_num !== pageNum) return page;
        const highestZ = Math.max(0, ...page.images.map((i) => i.zIndex || 0)) + 1;
        return {
          ...page,
          images: page.images.map((i) => (i.id === imgId ? { ...i, zIndex: highestZ } : i))
        };
      })
    );
  };

  // Export to PDF with coordinate payload
  const handleExportPdf = async () => {
    // Validate that at least one image is placed
    const totalPlaced = pages.reduce((acc, p) => acc + p.images.length, 0);
    if (totalPlaced === 0) {
      setError('Please drag or place at least one image onto a page before creating your PDF.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      // Gather unique files to upload
      const filesToUpload = galleryImages.map((g) => g.file);

      // Construct normalized pages schema
      const pagesPayload = pages.map((p) => ({
        page_num: p.page_num,
        images: p.images.map((img) => ({
          file_id: img.filename,
          filename: img.filename,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height
        }))
      }));

      const doc = await api.convertFreeformPagesToPdf(filesToUpload, pagesPayload);

      if (onPdfGenerated) {
        onPdfGenerated(doc);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to synthesize PDF document.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-sm overflow-hidden"
    >
      <div className="bg-slate-50 w-full h-full flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 z-20">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">
                  Prompt<span className="text-indigo-600">PDFEdit</span> Canvas
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Word-Style Freeform
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Drag, arrange, and scale multiple images freely across visual A4 pages
              </p>
            </div>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex items-center space-x-3">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-slate-100 rounded-xl p-1 text-xs">
              <button
                onClick={() => setZoomScale((s) => Math.max(0.4, s - 0.1))}
                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-medium text-slate-700 min-w-[40px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((s) => Math.min(1.4, s + 0.1))}
                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomScale(0.85)}
                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleAddNewPage}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add A4 Page</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-40"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Freeform PDF...</span>
                </>
              ) : (
                <>
                  <span>Convert to PDF</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close Workspace"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 font-bold ml-2">×</button>
          </div>
        )}

        {/* Main Workspace Stage */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR: Image Assets Gallery */}
          <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Image Gallery ({galleryImages.length})
                </h3>
                <p className="text-[11px] text-slate-400">Drag or click "+" to place onto a page</p>
              </div>

              <label className="cursor-pointer p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition" title="Add More Images">
                <Plus className="w-4 h-4" />
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleAddGalleryFiles}
                />
              </label>
            </div>

            {/* Gallery Image List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {galleryImages.length === 0 ? (
                <div className="py-12 text-center">
                  <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No images uploaded</p>
                  <p className="text-[11px] text-slate-400 mt-1">Upload images to place them</p>
                </div>
              ) : (
                galleryImages.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedGalleryItem(item)}
                    onDragEnd={() => setDraggedGalleryItem(null)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 transition cursor-grab active:cursor-grabbing flex items-center space-x-3 group shadow-xs"
                  >
                    <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 shrink-0">
                      <img src={item.previewUrl} alt={item.filename} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.filename}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(item.size / 1024).toFixed(0)} KB</p>

                      <button
                        type="button"
                        onClick={() => placeImageOnPage(item, activePageNum)}
                        className="mt-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center space-x-0.5 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Place on Page {activePageNum}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar Business Banner */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <div className="p-3 rounded-xl bg-slate-900 text-white text-[11px] space-y-2 shadow-sm">
                <div className="flex items-center space-x-1.5 text-indigo-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Custom Engineering</span>
                </div>
                <p className="text-slate-300 leading-snug">
                  Looking for custom software solutions or sponsorships?
                </p>
                <a
                  href="mailto:karanamvijaykiran@gmail.com?subject=Business%20Inquiry%20-%20PromptPDFEdit"
                  className="block text-center py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition"
                >
                  Work With Me
                </a>
              </div>
            </div>
          </aside>

          {/* RIGHT: Visual Multi-Page Canvas Stage */}
          <main
            onClick={() => setSelectedImageId(null)}
            className="flex-1 overflow-auto p-8 flex flex-col items-center bg-slate-200/70 space-y-12"
          >
            {pages.map((page) => (
              <div key={page.page_num} className="flex flex-col items-center">
                {/* Page Header Bar */}
                <div
                  className="flex items-center justify-between mb-2 px-2"
                  style={{ width: `${A4_WIDTH * zoomScale}px` }}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs font-mono">
                      Page {page.page_num} of {pages.length}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {page.images.length} image{page.images.length === 1 ? '' : 's'} placed
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {pages.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePage(page.page_num);
                        }}
                        className="text-xs p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white transition"
                        title="Delete this page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Visual A4 Page Container (595.28 x 841.89 points) */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handlePageDrop(e, page.page_num)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePageNum(page.page_num);
                  }}
                  className={`relative bg-white shadow-2xl rounded-sm transition border select-none ${
                    activePageNum === page.page_num ? 'ring-2 ring-indigo-500/40 border-slate-300' : 'border-slate-300'
                  }`}
                  style={{
                    width: `${A4_WIDTH * zoomScale}px`,
                    height: `${A4_HEIGHT * zoomScale}px`
                  }}
                >
                  {/* Subtle printable margin guideline */}
                  <div
                    className="absolute pointer-events-none border border-dashed border-slate-200"
                    style={{
                      left: `${20 * zoomScale}px`,
                      top: `${20 * zoomScale}px`,
                      right: `${20 * zoomScale}px`,
                      bottom: `${20 * zoomScale}px`
                    }}
                  />

                  {/* Empty Page Drop Notice */}
                  {page.images.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300">
                      <ImageIcon className="w-10 h-10 mb-2 stroke-[1.5]" />
                      <p className="text-xs font-semibold text-slate-400">Drag images from gallery here</p>
                      <p className="text-[10px] text-slate-400">or click "+" in sidebar</p>
                    </div>
                  )}

                  {/* Render Placed Freeform Images */}
                  {page.images.map((img) => {
                    const isSelected = selectedImageId === img.id;
                    const left = img.x * zoomScale;
                    const top = img.y * zoomScale;
                    const width = img.width * zoomScale;
                    const height = img.height * zoomScale;

                    return (
                      <div
                        key={img.id}
                        onMouseDown={(e) => startMove(e, img, page.page_num)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImageId(img.id);
                        }}
                        className={`absolute group cursor-move select-none ${
                          isSelected ? 'ring-2 ring-indigo-600 z-40' : 'hover:ring-1 hover:ring-indigo-400'
                        }`}
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                          zIndex: isSelected ? 999 : img.zIndex || 1
                        }}
                      >
                        {/* Image Body */}
                        <img
                          src={img.previewUrl}
                          alt={img.filename}
                          className="w-full h-full object-contain pointer-events-none drop-shadow-sm"
                        />

                        {/* Selected Controls Toolbar */}
                        {isSelected && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute -top-9 left-0 flex items-center space-x-1 bg-white border border-slate-200 px-1.5 py-1 rounded-lg shadow-lg z-50 text-[10px]"
                          >
                            <span className="font-mono text-slate-500 font-bold px-1">
                              {Math.round(img.width)}×{Math.round(img.height)}
                            </span>
                            <button
                              onClick={() => bringToFront(img.id, page.page_num)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-600 transition"
                              title="Bring to Front"
                            >
                              <Layers className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeletePlacedImage(img.id)}
                              className="p-1 rounded hover:bg-red-50 text-red-600 transition"
                              title="Remove Image"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Interactive Corner Resize Handles */}
                        {isSelected && (
                          <>
                            <div
                              onMouseDown={(e) => startResize(e, img, page.page_num, 'nw')}
                              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-xs"
                            />
                            <div
                              onMouseDown={(e) => startResize(e, img, page.page_num, 'ne')}
                              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-xs"
                            />
                            <div
                              onMouseDown={(e) => startResize(e, img, page.page_num, 'sw')}
                              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-xs"
                            />
                            <div
                              onMouseDown={(e) => startResize(e, img, page.page_num, 'se')}
                              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-xs"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Add Next Page Button at bottom */}
            <button
              onClick={handleAddNewPage}
              className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Add Another A4 Page</span>
            </button>
          </main>
        </div>
      </div>
    </div>
  );
}
