
import React from 'react';
import { QuestionPair } from '../types';

interface QuestionSliderProps {
  question: QuestionPair;
  value: number;
  onChange: (value: number) => void;
}

export const QuestionSlider: React.FC<QuestionSliderProps> = ({ question, value, onChange }) => {
  const [trait1, trait2] = question.pair;
  const [desc1, desc2] = question.descriptions || ['', ''];

  // Logic: If value is 0 (unanswered), we visually put the slider in the middle (3.5)
  const visualValue = value === 0 ? 3.5 : value;
  const isUnanswered = value === 0;

  return (
    <div className="w-full select-none">
      {/* Trait Headers */}
      <div className="flex justify-between items-start text-white mb-10 tracking-wide gap-4">
        {/* Right Side (Trait 1) */}
        <div 
          className={`text-right w-1/2 p-4 rounded-2xl transition-all cursor-pointer border-2 ${value >= 1 && value <= 3 ? 'bg-cyan-900/40 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-gray-800/50 border-transparent hover:bg-gray-700'}`} 
          onClick={() => onChange(2)}
        >
            <div className={`text-2xl sm:text-3xl font-black ${value >= 1 && value <= 3 ? 'text-cyan-300' : 'text-gray-400'}`}>{trait1}</div>
            <div className="text-sm sm:text-base text-gray-400 mt-2 leading-tight font-medium">{desc1}</div>
        </div>
        
        {/* Left Side (Trait 2) */}
        <div 
          className={`text-left w-1/2 p-4 rounded-2xl transition-all cursor-pointer border-2 ${value >= 4 && value <= 6 ? 'bg-cyan-900/40 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-gray-800/50 border-transparent hover:bg-gray-700'}`} 
          onClick={() => onChange(5)}
        >
            <div className={`text-2xl sm:text-3xl font-black ${value >= 4 && value <= 6 ? 'text-cyan-300' : 'text-gray-400'}`}>{trait2}</div>
             <div className="text-sm sm:text-base text-gray-400 mt-2 leading-tight font-medium">{desc2}</div>
        </div>
      </div>
      
      {/* New Visual Selection System (No Numbers) */}
      <div className="relative mb-6">
        <p className="text-center text-gray-500 text-sm mb-4 font-bold uppercase tracking-widest">בחר את הנקודה המשקפת את הנטייה שלך</p>
        
        <div className="flex justify-between items-center gap-2 sm:gap-4 relative px-2">
            {/* Background Line */}
            <div className="absolute left-6 right-6 h-1 bg-gray-700 top-1/2 -translate-y-1/2 z-0"></div>
            
            {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                    key={num}
                    onClick={() => onChange(num)}
                    className={`relative z-10 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 border-4 shadow-xl
                        ${value === num 
                            ? 'bg-cyan-500 border-white scale-125 shadow-[0_0_20px_rgba(6,182,212,0.6)]' 
                            : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:scale-110'
                        }`}
                >
                    {/* Visual indicators of direction instead of numbers */}
                    <div className={`w-3 h-3 rounded-full ${value === num ? 'bg-white' : (num <= 3 ? 'bg-gray-600' : 'bg-gray-600')}`}></div>
                    
                    {/* Pulsing effect for selected */}
                    {value === num && (
                        <div className="absolute inset-0 rounded-full animate-ping bg-cyan-400 opacity-20"></div>
                    )}
                </button>
            ))}
        </div>
      </div>
      
      {/* Range Labels */}
      <div className="flex justify-between px-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase">
          <span>מאוד {trait1}</span>
          <span className="text-gray-700">|</span>
          <span>מאוד {trait2}</span>
      </div>

      <div className="text-center h-12 flex items-center justify-center mt-10">
        {!isUnanswered ? (
            <div className="animate-fade-in bg-cyan-900/30 px-8 py-3 rounded-full border border-cyan-500/30 text-cyan-300 font-bold text-lg shadow-inner">
                {value <= 3 ? `נוטה יותר ל"${trait1}"` : `נוטה יותר ל"${trait2}"`}
            </div>
        ) : (
            <div className="text-gray-400 text-base animate-bounce font-medium bg-gray-800/50 px-6 py-2 rounded-full">
                לחץ על העיגול שהכי מתאים לך בשורה
            </div>
        )}
      </div>
    </div>
  );
};
