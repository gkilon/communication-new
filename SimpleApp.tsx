
import React, { useState, useMemo, useEffect } from 'react';
import { IntroScreen } from './components/IntroScreen';
import { QuestionnaireScreen } from './components/QuestionnaireScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { AuthScreen } from './components/AuthScreen';
import { BackgroundQuestionsScreen } from './components/BackgroundQuestionsScreen';
import { Scores, BackgroundData } from './types';
import { QUESTION_PAIRS } from './constants/questionnaireData';
import { saveUserResults } from './services/firebaseService';

interface SimpleAppProps {
  user?: any;
  onLogout: () => void;
}

const STORAGE_KEY_ANSWERS = 'comm_style_answers';
const STORAGE_KEY_STEP = 'comm_style_step';
const STORAGE_KEY_INDEX = 'comm_style_index';
const STORAGE_KEY_BG = 'comm_style_background';

const DEFAULT_BACKGROUND: BackgroundData = { gender: '', isManager: '', goal: '' };

const SimpleApp: React.FC<SimpleAppProps> = ({ user, onLogout }) => {
  // Authentication now comes solely from Firebase (the `user` prop) — no local password gate.
  const isAuthenticated = !!user;
  
  // Persistence initialization for Progress
  const [step, setStep] = useState<'intro' | 'background' | 'questionnaire' | 'results'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_STEP);
    // Guard: if saved step is 'background', reset to 'intro' to avoid getting stuck
    if (saved === 'background') return 'intro';
    return (saved as any) || 'intro';
  });
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_INDEX);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ANSWERS);
    return saved ? JSON.parse(saved) : {};
  });

  const [backgroundData, setBackgroundData] = useState<BackgroundData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BG);
    return saved ? JSON.parse(saved) : DEFAULT_BACKGROUND;
  });

  // Save progress and auth state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(answers));
    // Don't persist 'background' step — always re-show from 'intro' on refresh
    if (step !== 'background') {
      localStorage.setItem(STORAGE_KEY_STEP, step);
    }
    localStorage.setItem(STORAGE_KEY_INDEX, currentQuestionIndex.toString());
    localStorage.setItem(STORAGE_KEY_BG, JSON.stringify(backgroundData));
  }, [answers, step, currentQuestionIndex, backgroundData]);

  const scores = useMemo<Scores | null>(() => {
    if (step !== 'results') return null;
    
    const newScores: Scores = { a: 0, b: 0, c: 0, d: 0 };
    let totalQuestions = 0;

    QUESTION_PAIRS.forEach(q => {
      const val = answers[q.id];
      if (val !== undefined && val > 0) {
        const [col1, col2] = q.columns;
        newScores[col1] += (6 - val); 
        newScores[col2] += (val - 1);
        totalQuestions++;
      }
    });

    if (totalQuestions === 0) return { a: 0, b: 0, c: 0, d: 0 };
    return newScores;
  }, [step, answers]);

  // Keep results updated in cloud if user is logged in
  useEffect(() => {
    if (step === 'results' && scores && user) {
        saveUserResults(scores, backgroundData).catch(err => console.error("Firebase save error:", err));
    }
  }, [step, scores, user]);

  // After intro, always show background questions first (if not returning to existing progress)
  const handleStart = () => {
    const hasAnswers = Object.keys(answers).length > 0;
    if (hasAnswers) {
      // Returning user: go straight to questionnaire to resume
      setStep('questionnaire');
    } else {
      setStep('background');
    }
  };

  const handleBackgroundComplete = (data: BackgroundData) => {
    setBackgroundData(data);
    setStep('questionnaire');
  };

  const handleSubmit = () => setStep('results');
  
  const handleReset = () => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את כל התשובות ולהתחיל מחדש?")) return;
    setAnswers({});
    setCurrentQuestionIndex(0);
    setBackgroundData(DEFAULT_BACKGROUND);
    setStep('intro');
    localStorage.removeItem(STORAGE_KEY_ANSWERS);
    localStorage.removeItem(STORAGE_KEY_STEP);
    localStorage.removeItem(STORAGE_KEY_INDEX);
    localStorage.removeItem(STORAGE_KEY_BG);
  };

  const handleEditAnswers = () => {
    setStep('questionnaire');
  };

  const handleLogout = () => {
    if (!window.confirm("האם לצאת מהמערכת? (התשובות ישמרו בדפדפן זה)")) return;
    onLogout();
  };

  // Gender-aware welcome text
  const isFemale = backgroundData.gender === 'female';
  const welcomeBackText = isFemale ? 'ברוכה השבה!' : 'ברוך השב!';
  const continueText = isFemale ? 'המשיכי מאיפה שעצרת' : 'המשך מאיפה שעצרתי';
  const deleteText = isFemale ? 'מחקי הכל והתחילי מחדש' : 'מחק הכל והתחל מחדש';

  return (
    <div className="min-h-screen bg-transparent text-white p-4 sm:p-8 font-sans dir-rtl flex flex-col items-center overflow-y-auto pb-20">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-12 relative">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-cyan-400 tracking-wide drop-shadow-lg py-4">
             שאלון סגנונות תקשורת
          </h1>
          <p className="text-gray-300 mt-2 text-xl font-light">גלה את פרופיל התקשורת שלך וקבל תובנות מבוססות AI</p>
          
          {isAuthenticated && (
            <div className="absolute top-0 left-0 flex gap-2">
                <button 
                  onClick={handleLogout} 
                  className="text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-3 py-1 bg-gray-800/50 transition-colors"
                >
                  יציאה
                </button>
            </div>
          )}
        </header>

        <main className="w-full flex justify-center">
            {!isAuthenticated ? (
                <AuthScreen onLoginSuccess={() => { /* App-level onAuthStateChanged picks this up */ }} />
            ) : (
                <div className="w-full">
                    {step === 'intro' && (
                      <div className="space-y-6">
                        {Object.keys(answers).length > 0 && (
                          <div className="max-w-md mx-auto bg-cyan-900/40 border border-cyan-500/50 p-6 rounded-2xl text-center mb-8 shadow-2xl animate-fade-in">
                            <h4 className="text-xl font-bold text-white mb-2">{welcomeBackText}</h4>
                            <p className="text-gray-300 mb-4 text-sm">זיהינו שמילאת חלק מהשאלון בעבר. איך תרצה להמשיך?</p>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleStart} className="w-full text-white bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl font-bold transition-all shadow-lg">{continueText}</button>
                                <button onClick={handleReset} className="w-full text-gray-400 border border-gray-700 hover:bg-gray-800 py-2 rounded-xl text-xs transition-all">{deleteText}</button>
                            </div>
                          </div>
                        )}
                        <IntroScreen onStart={handleStart} />
                      </div>
                    )}
                    {step === 'background' && (
                      <div className="w-full flex justify-center">
                        <BackgroundQuestionsScreen
                          data={backgroundData}
                          onChange={setBackgroundData}
                          onSubmit={() => handleBackgroundComplete(backgroundData)}
                        />
                      </div>
                    )}
                    {step === 'questionnaire' && (
                        <QuestionnaireScreen 
                            answers={answers} 
                            setAnswers={setAnswers} 
                            onSubmit={handleSubmit}
                            currentQuestionIndex={currentQuestionIndex}
                            setCurrentQuestionIndex={setCurrentQuestionIndex}
                        />
                    )}
                    {step === 'results' && scores && (
                        <ResultsScreen 
                          scores={scores} 
                          backgroundData={backgroundData}
                          onReset={handleReset} 
                          onEdit={handleEditAnswers} 
                          onLogout={handleLogout} 
                        />
                    )}
                </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default SimpleApp;
