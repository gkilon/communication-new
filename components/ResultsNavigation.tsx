import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const ResultsNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const sections = [
    { id: 'chart-section', label: 'המפה שלי', icon: '📊' },
    { id: 'analysis-section', label: 'ניתוח אישי', icon: '🧠' },
    { id: 'summary-section', label: 'סיכום והמלצות', icon: '📝' },
    { id: 'ai-coach-section', label: 'מאמן אישי', icon: '✨' },
    { id: 'case-studies-section', label: 'סימולטור דיאלוג', icon: '🎭' },
    { id: 'ai-agent-section', label: 'סימולטור פרומפטים', icon: '🤖' },
    { id: 'stuck-manager-section', label: 'נתקעתי (עזרה)', icon: '🚨' },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 no-print">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 left-0 mb-2 bg-glass-dark/90 backdrop-blur-xl border border-glass-border p-2 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col gap-1 w-56"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="flex items-center gap-3 w-full text-right px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-xl">{section.icon}</span>
                <span className="font-medium text-sm">{section.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] text-white border border-cyan-400/30"
        aria-label="Navigation Menu"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </motion.button>
    </div>
  );
};
