import React, { useState } from 'react';
import { Briefcase, Mail, ArrowRight, ExternalLink, Copy, Check, X } from 'lucide-react';

const EMAIL_ADDRESS = "karanamvijaykiran@gmail.com";
const SUBJECT_LINE = "Business Inquiry - PromptPDFEdit";
const EMAIL_BODY = "Hi Vijaykiran,\n\nI am reaching out regarding...";

const GMAIL_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
  EMAIL_ADDRESS
)}&su=${encodeURIComponent(SUBJECT_LINE)}&body=${encodeURIComponent(EMAIL_BODY)}`;

const MAILTO_URL = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(
  SUBJECT_LINE
)}&body=${encodeURIComponent(EMAIL_BODY)}`;

/**
 * ContactModal Component
 * Interactive dialog offering Gmail Web, native mailto, and 1-click clipboard copying.
 */
export function ContactModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(EMAIL_ADDRESS);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleGmailClick = (e) => {
    e.stopPropagation();
    window.open(GMAIL_COMPOSE_URL, '_blank');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 md:p-7 w-full max-w-md text-white relative transition-all duration-200"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Start a Conversation</h3>
            <p className="text-xs text-slate-400">Choose how you'd like to connect</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
          Open to client projects, sponsorships, and custom AI software solutions.
        </p>

        {/* 3 Interactive Cards */}
        <div className="space-y-3 mt-5">
          {/* Card 1: Gmail Web */}
          <button
            type="button"
            onClick={handleGmailClick}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 group cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <ExternalLink className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="block font-bold">Open in Gmail (Web)</span>
                <span className="text-xs text-indigo-100 font-normal">Opens composer directly in a new tab</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200 text-white/90" />
          </button>

          {/* Card 2: Default Mail App */}
          <a
            href={MAILTO_URL}
            onClick={onClose}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-white font-semibold text-sm transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-slate-700/60 flex items-center justify-center text-indigo-400 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-bold text-slate-100">Default Mail App</span>
                <span className="text-xs text-slate-400 font-normal">Outlook, Apple Mail, or Windows Mail</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform duration-200" />
          </a>

          {/* Card 3: Copy Email */}
          <div
            onClick={handleCopy}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700/80 text-white transition-all duration-200 cursor-pointer group select-none"
          >
            <div className="flex items-center space-x-3 truncate mr-3">
              <div className="w-9 h-9 rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400 transition-transform duration-200 scale-110" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors duration-200" />
                )}
              </div>
              <div className="truncate">
                <span className="block font-bold text-slate-100 text-sm truncate">{EMAIL_ADDRESS}</span>
                <span className="text-xs text-slate-400 font-normal">
                  {copied ? 'Copied to clipboard!' : 'Click to copy email address'}
                </span>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                  : 'bg-slate-700/70 text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Direct inquiries are monitored 7 days a week &bull; Response within 24h
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact, sleek BusinessBanner Component
 * Low vertical profile, perfectly aligned with feature cards grid (max-w-4xl).
 */
export default function BusinessBanner({ className = '' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        className={`rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 p-5 md:px-8 md:py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white shadow-xl shadow-indigo-500/5 max-w-4xl mx-auto w-full transition-all duration-200 ${className}`}
      >
        {/* Left Content Area: Icon + Text Details */}
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {/* Left Icon Container: Compact w-12 h-12 */}
          <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
            <Briefcase className="w-6 h-6 stroke-[1.8]" />
          </div>

          {/* Text Details Container */}
          <div className="min-w-0">
            {/* Small Opportunities Badge */}
            <div className="mb-1">
              <span className="inline-block bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                OPPORTUNITIES
              </span>
            </div>

            {/* Headline (Reduced to text-lg md:text-xl) */}
            <h3 className="text-lg font-bold md:text-xl text-white tracking-tight leading-snug">
              Looking for custom software solutions? Open to client projects, sponsorships, and collaborations.
            </h3>

            {/* Sub-headline (Reduced to text-sm) */}
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Full-stack SaaS engineering, custom AI pipelines, and modern web application development.
            </p>
          </div>
        </div>

        {/* Right Content: Compact Work With Me Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all duration-200 shadow-md shadow-indigo-600/25 hover:scale-105 shrink-0 self-stretch md:self-auto cursor-pointer"
        >
          <Mail className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Work With Me</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>

      {/* Contact Modal */}
      <ContactModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
