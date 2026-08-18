import React, { useState } from 'react';
import { translateText } from '../services/geminiService';
import { Globe, Loader2 } from 'lucide-react';

interface Analysis {
  general: string;
  strengths: string;
  weaknesses: string;
  recommendations: string;
}

interface CombinedAnalysisProps {
  analysis: Analysis;
}

type Lang = 'HE' | 'EN' | 'RU' | 'AR';

const LANG_CONFIG: Record<Lang, { name: string, label: string, dir: 'rtl' | 'ltr' }> = {
  HE: { name: 'עברית', label: 'עב', dir: 'rtl' },
  EN: { name: 'English', label: 'EN', dir: 'ltr' },
  RU: { name: 'Русский', label: 'RU', dir: 'ltr' },
  AR: { name: 'العربية', label: 'AR', dir: 'rtl' }
};

export const CombinedAnalysis: React.FC<CombinedAnalysisProps> = ({ analysis: initialAnalysis }) => {
  const [currentLang, setCurrentLang] = useState<Lang>('HE');
  const [translations, setTranslations] = useState<Record<Lang, Analysis>>({ HE: initialAnalysis } as Record<Lang, Analysis>);
  const [loadingLang, setLoadingLang] = useState<Lang | null>(null);

  if (!initialAnalysis) return null;

  const currentAnalysis = translations[currentLang] || initialAnalysis;
  const isRtl = LANG_CONFIG[currentLang].dir === 'rtl';

  const handleLangChange = async (lang: Lang) => {
    if (lang === currentLang) return;
    
    if (translations[lang]) {
      setCurrentLang(lang);
      return;
    }

    setLoadingLang(lang);
    try {
      const sections = ['general', 'strengths', 'weaknesses', 'recommendations'] as const;
      const translatedSections = await Promise.all(
        sections.map(s => translateText(initialAnalysis[s], LANG_CONFIG[lang].name))
      );

      const newAnalysis: Analysis = {
        general: translatedSections[0],
        strengths: translatedSections[1],
        weaknesses: translatedSections[2],
        recommendations: translatedSections[3]
      };

      setTranslations(prev => ({ ...prev, [lang]: newAnalysis }));
      setCurrentLang(lang);
    } catch (error) {
      console.error("Failed to translate:", error);
      alert("שגיאה בתרגום. אנא נסה שוב.");
    } finally {
      setLoadingLang(null);
    }
  };

  return (
    <div className={`h-full flex flex-col space-y-6 ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Language Selector */}
      <div className="flex justify-between items-center no-print bg-slate-800/40 p-3 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
        <div className={`flex items-center gap-2 text-cyan-400 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
          <Globe className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{currentLang === 'HE' ? 'שפה:' : 'Language:'}</span>
        </div>
        <div className="flex gap-1">
          {(Object.keys(LANG_CONFIG) as Lang[]).map((lang) => (
            <button
              key={lang}
              onClick={() => handleLangChange(lang)}
              disabled={loadingLang !== null}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-300 min-w-[32px] flex items-center justify-center ${
                currentLang === lang 
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' 
                  : 'text-gray-200 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {loadingLang === lang ? (
                <Loader2 className="w-3 h-3 animate-spin text-white" />
              ) : (
                LANG_CONFIG[lang].label
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 text-gray-300 leading-relaxed overflow-y-auto pr-1 custom-scrollbar">
        <div className="group transition-all duration-300">
          <h4 className="text-lg font-black text-white mb-2 flex items-center gap-2 group-hover:text-cyan-400">
            <span className="opacity-50 text-sm">01</span>
            {currentLang === 'HE' ? 'ניתוח כללי' : (currentLang === 'RU' ? 'Общий анализ' : (currentLang === 'AR' ? 'تحليل عام' : 'General Analysis'))}
          </h4>
          <p className="bg-slate-800/20 p-4 rounded-xl border border-slate-700/30 group-hover:border-cyan-500/30 transition-all font-light">
            {currentAnalysis.general}
          </p>
        </div>

        <div className="group transition-all duration-300">
          <h4 className="text-lg font-black text-emerald-400 mb-2 flex items-center gap-2 group-hover:text-emerald-300">
            <span className="opacity-50 text-sm">02</span>
            {currentLang === 'HE' ? 'חוזקות' : (currentLang === 'RU' ? 'Сильные стороны' : (currentLang === 'AR' ? 'نقاط القوة' : 'Strengths'))}
          </h4>
          <p className="bg-emerald-900/5 p-4 rounded-xl border border-emerald-900/20 group-hover:border-emerald-500/30 transition-all font-light">
            {currentAnalysis.strengths}
          </p>
        </div>

        <div className="group transition-all duration-300">
          <h4 className="text-lg font-black text-amber-400 mb-2 flex items-center gap-2 group-hover:text-amber-300">
            <span className="opacity-50 text-sm">03</span>
            {currentLang === 'HE' ? 'אזורים לפיתוח' : (currentLang === 'RU' ? 'Зоны развития' : (currentLang === 'AR' ? 'مجالات التطوير' : 'Development Areas'))}
          </h4>
          <p className="bg-amber-900/5 p-4 rounded-xl border border-amber-900/20 group-hover:border-amber-500/30 transition-all font-light">
            {currentAnalysis.weaknesses}
          </p>
        </div>

        <div className="group transition-all duration-300">
          <h4 className="text-lg font-black text-purple-400 mb-2 flex items-center gap-2 group-hover:text-purple-300">
            <span className="opacity-50 text-sm">04</span>
            {currentLang === 'HE' ? 'המלצות לפעולה' : (currentLang === 'RU' ? 'Рекомендации' : (currentLang === 'AR' ? 'توصيات' : 'Action Recommendations'))}
          </h4>
          <p className="bg-purple-900/5 p-4 rounded-xl border border-purple-900/20 group-hover:border-purple-500/30 transition-all font-light">
            {currentAnalysis.recommendations}
          </p>
        </div>
      </div>
    </div>
  );
};