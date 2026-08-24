
import React, { useState, useEffect } from 'react';
import { Scores } from '../types';
import { auth } from '../firebaseConfig';
import { getUserProfile, getOrgUsers } from '../services/firebaseService';
import { getEmailStyleFeedback, EmailFeedbackResult } from '../services/geminiService';

interface EmailStyleCheckProps {
  writerScores: Scores;
}

interface Colleague {
  uid: string;
  displayName: string;
  scores: Scores;
}

export const EmailStyleCheck: React.FC<EmailStyleCheckProps> = ({ writerScores }) => {
  const [draft, setDraft] = useState('');
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>(''); // '' = unknown/general
  const [loadingColleagues, setLoadingColleagues] = useState(true);
  const [feedback, setFeedback] = useState<EmailFeedbackResult | null>(null);
  const [showDepth, setShowDepth] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadColleagues = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) { setLoadingColleagues(false); return; }
        const profile = await getUserProfile(currentUser.uid);
        if (!profile?.orgId) { setLoadingColleagues(false); return; }
        const orgUsers = await getOrgUsers(profile.orgId);
        const withScores = orgUsers
          .filter(u => u.uid !== currentUser.uid && u.scores)
          .map(u => ({ uid: u.uid, displayName: u.displayName || u.email, scores: u.scores as Scores }));
        setColleagues(withScores);
      } catch (e) {
        console.error("Failed to load colleagues for recipient picker", e);
      } finally {
        setLoadingColleagues(false);
      }
    };
    loadColleagues();
  }, []);

  const handleCheck = async () => {
    if (!draft.trim()) return;
    setIsLoading(true);
    setError('');
    setFeedback(null);
    setShowDepth(false);
    try {
      const recipient = colleagues.find(c => c.uid === selectedUid);
      const result = await getEmailStyleFeedback(
        writerScores,
        draft.trim(),
        recipient?.scores || null,
        recipient?.displayName
      );
      setFeedback(result);
    } catch (e: any) {
      setError(e.message || 'שגיאה בבדיקת הטיוטה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-white">בדיקת מייל לפני שליחה</h2>
        <p className="text-gray-400 text-sm">הדבק/י את טיוטת המייל, ותקבל/י תובנה קצרה + ניסוחים חלופיים מוכנים להעתקה, מותאמים לסגנון שלך — ושל הנמען, אם ידוע.</p>
      </div>

      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 space-y-4">
        <div>
          <label className="block text-gray-400 text-xs mb-2 font-bold">הנמען (אופציונלי)</label>
          {loadingColleagues ? (
            <p className="text-gray-500 text-sm">טוען רשימת עמיתים...</p>
          ) : colleagues.length > 0 ? (
            <select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
            >
              <option value="">לא ידוע / לא ברשימה — משוב כללי</option>
              {colleagues.map(c => (
                <option key={c.uid} value={c.uid}>{c.displayName}</option>
              ))}
            </select>
          ) : (
            <p className="text-gray-500 text-sm">
              אין עדיין עמיתים אחרים בארגון שלך שמילאו את השאלון. המשוב יתבסס רק על הסגנון שלך.
            </p>
          )}
        </div>

        <div>
          <label className="block text-gray-400 text-xs mb-2 font-bold">טיוטת המייל</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full bg-gray-900 border border-gray-600 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
            placeholder="הדבק/י כאן את טיוטת המייל שברצונך לבדוק..."
          />
        </div>

        <button
          onClick={handleCheck}
          disabled={isLoading || !draft.trim()}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl transition-all"
        >
          {isLoading ? 'בודק...' : 'בדוק/י את הטיוטה'}
        </button>

        {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg">{error}</p>}
      </div>

      {feedback && (
        <div className="bg-gray-800 rounded-2xl border border-cyan-500/30 p-6 space-y-3">
          {feedback.edits.length === 0 ? (
            <p className="text-cyan-300 font-bold">{feedback.why || 'הטיוטה נראית טובה כמו שהיא.'}</p>
          ) : (
            <>
              {feedback.edits.map((edit, idx) => (
                <div key={idx} className={idx > 0 ? "pt-3 border-t border-gray-700 space-y-2" : "space-y-2"}>
                  {edit.original && (
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="whitespace-nowrap">כתבת:</span>
                      <span>"{edit.original}"</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 bg-gray-900 rounded-xl p-3">
                    <span className="text-cyan-300 font-bold text-sm whitespace-nowrap">עדיף:</span>
                    <span className="flex-1 text-gray-200 text-sm">{edit.suggestion}</span>
                    <button
                      onClick={() => handleCopy(edit.suggestion, idx)}
                      className="text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      {copiedIndex === idx ? 'הועתק! ✓' : 'העתק'}
                    </button>
                  </div>
                </div>
              ))}
              {feedback.why && (
                <div>
                  <button
                    onClick={() => setShowDepth(!showDepth)}
                    className="text-xs text-gray-400 hover:text-gray-200 underline"
                  >
                    {showDepth ? 'הסתר' : 'למה?'}
                  </button>
                  {showDepth && (
                    <span className="mr-2 text-xs text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-full">
                      {feedback.why}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
