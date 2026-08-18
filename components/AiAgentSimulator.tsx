import React, { useState } from 'react';
import { generatePromptAnalysis } from '../services/geminiService';
import { Scores } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, Sparkles, TerminalSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AiAgentSimulatorProps {
  scores: Scores;
}

const TASKS = [
  "כתוב דוא״ל שיווקי מתומצת ללקוח פוטנציאלי שמציע פגישת היכרות בת רבע שעה.",
  "תכנן אסטרטגיה לניהול קמפיין מוצר חדש ברשתות החברתיות (לוז ומשימות).",
  "נסח הודעת התנצלות ללקוח שקיבל שירות לקוי מהצוות שלך ותציע פיצוי."
];

export const AiAgentSimulator: React.FC<AiAgentSimulatorProps> = ({ scores }) => {
  const [selectedTask, setSelectedTask] = useState<string>(TASKS[0]);
  const [promptInput, setPromptInput] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    if (!promptInput.trim()) return;
    setIsLoading(true);
    try {
      const result = await generatePromptAnalysis(scores, selectedTask, promptInput);
      setAnalysis(result);
    } catch (err) {
      setAnalysis("אירעה שגיאה בטעינת הניתוח.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-glass-dark border border-neon-cyan/30 rounded-2xl p-6 shadow-neon-cyan/10 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="bg-neon-cyan/20 p-3 rounded-full border border-neon-cyan/50 text-neon-cyan">
          <TerminalSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">סימולטור <span className="text-neon-cyan">AI Agent</span></h2>
          <p className="text-gray-400 text-sm">כיצד סגנון התקשורת האנושי שלך משפיע על ניהול סוכני AI?</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div>
          <label className="block text-sm font-medium text-neon-cyan mb-2">1. בחר משימה שברצונך להאציל לסוכן ה-AI שלך:</label>
          <select 
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all appearance-none"
          >
            {TASKS.map((t, i) => (
              <option key={i} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neon-cyan mb-2">2. הקלד את ההנחיה (Prompt) בדיוק כפי שהיית כותב לסוכן AI:</label>
          <textarea
            rows={4}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="הכנס את הפרומפט שלך כאן..."
            className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-4 focus:outline-none focus:border-neon-magenta focus:ring-1 focus:ring-neon-magenta transition-all resize-none font-mono text-sm"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isLoading || !promptInput.trim()}
          className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-neon-cyan/80 to-neon-purple/80 hover:from-neon-cyan hover:to-neon-purple text-white font-bold py-4 rounded-xl shadow-neon-cyan/40 hover:shadow-neon-cyan/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>שגר לסוכן ה-AI ושלוף ניתוח</span>
              <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform rtl:group-hover:-translate-x-1" />
            </>
          )}
        </button>

        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="mt-6 rounded-xl overflow-hidden shadow-neon-magenta/20"
            >
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-l-4 border-neon-magenta p-6 relative">
                <Sparkles className="absolute top-4 left-4 w-6 h-6 text-neon-magenta/40" />
                <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-white prose-strong:text-neon-cyan max-w-none">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
