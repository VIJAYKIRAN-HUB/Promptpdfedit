import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Send,
  FileCheck,
  CheckSquare,
  Square,
  MousePointer,
  Trash2,
  Save,
  Plus,
  Shield,
  ShieldCheck,
  Calendar,
  DollarSign,
  UserCheck,
  SplitSquareVertical,
  RotateCcw,
  Eye,
  Check
} from 'lucide-react';
import PdfViewer from './PdfViewer';
import BusinessBanner from './BusinessBanner';
import api from '../services/api';

export default function Workspace({
  document,
  activeVersion,
  onVersionChange,
  onRefreshDocument,
  compareMode,
  setCompareMode,
  initialPrompt = '',
  initialTab = 'direct'
}) {
  const [activeTab, setActiveTab] = useState(initialTab || (initialPrompt ? 'ai' : 'direct'));
  
  // Direct Click-to-Edit State
  const [pendingDirectEdits, setPendingDirectEdits] = useState({});
  const [isSavingDirect, setIsSavingDirect] = useState(false);

  // AI Prompt State
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [isPlanning, setIsPlanning] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [selectedOps, setSelectedOps] = useState({});
  const [isApplying, setIsApplying] = useState(false);
  const [lastAppliedDiff, setLastAppliedDiff] = useState(null);

  // Manual Find & Replace State
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [targetPage, setTargetPage] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  // Notification State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Sync initialPrompt changes if passed from landing playground
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setActiveTab('ai');
    }
  }, [initialPrompt]);

  // Direct Click Handlers
  const handleSaveDirectEdit = (edit) => {
    setPendingDirectEdits((prev) => ({
      ...prev,
      [edit.id]: edit
    }));
    showToast(`Staged edit for "${edit.original_text}"`);
  };

  const handleDeleteDirectEdit = (del) => {
    setPendingDirectEdits((prev) => ({
      ...prev,
      [del.id]: del
    }));
    showToast(`Staged removal for "${del.original_text}"`);
  };

  const handleAddDirectText = (add) => {
    setPendingDirectEdits((prev) => ({
      ...prev,
      [add.id]: add
    }));
    showToast(`Staged new text: "${add.text}"`);
  };

  const removePendingEdit = (id) => {
    setPendingDirectEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleApplyDirectEdits = async () => {
    const ops = Object.values(pendingDirectEdits);
    if (ops.length === 0 || !document) return;

    setIsSavingDirect(true);
    try {
      const res = await api.applyEditPlan(document.id, ops, `Direct Canvas Edits (${ops.length})`);
      showToast(`Applied ${res.total_replaced} direct edit(s) into Version ${res.new_version}!`);
      setLastAppliedDiff(ops);
      setPendingDirectEdits({});
      await onRefreshDocument();
      onVersionChange(res.new_version);
      setCompareMode(true);
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Failed to save direct edits.', 'error');
    } finally {
      setIsSavingDirect(false);
    }
  };

  // Click-to-Try Categorized Suggestion Chips
  const promptSuggestionChips = [
    {
      label: 'Change invoice total to $450',
      prompt: 'Change invoice total to $450',
      icon: DollarSign,
      category: 'Finance'
    },
    {
      label: 'Redact all phone numbers',
      prompt: 'Redact all phone numbers',
      icon: Shield,
      category: 'Privacy'
    },
    {
      label: 'Update date to October 2026',
      prompt: 'Change date to "October 11, 2026"',
      icon: Calendar,
      category: 'Dates'
    },
    {
      label: 'Replace John Doe with David Vance',
      prompt: 'Replace "John Doe" with "David Vance"',
      icon: UserCheck,
      category: 'Names'
    },
    {
      label: 'Update statement balance to $2,850.00',
      prompt: 'Update statement balance to "$2,850.00"',
      icon: DollarSign,
      category: 'Finance'
    },
    {
      label: 'Auto-redact PII (Names, SSN, Emails)',
      prompt: 'Auto-redact all PII: phone numbers, Social Security Numbers, emails, and confidential IDs',
      icon: ShieldCheck,
      category: 'Privacy'
    }
  ];

  // 1. Generate Edit Plan
  const handleGeneratePlan = async (customPrompt = null) => {
    const textToRun = (customPrompt || prompt).trim();
    if (!textToRun || !document) return;

    setIsPlanning(true);
    setEditPlan(null);
    try {
      const plan = await api.createEditPlan(document.id, textToRun);
      setEditPlan(plan);
      const initialSelection = {};
      plan.operations.forEach((op, idx) => {
        initialSelection[idx] = op.approved !== false;
      });
      setSelectedOps(initialSelection);
      if (plan.operations.length === 0) {
        showToast('No direct matches found. You can use Direct Click-to-Edit to modify any text.', 'info');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Could not understand edit instructions.', 'error');
    } finally {
      setIsPlanning(false);
    }
  };

  // 1-Click Smart Privacy Mode: Auto-Redact PII
  const handleTriggerPrivacyMode = async () => {
    const piiPrompt = 'Auto-redact all PII: phone numbers, Social Security Numbers, emails, and confidential IDs';
    setPrompt(piiPrompt);
    await handleGeneratePlan(piiPrompt);
  };

  // 2. Apply Approved Changes
  const handleApplyPlan = async () => {
    if (!editPlan || !document) return;

    const approvedOperations = editPlan.operations.filter((_, idx) => selectedOps[idx]);
    if (approvedOperations.length === 0) {
      showToast('Please check at least one change to apply.', 'error');
      return;
    }

    setIsApplying(true);
    try {
      const res = await api.applyEditPlan(document.id, approvedOperations, prompt);
      showToast(`Updated document to Version ${res.new_version}!`);
      setLastAppliedDiff(approvedOperations);
      setEditPlan(null);
      setPrompt('');
      await onRefreshDocument();
      onVersionChange(res.new_version);
      setCompareMode(true);
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Failed to update document.', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  // 3. Manual Exact Replace
  const handleManualReplace = async () => {
    if (!findText.trim() || !document) return;

    setIsReplacing(true);
    try {
      const pageNum = targetPage ? parseInt(targetPage, 10) : null;
      const singleOp = [{
        action: 'replace_text',
        find: findText,
        replace_with: replaceText,
        page: pageNum,
        case_sensitive: caseSensitive,
      }];

      const res = await api.applyEditPlan(document.id, singleOp, `Manual: ${findText} -> ${replaceText}`);
      showToast(`Replaced "${findText}" with "${replaceText}"!`);
      setLastAppliedDiff(singleOp);
      setFindText('');
      setReplaceText('');
      await onRefreshDocument();
      onVersionChange(res.new_version);
      setCompareMode(true);
    } catch (err) {
      showToast(err.response?.data?.detail || err.message || 'Replacement failed.', 'error');
    } finally {
      setIsReplacing(false);
    }
  };

  // Revert back to previous version
  const handleRevertVersion = async () => {
    if (activeVersion <= 1) return;
    const prevVersion = activeVersion - 1;
    onVersionChange(prevVersion);
    showToast(`Reverted back to Version ${prevVersion}`);
  };

  const toggleOpSelection = (idx) => {
    setSelectedOps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const pendingDirectCount = Object.keys(pendingDirectEdits).length;

  // Construct PDF URLs
  const activeDocUrl = document?.id ? api.getDocumentFileUrl(document.id, activeVersion) : null;
  const originalDocUrl = document?.id ? api.getDocumentFileUrl(document.id, 1) : null;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-80px)]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-semibold border ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT COLUMN: Controls Sidebar */}
      <aside className="lg:col-span-5 flex flex-col space-y-4">
        {/* Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl flex items-center justify-between border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer relative ${
              activeTab === 'direct'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Direct</span>
            {pendingDirectCount > 0 && (
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ml-1 font-bold ${
                activeTab === 'direct' ? 'bg-white text-indigo-600' : 'bg-emerald-600 text-white'
              }`}>
                {pendingDirectCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Prompt</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find & Replace</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>v{document?.versions?.length || 1}</span>
          </button>
        </div>

        {/* VISUAL DIFF & CHANGE TRACKING BANNER (when compare mode is ON) */}
        {compareMode && (
          <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <SplitSquareVertical className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">
                  Visual Side-by-Side Diff Review
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                v1 vs v{activeVersion}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Verify your edits with side-by-side comparison. Left shows the original document; right shows verified AI modifications.
            </p>

            {/* Change pills diff summary */}
            {lastAppliedDiff && lastAppliedDiff.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Modifications Applied:
                </span>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {lastAppliedDiff.map((d, i) => (
                    <div key={i} className="text-[11px] p-2 rounded-lg bg-white/90 border border-slate-200/80 flex items-center justify-between">
                      <div className="truncate mr-2">
                        <span className="line-through text-red-600 font-mono font-medium mr-1.5">
                          "{d.original_text || d.find || 'Original'}"
                        </span>
                        <span className="text-emerald-700 font-mono font-bold">
                          &rarr; "{d.new_text || d.replace_with || '[Redacted]'}"
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        Page {d.page || 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => setCompareMode(false)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve & Keep Changes</span>
              </button>

              {activeVersion > 1 && (
                <button
                  onClick={handleRevertVersion}
                  className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                  title="Revert back to prior version"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Revert</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 0: Direct Click-to-Edit Manager */}
        {activeTab === 'direct' && (
          <div className="bg-white p-6 rounded-2xl flex-1 flex flex-col space-y-5 border border-slate-200 shadow-xs">
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                Direct Click-to-Edit (WYSIWYG)
              </span>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Click on any text on the right-hand PDF canvas to type changes directly. Click any empty spot to place new text.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
              <span className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                <MousePointer className="w-3.5 h-3.5 text-indigo-600" />
                <span>How it works:</span>
              </span>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                <li><strong>Click any text:</strong> Turns into an editable box with matching font size and color.</li>
                <li><strong>Delete button:</strong> Redacts the old text completely.</li>
                <li><strong>Click empty space:</strong> Types brand new text.</li>
              </ul>
            </div>

            {/* Staged Edits List */}
            <div className="flex-1 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Staged Edits ({pendingDirectCount})
                </span>
                {pendingDirectCount > 0 && (
                  <button
                    onClick={() => setPendingDirectEdits({})}
                    className="text-[11px] text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {pendingDirectCount === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <MousePointer className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">No edits staged yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click any text on the document to start editing</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {Object.values(pendingDirectEdits).map((op) => (
                    <div
                      key={op.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        {op.action === 'exact_replace' && (
                          <div>
                            <span className="text-red-500 line-through mr-1 font-mono">{op.original_text}</span>
                            <span className="text-emerald-700 font-bold font-mono">&rarr; {op.new_text}</span>
                          </div>
                        )}
                        {op.action === 'delete_text' && (
                          <div className="text-red-600 font-semibold">
                            Deleted: <span className="line-through font-mono">"{op.original_text}"</span>
                          </div>
                        )}
                        {op.action === 'add_text' && (
                          <div className="text-indigo-600 font-semibold">
                            Added: <span className="font-mono">"{op.text}"</span>
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 block font-mono">Page {op.page || 1}</span>
                      </div>

                      <button
                        onClick={() => removePendingEdit(op.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title="Remove this edit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingDirectCount > 0 && (
                <button
                  onClick={handleApplyDirectEdits}
                  disabled={isSavingDirect}
                  className="w-full py-2.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isSavingDirect ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing to PDF...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes to PDF ({pendingDirectCount})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: AI Prompt Controls */}
        {activeTab === 'ai' && (
          <div className="bg-white p-6 rounded-2xl flex-1 flex flex-col space-y-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  What would you like to change?
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Type instructions in plain English. Powered by Google Gemini.
                </p>
              </div>
            </div>

            {/* 1-CLICK PRIVACY MODE / AUTO-REDACT PII FEATURE */}
            <button
              type="button"
              onClick={handleTriggerPrivacyMode}
              disabled={isPlanning}
              className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between transition cursor-pointer group shadow-xs"
            >
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Smart Privacy Mode: Auto-Redact PII (Names, SSN, Emails)</span>
              </div>
              <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                1-Click
              </span>
            </button>

            {/* Prompt Textarea */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g., "Change the agreement date to October 10, 2026" or "Replace John Doe with David Vance"'
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none font-sans"
              />
              <button
                onClick={() => handleGeneratePlan()}
                disabled={!prompt.trim() || isPlanning}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                {isPlanning ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Review Edit</span>
                  </>
                )}
              </button>
            </div>

            {/* PROMPT SUGGESTION CHIPS ("CLICK TO TRY") */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-600 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Prompt Suggestion Chips (Click to Try):</span>
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {promptSuggestionChips.map((chip, idx) => {
                  const Icon = chip.icon;
                  const isSelected = prompt === chip.prompt;
                  return (
                    <button
                      key={idx}
                      onClick={() => setPrompt(chip.prompt)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left flex items-center space-x-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                      title={chip.prompt}
                    >
                      <Icon className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
                      <span className="truncate max-w-[200px]">{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PROPOSED CHANGES CHECKLIST */}
            {isPlanning && (
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center space-x-3 text-xs text-indigo-700">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Reading document with Gemini and drafting changes...</span>
              </div>
            )}

            {editPlan && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Proposed Changes ({editPlan.operations.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Review before applying
                  </span>
                </div>

                {editPlan.operations.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No matching text could be found. You can click directly on the text on the right to edit it!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {editPlan.operations.map((op, idx) => {
                      const isChecked = !!selectedOps[idx];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleOpSelection(idx)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
                            isChecked
                              ? 'bg-white border-indigo-200 shadow-2xs'
                              : 'bg-slate-100 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">
                                {op.action === 'redact_text' ? 'Redact' : 'Change'}:{' '}
                                <span className="text-red-600 line-through">"{op.find}"</span>
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {op.page ? `Page ${op.page}` : 'All Pages'}
                              </span>
                            </div>
                            {op.action === 'replace_text' && (
                              <div className="text-emerald-700 font-medium">
                                &rarr; "{op.replace_with}"
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500">
                              Found <strong className="text-slate-800">{op.matches_found}</strong> occurrence(s) in document
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={handleApplyPlan}
                  disabled={isApplying || editPlan.operations.length === 0}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isApplying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating PDF...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Apply Changes & Review Diff</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Manual Find & Replace Form */}
        {activeTab === 'manual' && (
          <div className="bg-white p-6 rounded-2xl flex-1 flex flex-col space-y-4 border border-slate-200 shadow-xs">
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                Find & Replace
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Replace exact words or numbers without altering font or spacing.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Text to Find
                </label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="e.g. 8.45 or John Doe"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Replace With
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="e.g. 10.00 or David Vance"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Page (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={document?.page_count || 100}
                    value={targetPage}
                    onChange={(e) => setTargetPage(e.target.value)}
                    placeholder="All Pages"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseSensitive}
                      onChange={(e) => setCaseSensitive(e.target.checked)}
                      className="rounded accent-indigo-600 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-slate-600">Case Sensitive</span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleManualReplace}
                disabled={!findText.trim() || isReplacing}
                className="w-full py-2.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isReplacing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Replacing Text...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Replace Text & Review Diff</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Version History */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl flex-1 flex flex-col space-y-4 border border-slate-200 shadow-xs">
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                Version History
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Every edit creates a new version. Jump back to any state at any time.
              </p>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[60vh] pr-1">
              {document?.versions?.map((ver) => {
                const isSelected = activeVersion === ver.version_number;
                return (
                  <div
                    key={ver.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700 shadow-2xs">
                          v{ver.version_number}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {ver.version_number === 1 ? 'Original Upload' : 'Edited Version'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {ver.created_at ? new Date(ver.created_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>

                    <button
                      onClick={() => onVersionChange(ver.version_number)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isSelected ? 'Viewing' : 'View'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dedicated Business Inquiry Banner in Sidebar */}
        <BusinessBanner className="mt-4" />
      </aside>

      {/* RIGHT COLUMN: PDF Viewer Area */}
      <main className="lg:col-span-7 flex flex-col h-[750px] lg:h-auto">
        <PdfViewer
          documentId={document?.id}
          docUrl={activeDocUrl}
          originalUrl={originalDocUrl}
          pageCount={document?.page_count || 1}
          compareMode={compareMode}
          activeVersion={activeVersion}
          onToggleCompare={() => setCompareMode(!compareMode)}
          isProcessing={isApplying || isReplacing || isSavingDirect}
          pendingEdits={pendingDirectEdits}
          onSaveDirectEdit={handleSaveDirectEdit}
          onDeleteDirectEdit={handleDeleteDirectEdit}
          onAddDirectText={handleAddDirectText}
          onApplyDirectEdits={handleApplyDirectEdits}
        />
      </main>
    </div>
  );
}
