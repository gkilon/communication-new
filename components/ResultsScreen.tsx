import React, { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scores, BackgroundData } from '../types';
import { ResultsChart } from './ResultsChart';
import { CombinedAnalysis } from './CombinedAnalysis';
import { generateProfileAnalysis } from '../services/analysisService';
import { AiCoach } from './AiCoach';
import { CaseStudiesSimulator } from './CaseStudiesSimulator';

declare global {
  interface Window {
    html2canvas: any;
    jspdf: any;
  }
}

interface ResultsScreenProps {
  scores: Scores;
  backgroundData?: BackgroundData | null;
  onReset: () => void;
  onEdit: () => void;
  onLogout?: () => void;
}

type TabId = 'profile' | 'coach' | 'simulator';

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'profile', label: 'הפרופיל שלי', emoji: '🗺️' },
  { id: 'coach', label: 'מאמן AI', emoji: '🤖' },
  { id: 'simulator', label: 'סימולטור שיחות', emoji: '🎭' },
];

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ scores, backgroundData, onReset, onEdit, onLogout }) => {
  const profileAnalysis = useMemo(() => generateProfileAnalysis(scores), [scores]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const isFemale = backgroundData?.gender === 'female';
  const isManager = backgroundData?.isManager === 'yes';

  const handleDownloadPdf = async () => {
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const input = resultsRef.current;

    if (!input || !jsPDF || !html2canvas) {
      console.error("PDF generation libraries not loaded.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
      input.classList.add('pdf-export-mode');
      const canvas = await html2canvas(input, {
        scale: 1.5,
        backgroundColor: '#0f172a',
        useCORS: true,
        logging: false,
        windowWidth: 1000,
        scrollY: -window.scrollY,
        scrollX: 0,
      });
      input.classList.remove('pdf-export-mode');

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4', true);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const margin = 8;
      const pdfContentWidth = pageWidth - (margin * 2);
      const maxContentHeight = pageHeight - (margin * 2);
      const calculatedHeight = (imgProps.height * pdfContentWidth) / imgProps.width;
      const finalContentHeight = Math.min(calculatedHeight, maxContentHeight);

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.addImage(imgData, 'JPEG', margin, margin, pdfContentWidth, finalContentHeight, undefined, 'FAST');
      pdf.setFontSize(7);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Kilon Consulting - דו"ח סגנון תקשורת אישי', pageWidth / 2, pageHeight - 5, { align: 'center' });
      pdf.save(`Communication_Profile_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("חלה שגיאה ביצירת ה-PDF.");
      if (input) input.classList.remove('pdf-export-mode');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Gender-conjugated summary text
  const summaryText1 = isFemale
    ? "הניתוח שלעיל נגזר ממפת הפרופיל המשולבת שלך — לא מאחוזים מבודדים, אלא מהדינמיקה שבין הצבעים השונים. המפה חושפת את הנטיות הטבעיות שלך, את הסגנונות שמגיעים לך בקלות, ואת אלה שדורשים ממך מאמץ מודע."
    : "הניתוח שלעיל נגזר ממפת הפרופיל המשולבת שלך — לא מאחוזים מבודדים, אלא מהדינמיקה שבין הצבעים השונים. המפה חושפת את הנטיות הטבעיות שלך, את הסגנונות שמגיעים לך בקלות, ואת אלה שדורשים ממך מאמץ מודע.";

  const summaryText2 = isFemale
    ? "סגנון תקשורת אינו גזר דין — הוא נקודת פתיחה. כל תכונה שמגדירה אותך היום היא גם שריר שניתן לאמן. ההמלצות בדוח זה נועדו לא לשנות מי שאת, אלא להרחיב את הטווח שלך ולאפשר לך לתקשר אפקטיבית עם כל סגנון — בכל מצב."
    : "סגנון תקשורת אינו גזר דין — הוא נקודת פתיחה. כל תכונה שמגדירה אותך היום היא גם שריר שניתן לאמן. ההמלצות בדוח זה נועדו לא לשנות מי שאתה, אלא להרחיב את הטווח שלך ולאפשר לך לתקשר אפקטיבית עם כל סגנון — בכל מצב.";

  const managerTag = isManager ? '#מנהיגות_וניהול' : '#תקשורת_עמיתים';

  const tabVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto px-2 sm:px-4 pb-24"
      dir="rtl"
    >
      {/* ─── Sticky Tab Bar ─── */}
      <div className="sticky top-0 z-40 pt-2 pb-3 bg-gradient-to-b from-slate-900/95 to-transparent backdrop-blur-md">
        <nav className="flex gap-2 justify-center flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all border ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/30'
                  : 'bg-slate-800/70 text-gray-300 border-slate-700 hover:bg-slate-700/70'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Tab Content ─── */}
      <AnimatePresence mode="wait">

        {/* ── Tab: Profile ── */}
        {activeTab === 'profile' && (
          <motion.div key="profile" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 mt-4">
            {/* PDF Wrapper */}
            <div ref={resultsRef} className="bg-glass-dark backdrop-blur-2xl p-6 sm:p-10 rounded-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-glass-border overflow-hidden text-right relative">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none"></div>

              <div className="border-b border-glass-border pb-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                <div className="text-right flex-1">
                  <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 mb-3 drop-shadow-sm">דו"ח סגנון תקשורת</h1>
                  <p className="text-cyan-400 font-bold uppercase tracking-[0.2em]">ניתוח מקצועי מבוסס מודל הצבעים</p>
                  {backgroundData?.isManager === 'yes' && (
                    <span className="mt-2 inline-block text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full font-semibold">👔 מנהל/ת</span>
                  )}
                </div>
                <div className="bg-glass-light p-5 rounded-2xl border border-glass-border text-center min-w-[180px] backdrop-blur-md">
                  <div className="text-gray-400 text-xs font-bold uppercase mb-1 tracking-widest">תאריך הנפקה</div>
                  <div className="text-white font-mono text-lg">{new Date().toLocaleDateString('he-IL')}</div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 mb-8 items-stretch relative z-10">
                <div className="flex-none lg:w-[40%] bg-glass-light p-6 rounded-[2rem] border border-glass-border shadow-inner backdrop-blur-sm">
                  <ResultsChart scores={scores} />
                </div>
                <div className="flex-1 bg-glass-light p-6 rounded-[2rem] border border-glass-border shadow-inner backdrop-blur-sm">
                  <CombinedAnalysis analysis={profileAnalysis} />
                </div>
              </div>

              {/* Summary box */}
              <div className="bg-gradient-to-br from-slate-800/40 to-cyan-900/20 p-8 rounded-[2rem] border border-dashed border-cyan-500/30 relative overflow-hidden z-10 shadow-lg backdrop-blur-sm">
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-3">
                  <span className="text-cyan-400 text-2xl">📝</span> סיכום והמלצות מפתח
                </h3>
                <p className="text-gray-300 leading-relaxed text-lg font-light mb-3">{summaryText1}</p>
                <p className="text-gray-400 leading-relaxed text-base font-light">{summaryText2}</p>
                <div className="mt-6 flex gap-3 flex-wrap">
                  <span className="bg-glass-dark px-4 py-2 rounded-full text-xs text-cyan-400 font-bold border border-cyan-500/20 shadow-sm">#מפה_משולבת</span>
                  <span className="bg-glass-dark px-4 py-2 rounded-full text-xs text-cyan-400 font-bold border border-cyan-500/20 shadow-sm">#מודעות_עצמית</span>
                  <span className="bg-glass-dark px-4 py-2 rounded-full text-xs text-cyan-400 font-bold border border-cyan-500/20 shadow-sm">{managerTag}</span>
                  <span className="bg-glass-dark px-4 py-2 rounded-full text-xs text-cyan-400 font-bold border border-cyan-500/20 shadow-sm">#תקשורת_אפקטיבית</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 no-print">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0px 10px 30px rgba(16,185,129,0.3)" }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black py-4 px-10 rounded-2xl text-lg transition-all shadow-2xl disabled:opacity-50 flex items-center gap-3 border border-emerald-500/50"
              >
                {isGeneratingPdf ? (
                  <span className="flex items-center gap-3">
                    <span className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></span>
                    מפיק דו"ח...
                  </span>
                ) : (
                  <>
                    <span className="text-2xl">📥</span>
                    <span>הורד דו"ח PDF</span>
                  </>
                )}
              </motion.button>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={onEdit}
                  className="bg-glass-light hover:bg-glass-dark text-white font-bold py-3 px-6 rounded-2xl transition-all border border-glass-border text-base shadow-lg backdrop-blur-sm"
                >
                  עריכת תשובות
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={onReset}
                  className="bg-red-900/10 hover:bg-red-900/30 text-red-500 font-bold py-3 px-6 rounded-2xl transition-all border border-red-900/30 text-base shadow-lg backdrop-blur-sm"
                >
                  איפוס
                </motion.button>
              </div>
            </div>

            {onLogout && (
              <div className="pt-4 pb-2 text-center">
                <button onClick={onLogout} className="text-gray-500 hover:text-white underline text-sm tracking-[0.2em] font-medium uppercase transition-colors">
                  Log Out / End Session
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab: AI Coach ── */}
        {activeTab === 'coach' && (
          <motion.div key="coach" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="mt-4">
            <div className="bg-glass-dark p-6 sm:p-8 rounded-[2rem] shadow-xl border border-glass-border backdrop-blur-xl">
              <AiCoach scores={scores} backgroundData={backgroundData} />
            </div>
          </motion.div>
        )}

        {/* ── Tab: Simulator ── */}
        {activeTab === 'simulator' && (
          <motion.div key="simulator" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="mt-4">
            <div className="bg-glass-dark p-6 sm:p-8 rounded-[2rem] shadow-xl border border-glass-border backdrop-blur-xl">
              <CaseStudiesSimulator scores={scores} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
};
