
import React, { useState, useEffect } from 'react';
import { Scores } from '../types';
import { auth } from '../firebaseConfig';
import { getUserProfile, getOrgUsers } from '../services/firebaseService';
import { getEmailStyleFeedback } from '../services/geminiService';

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
  const [feedback, setFeedback] = useState<string>('');
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
    setFeedback('');
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

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-white">בדיקת מייל לפני שליחה</h2>
        <p className="text-gray-400 text-sm">הדבק/י את טיוטת המייל, ותקבל/י משוב מותאם לסגנון התקשורת שלך — ושל הנמען, אם ידוע.</p>
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
        <div className="bg-gray-800 rounded-2xl border border-cyan-500/30 p-6 whitespace-pre-wrap text-gray-200 leading-relaxed">
          {feedback}
        </div>
      )}
    </div>
  );
};
