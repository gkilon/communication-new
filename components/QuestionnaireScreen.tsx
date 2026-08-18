import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUESTION_PAIRS } from '../constants/questionnaireData';
import { QuestionSlider } from './QuestionSlider';
import { ArrowLeftIcon, ArrowRightIcon } from './icons/Icons';

interface QuestionnaireScreenProps {
  answers: Record<string, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onSubmit: () => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
}

const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const percentage = (current / total) * 100;
  return (
    <div className="w-full bg-slate-800/50 rounded-full h-4 my-6 border border-slate-700/50 overflow-hidden shadow-inner">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-gradient-to-r from-cyan-600 to-cyan-400 h-full rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]"
      />
    </div>
  );
};

export const QuestionnaireScreen: React.FC<QuestionnaireScreenProps> = ({ 
  answers, 
  setAnswers, 
  onSubmit,
  currentQuestionIndex,
  setCurrentQuestionIndex
}) => {

  const totalQuestions = QUESTION_PAIRS.length;
  const currentQuestion = QUESTION_PAIRS[currentQuestionIndex];
  
  // Check if current question has a valid answer
  const isAnswered = answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] > 0;

  const handleAnswerChange = (id: string, value: number) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    
    // Auto-advance after 500ms if not on the last question
    if (currentQuestionIndex < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 500);
    }
  };

  const handleNext = () => {
    if (!isAnswered) return; // Prevent next if not answered

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      onSubmit();
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-glass-dark p-8 md:p-12 lg:p-16 rounded-[2.5rem] shadow-2xl max-w-5xl mx-auto border border-glass-border backdrop-blur-xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>
      
      <div className="text-center mb-8 relative z-10">
        <p className="text-lg text-cyan-400 tracking-widest font-bold uppercase">שאלה {currentQuestionIndex + 1} מתוך {totalQuestions}</p>
        <ProgressBar current={currentQuestionIndex + 1} total={totalQuestions} />
      </div>

      <div className="relative min-h-[300px] my-12 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <QuestionSlider
              question={currentQuestion}
              value={answers[currentQuestion.id] || 0}
              onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center mt-12">
        <button
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-3 px-6 rounded-full transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed text-lg"
        >
          <ArrowRightIcon className="w-6 h-6" />
          <span>הקודם</span>
        </button>
        
        <div className="flex flex-col items-center">
             <button
              onClick={handleNext}
              disabled={!isAnswered}
              className={`flex items-center gap-2 font-bold py-3 px-8 rounded-full transition-all duration-300 transform shadow-lg text-lg ${
                  isAnswered 
                  ? 'bg-cyan-600 hover:bg-cyan-500 hover:scale-105 text-white cursor-pointer' 
                  : 'bg-gray-600 text-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              <span>{currentQuestionIndex === totalQuestions - 1 ? 'צפה בתוצאות' : 'הבא'}</span>
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
            {!isAnswered && (
                <span className="text-red-400 text-sm mt-2 font-medium animate-pulse">נא לבחור תשובה כדי להמשיך</span>
            )}
        </div>
      </div>
    </motion.div>
  );
};
