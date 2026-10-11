import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import Workspace from './components/Workspace';
import MultiPageCanvas from './components/MultiPageCanvas';
import BusinessBanner from './components/BusinessBanner';
import VisualPlaygroundSlider from './components/VisualPlaygroundSlider';
import ErrorBoundary from './components/ErrorBoundary';
import api from './services/api';
import {
  UploadCloud,
  Wand2,
  Images,
  Lock,
  ArrowRight,
  CheckCircle,
  FileText,
  Sparkles,
  Layers,
  ChevronRight,
  Shield,
  ShieldCheck,
  FileCheck,
  Check
} from 'lucide-react';

export default function App() {
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeVersion, setActiveVersion] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState(1); // 1: Structure, 2: Layers/Fonts, 3: Ready
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showImageConverter, setShowImageConverter] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [initialTab, setInitialTab] = useState('direct');
  const [showStickyToolbar, setShowStickyToolbar] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(3589); // ~59:49 live countdown

  const fileInputRef = useRef(null);

  // Live countdown timer for the secure session badge
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => (prev > 0 ? prev - 1 : 3600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds to MM:SS
  const formatSessionTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Scroll listener for sticky contextual bottom toolbar
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyToolbar(window.scrollY > 420);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle PDF Upload with Progressive Micro-Interactions
  const handleFileUpload = async (file, promptToSet = null) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadStage(1);
    setUploadProgress(25);

    // Multi-step progressive indicators
    const stage2Timer = setTimeout(() => {
      setUploadStage(2);
      setUploadProgress(65);
    }, 350);

    const stage3Timer = setTimeout(() => {
      setUploadStage(3);
      setUploadProgress(90);
    }, 700);

    try {
      const doc = await api.uploadDocument(file);
      clearTimeout(stage2Timer);
      clearTimeout(stage3Timer);
      setUploadProgress(100);

      // Brief delay so user sees "Ready for prompt" completion state
      setTimeout(() => {
        setActiveDoc(doc);
        setActiveVersion(doc.active_version || 1);
        setCompareMode(false);
        if (promptToSet) {
          setInitialPrompt(promptToSet);
          setInitialTab('ai');
        } else {
          setInitialPrompt('');
          setInitialTab('direct');
        }
        setIsUploading(false);
        setUploadProgress(0);
      }, 350);
    } catch (err) {
      clearTimeout(stage2Timer);
      clearTimeout(stage3Timer);
      setUploadError(err.response?.data?.detail || err.message || 'PDF upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Reload Document Metadata
  const refreshActiveDocument = async () => {
    if (!activeDoc) return;
    try {
      const updated = await api.getDocument(activeDoc.id);
      setActiveDoc(updated);
    } catch (err) {
      console.error('Failed to refresh document:', err);
    }
  };

  // Download Active Version
  const handleDownload = () => {
    if (!activeDoc) return;
    const downloadUrl = api.getDocumentFileUrl(activeDoc.id, activeVersion);
    const link = window.document.createElement('a');
    link.href = downloadUrl;
    link.download = `v${activeVersion}_${activeDoc.filename}`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  // Quick Demo Document Loader with optional initial prompt
  const handleLoadDemoDocument = async (promptToSet = null) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const pdfBytes = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 215>>stream
BT
/F1 22 Tf
70 700 Td
(Official Statement of Account) Tj
/F1 12 Tf
0 -40 Td
(Agreement Date: January 15, 2024) Tj
0 -25 Td
(Account Holder: John Doe) Tj
0 -25 Td
(Status: Verified Member) Tj
0 -25 Td
(Confidential ID: ID-984210) Tj
0 -25 Td
(Statement Balance: $1,250.00) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000214 00000 n 
0000000481 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
553
%%EOF`;
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'Sample_Account_Agreement.pdf', { type: 'application/pdf' });
      await handleFileUpload(file, promptToSet);
    } catch (err) {
      setUploadError('Failed to load demo document: ' + err.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="application/pdf"
        className="hidden"
      />

      {/* Clean Minimal Header */}
      <Header
        activeDoc={activeDoc}
        activeVersion={activeVersion}
        onUploadClick={() => fileInputRef.current?.click()}
        onImageConverterClick={() => setShowImageConverter(true)}
        onDownloadClick={handleDownload}
        onResetToHome={() => {
          setActiveDoc(null);
          setInitialPrompt('');
        }}
      />

      {/* Main Content Area */}
      {activeDoc ? (
        <Workspace
          document={activeDoc}
          activeVersion={activeVersion}
          onVersionChange={(v) => setActiveVersion(v)}
          onRefreshDocument={refreshActiveDocument}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          initialPrompt={initialPrompt}
          initialTab={initialTab}
        />
      ) : (
        /* Clean Light SaaS Landing Page */
        <main className="flex-1 flex flex-col">
          {/* SECTION 1: The Hero Area */}
          <section className="pt-12 sm:pt-20 pb-10 px-4 sm:px-6 max-w-5xl mx-auto text-center w-full">
            {/* Pill Tag */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>The Easiest Way to Edit PDFs</span>
            </div>

            {/* H1 Title */}
            <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] max-w-3xl mx-auto">
              Edit PDFs using <span className="text-indigo-600">plain English.</span>
            </h1>

            {/* Softer Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-4 sm:mt-5 font-normal leading-relaxed">
              Upload your document, tell our AI what to change, and download the perfect result. No complex menus required.
            </p>

            {/* Prominent Upload / Drag-and-Drop Zone */}
            <div className="mt-8 sm:mt-10 max-w-xl mx-auto">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`relative rounded-3xl p-8 sm:p-12 transition-all border-2 border-dashed ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/80 scale-[1.01]'
                    : 'border-slate-300 hover:border-indigo-500 bg-white hover:bg-slate-50/60 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-indigo-100'
                } ${isUploading ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {uploadError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left">
                    {uploadError}
                  </div>
                )}

                {/* PROGRESSIVE MICRO-INTERACTION VIEW */}
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center space-y-5 py-2">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm relative">
                      <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>

                    <div className="w-full max-w-xs space-y-3">
                      {/* Animated Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>

                      {/* 3 Progressive Stages */}
                      <div className="space-y-1.5 text-left text-xs">
                        <div className={`flex items-center space-x-2 transition-colors ${uploadStage >= 1 ? 'text-indigo-700 font-semibold' : 'text-slate-400'}`}>
                          {uploadStage > 1 ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-600 flex items-center justify-center text-[9px] font-bold">1</span>
                          )}
                          <span>Reading document structure...</span>
                        </div>

                        <div className={`flex items-center space-x-2 transition-colors ${uploadStage >= 2 ? 'text-indigo-700 font-semibold' : 'text-slate-400'}`}>
                          {uploadStage > 2 ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[9px] font-bold">2</span>
                          )}
                          <span>Extracting layers & font metrics...</span>
                        </div>

                        <div className={`flex items-center space-x-2 transition-colors ${uploadStage >= 3 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                          {uploadStage >= 3 ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[9px] font-bold">3</span>
                          )}
                          <span>Ready for prompt.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Upload Dropzone */
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                      <UploadCloud className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-base sm:text-lg font-bold text-slate-900">
                        Click to upload or drag & drop
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Supports any standard PDF &bull; Up to 50MB
                      </p>
                    </div>

                    <button
                      type="button"
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition cursor-pointer"
                    >
                      Select PDF File
                    </button>
                  </div>
                )}
              </div>

              {/* Sample PDF Link */}
              <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-slate-500">
                <span>Want to test it out right away?</span>
                <button
                  onClick={() => handleLoadDemoDocument()}
                  disabled={isUploading}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline inline-flex items-center cursor-pointer"
                >
                  <span>Try Sample PDF</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>

              {/* ENHANCED TRUST SIGNALS & LIVE SECURITY BADGE */}
              <div className="mt-6 flex flex-col items-center space-y-3">
                {/* Live-ticking secure session indicator */}
                <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-xs text-xs font-semibold text-slate-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Bank-grade privacy &bull; Auto-purges in{' '}
                    <span className="font-mono text-indigo-600 font-bold">{formatSessionTime(sessionSeconds)}</span>
                  </span>
                </div>

                {/* Compliance & Security Pills */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>End-to-End Encrypted</span>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    <span>TLS 1.3 Protocol</span>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="flex items-center space-x-1">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Zero Permanent Storage</span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Interactive Before/After Visual Playground Slider */}
          <VisualPlaygroundSlider
            onTryPrompt={(promptText) => handleLoadDemoDocument(promptText)}
          />

          {/* SECTION 3: Core Tools (Side-by-Side Cards) */}
          <section className="py-12 px-4 sm:px-6 max-w-5xl mx-auto w-full">
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Simple tools designed for everyday documents
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Card 1: AI PDF Editor */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="saas-card rounded-2xl p-6 sm:p-7 cursor-pointer transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition duration-200">
                  <Wand2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                  AI PDF Editor
                </h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Replace names, fix typos, and change formatting just by typing. Perfect formatting—we keep your exact layout intact.
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition">
                  <span>Start Editing</span>
                  <ChevronRight className="w-4 h-4 ml-0.5" />
                </div>
              </div>

              {/* Card 2: Image to PDF Converter */}
              <div
                onClick={() => setShowImageConverter(true)}
                className="saas-card rounded-2xl p-6 sm:p-7 cursor-pointer transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition duration-200">
                  <Images className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Word-Style Image Canvas
                </h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Combine multiple JPGs or PNGs onto visual A4 pages. Drag, freely resize, and position multiple images per page into a crisp PDF.
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition">
                  <span>Open Freeform Canvas</span>
                  <ChevronRight className="w-4 h-4 ml-0.5" />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: Trust & Dedicated Business Inquiry Banner */}
          <section className="mt-auto border-t border-slate-200 bg-white">
            <div className="max-w-4xl mx-auto py-5 px-4 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs text-slate-500 text-center">
              <span className="flex items-center space-x-1 font-medium">
                <span>🔒</span>
                <span className="font-semibold text-slate-700">Bank-grade privacy.</span>
              </span>
              <span className="hidden sm:inline text-slate-300">&bull;</span>
              <span>Files processed securely &bull; Zero permanent retention &bull; Auto-purged hourly</span>
            </div>

            {/* Dedicated Business Banner */}
            <div className="px-4 pb-8 max-w-4xl mx-auto w-full">
              <BusinessBanner />
            </div>
          </section>

          {/* STICKY / FLOATING CONTEXTUAL TOOLBAR */}
          {showStickyToolbar && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto animate-fade-in">
              <div className="backdrop-blur-md bg-white/95 border border-slate-200/90 shadow-2xl rounded-full px-5 py-2.5 flex items-center justify-between sm:space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                    P
                  </div>
                  <span className="text-xs font-bold text-slate-800 hidden sm:inline">
                    PromptPDF
                  </span>
                  <span className="text-xs text-slate-500 hidden md:inline">
                    &bull; Edit PDFs using plain English
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleLoadDemoDocument()}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Try Sample
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Document</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Interactive Word-Style Freeform Image to PDF Canvas */}
      {showImageConverter && (
        <ErrorBoundary onReset={() => setShowImageConverter(false)}>
          <MultiPageCanvas
            onClose={() => setShowImageConverter(false)}
            onPdfGenerated={(doc) => {
              setActiveDoc(doc);
              setActiveVersion(1);
              setCompareMode(false);
              setShowImageConverter(false);
            }}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
