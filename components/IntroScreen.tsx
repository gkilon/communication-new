import React from 'react';
import { motion } from 'framer-motion';

interface IntroScreenProps {
  onStart: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onStart }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-glass-dark p-10 md:p-14 rounded-[2.5rem] shadow-2xl text-center max-w-4xl mx-auto border border-glass-border backdrop-blur-xl relative overflow-hidden"
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[60px] -ml-16 -mt-16 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[60px] -mr-20 -mb-20 pointer-events-none"></div>

      {/* New Gilad Kilon Branding Logo */}
      <motion.div variants={itemVariants} className="mb-12 flex flex-col items-center">
        <a 
          href="https://kilon-consulting.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group transition-all duration-300 transform hover:scale-105"
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center text-4xl md:text-5xl tracking-tight">
              <span className="text-white font-light">GILAD</span>
              <span className="text-white font-black ml-3">KILON</span>
              <span className="text-cyan-500 font-black ml-1 text-5xl leading-none">.</span>
            </div>
            <div className="text-gray-400 text-[10px] md:text-xs font-bold tracking-[0.4em] uppercase mt-2 border-t border-gray-700/50 pt-2 w-full text-center">
              MANAGEMENT CONSULTING
            </div>
          </div>
        </a>
      </motion.div>

      <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-8 drop-shadow-sm">
        ברוכים הבאים
      </motion.h2>
      
      <motion.div variants={itemVariants} className="space-y-6 text-gray-300 text-xl md:text-2xl leading-relaxed font-light mb-12 relative z-10">
        <p>
          שאלון זה יסייע לך לזהות את <strong className="text-cyan-400 font-bold">סגנון התקשורת הדומיננטי</strong> שלך. 
          בכל שאלה יוצג בפניך צמד של תכונות.
        </p>
        <p>
          המטרה היא לסמן על הסקאלה לאיזו תכונה אתה נוטה <strong>יותר</strong> באופן טבעי ברוב המצבים.
        </p>
        
        <div className="bg-glass-light p-8 rounded-3xl border-r-4 border-cyan-500 text-lg md:text-xl text-right inline-block w-full backdrop-blur-sm shadow-inner mt-4">
          <p className="mb-2">
            בסיום, תקבל/י מפה מקיפה של פרופיל התקשורת שלך, שתחשוף את החוזקות והשילוב הייחודי שיוצר את סגנונך. 
          </p>
        </div>
      </motion.div>
      
      <motion.div variants={itemVariants} className="flex flex-col items-center gap-6 relative z-10">
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0px 15px 35px rgba(6,182,212,0.4)" }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-5 px-16 rounded-2xl text-2xl transition-all duration-300 shadow-[0_10px_25px_rgba(6,182,212,0.2)]"
        >
          התחל בשאלון
        </motion.button>
        
        <a 
          href="https://kilon-consulting.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-cyan-400 text-sm font-bold transition-colors flex items-center gap-2 group mt-4"
        >
          <span>בקרו באתר הבית שלנו</span>
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
        </a>
      </motion.div>
    </motion.div>
  );
};
