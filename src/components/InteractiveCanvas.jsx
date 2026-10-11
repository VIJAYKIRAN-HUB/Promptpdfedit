import React, { useState, useRef, useEffect } from 'react';
import { Check, Trash2, Plus, X, Type, Edit3, Sparkles } from 'lucide-react';

export default function InteractiveCanvas({
  elements = [],
  pageSize = { width: 595.28, height: 841.89 },
  canvasWidth,
  canvasHeight,
  pageNumber = 1,
  pendingEdits = {},
  onSaveEdit,
  onDeleteElement,
  onAddText,
  isDirectEditEnabled = true,
  isAddTextToolActive = false
}) {
  const [activeElementId, setActiveElementId] = useState(null);
  const [editText, setEditText] = useState('');
  const [newTextPosition, setNewTextPosition] = useState(null);
  const [newTextValue, setNewTextValue] = useState('');
  
  const inputRef = useRef(null);
  const newTextInputRef = useRef(null);
  const containerRef = useRef(null);

  // Compute scale factors between PDF points and rendered canvas pixels
  const scaleX = pageSize.width > 0 && canvasWidth > 0 ? canvasWidth / pageSize.width : 1;
  const scaleY = pageSize.height > 0 && canvasHeight > 0 ? canvasHeight / pageSize.height : 1;

  // Auto focus input when active element changes
  useEffect(() => {
    if (activeElementId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [activeElementId]);

  useEffect(() => {
    if (newTextPosition && newTextInputRef.current) {
      newTextInputRef.current.focus();
    }
  }, [newTextPosition]);

  if (!canvasWidth || !canvasHeight || !isDirectEditEnabled) {
    return null;
  }

  // Handle clicking an existing text element to edit
  const handleElementClick = (e, el) => {
    e.stopPropagation();
    setActiveElementId(el.id);
    const existingEdit = pendingEdits[el.id];
    setEditText(existingEdit ? existingEdit.new_text : el.text);
    setNewTextPosition(null);
  };

  // Commit text edit
  const handleCommitEdit = (el) => {
    if (editText !== el.text) {
      onSaveEdit({
        action: 'exact_replace',
        id: el.id,
        page: pageNumber,
        bbox: el.bbox,
        original_text: el.text,
        new_text: editText,
        font: el.font,
        size: el.size,
        color: el.color_hex || '#000000'
      });
    }
    setActiveElementId(null);
  };

  // Delete / Redact text element
  const handleDelete = (el) => {
    onDeleteElement({
      action: 'delete_text',
      id: el.id,
      page: pageNumber,
      bbox: el.bbox,
      original_text: el.text
    });
    setActiveElementId(null);
  };

  // Cancel inline editing
  const handleCancel = () => {
    setActiveElementId(null);
    setNewTextPosition(null);
  };

  // Handle clicking empty canvas space to add new text
  const handleCanvasClick = (e) => {
    if (!containerRef.current) return;
    if (activeElementId) {
      setActiveElementId(null);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert screen coordinates back to PDF points
    const pdfX = clickX / scaleX;
    const pdfY = clickY / scaleY;

    setNewTextPosition({ screenX: clickX, screenY: clickY, pdfX, pdfY });
    setNewTextValue('');
  };

  // Commit brand new text addition
  const handleCommitNewText = () => {
    if (newTextValue.trim() && newTextPosition) {
      onAddText({
        action: 'add_text',
        id: `add_${Date.now()}`,
        page: pageNumber,
        x: newTextPosition.pdfX,
        y: newTextPosition.pdfY,
        text: newTextValue.trim(),
        font: 'helv',
        size: 11,
        color: '#000000'
      });
    }
    setNewTextPosition(null);
    setNewTextValue('');
  };

  // Helper font styling
  const getElementFontStyle = (fontName) => {
    const lower = (fontName || '').toLowerCase();
    let family = 'Inter, sans-serif';
    if (lower.includes('times') || lower.includes('serif') || lower.includes('roman')) {
      family = 'Georgia, serif';
    } else if (lower.includes('courier') || lower.includes('mono')) {
      family = 'monospace';
    }
    return {
      fontFamily: family,
      fontWeight: lower.includes('bold') ? 700 : 400,
      fontStyle: lower.includes('italic') ? 'italic' : 'normal',
    };
  };

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className={`absolute inset-0 z-20 overflow-hidden ${
        isAddTextToolActive ? 'cursor-crosshair' : 'cursor-default'
      }`}
      style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
    >
      {/* 1. Existing Text Elements Overlays */}
      {elements.map((el) => {
        const [x0, y0, x1, y1] = el.bbox;
        const left = x0 * scaleX;
        const top = y0 * scaleY;
        const width = Math.max(8, (x1 - x0) * scaleX);
        const height = Math.max(10, (y1 - y0) * scaleY);
        const fontSize = Math.max(8, el.size * scaleY);
        const fontStyle = getElementFontStyle(el.font);

        const isEditing = activeElementId === el.id;
        const editInfo = pendingEdits[el.id];
        const isModified = Boolean(editInfo);
        const isDeleted = editInfo?.action === 'delete_text';

        if (isEditing) {
          // Render active input with floating action toolbar
          return (
            <div
              key={el.id}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-30"
              style={{
                left: `${left}px`,
                top: `${top - 4}px`,
                minWidth: `${Math.max(width + 20, 100)}px`,
              }}
            >
              {/* Floating Mini Toolbar */}
              <div className="absolute -top-9 left-0 flex items-center space-x-1 bg-white border border-slate-200 px-1.5 py-1 rounded-lg shadow-lg z-40 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => handleCommitEdit(el)}
                  className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs"
                  title="Save Edit (Enter)"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(el)}
                  className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition"
                  title="Delete Text"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                  title="Cancel (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Seamless Inline Input */}
              <input
                ref={inputRef}
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitEdit(el);
                  if (e.key === 'Escape') handleCancel();
                }}
                className="w-full bg-white text-slate-900 border-2 border-indigo-600 rounded px-1.5 py-0.5 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: fontStyle.fontFamily,
                  fontWeight: fontStyle.fontWeight,
                  fontStyle: fontStyle.fontStyle,
                  color: el.color_hex || '#000000',
                  height: `${height + 8}px`,
                }}
              />
            </div>
          );
        }

        // Render Clickable Bounding Box
        return (
          <div
            key={el.id}
            onClick={(e) => handleElementClick(e, el)}
            title={`Click to edit: "${el.text}" (${el.font}, ${el.size}pt)`}
            className={`absolute group cursor-text transition-all ${
              isDeleted
                ? 'bg-red-500/20 border border-red-500 line-through text-transparent'
                : isModified
                ? 'bg-emerald-500/20 border-2 border-emerald-500 shadow-2xs'
                : 'hover:bg-indigo-500/15 hover:border hover:border-indigo-500/70'
            }`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            {/* If modified, show the new text preview overlay */}
            {isModified && !isDeleted && (
              <span
                className="absolute inset-0 bg-white font-medium text-emerald-800 whitespace-nowrap overflow-visible flex items-center px-0.5 shadow-2xs rounded-xs"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: fontStyle.fontFamily,
                  fontWeight: fontStyle.fontWeight,
                  fontStyle: fontStyle.fontStyle,
                }}
              >
                {editInfo.new_text}
              </span>
            )}

            {/* Quick edit pen indicator on hover */}
            <span className="hidden group-hover:flex absolute -top-5 right-0 bg-indigo-600 text-white rounded px-1 text-[9px] font-semibold items-center space-x-0.5 pointer-events-none shadow-xs">
              <Edit3 className="w-2.5 h-2.5" />
              <span>Edit</span>
            </span>
          </div>
        );
      })}

      {/* 2. New Text Spawn Input (Click-to-Add) */}
      {newTextPosition && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30"
          style={{
            left: `${newTextPosition.screenX}px`,
            top: `${newTextPosition.screenY}px`,
          }}
        >
          {/* Floating Toolbar */}
          <div className="absolute -top-8 left-0 flex items-center space-x-1 bg-white border border-slate-200 px-1.5 py-1 rounded-lg shadow-lg z-40">
            <button
              type="button"
              onClick={handleCommitNewText}
              className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs"
              title="Add Text Here"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => setNewTextPosition(null)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            ref={newTextInputRef}
            type="text"
            placeholder="Type text here..."
            value={newTextValue}
            onChange={(e) => setNewTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitNewText();
              if (e.key === 'Escape') setNewTextPosition(null);
            }}
            className="bg-white text-slate-900 border-2 border-indigo-600 rounded px-2 py-1 text-sm shadow-md focus:outline-none min-w-[160px]"
          />
        </div>
      )}
    </div>
  );
}
