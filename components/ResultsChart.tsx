import React from 'react';
import { motion } from 'framer-motion';
import { Scores } from '../types';

interface ResultsChartProps {
  scores: Scores;
}

export const ResultsChart: React.FC<ResultsChartProps> = ({ scores }) => {
  const { a, b, c, d } = scores;

  const horizontalTotal = (a + b) || 1;
  const verticalTotal = (c + d) || 1;

  const aPercent = (a / horizontalTotal) * 100;
  const bPercent = 100 - aPercent;
  const cPercent = (c / verticalTotal) * 100;
  const dPercent = 100 - cPercent;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="w-full"
    >
      <h3 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-6 text-center drop-shadow-md">מפת הפרופיל שלך</h3>
      <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.3)] border-4 border-slate-700 bg-[#000000]">
        
        {/* Quadrant Areas - Animated growth */}
        <motion.div 
          initial={{ width: 0, height: 0 }} animate={{ width: `${bPercent}%`, height: `${cPercent}%` }} 
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
          className="absolute top-0 left-0 chart-quadrant" style={{ backgroundColor: '#0066FF' }} 
        />
        <motion.div 
          initial={{ width: 0, height: 0 }} animate={{ width: `${aPercent}%`, height: `${cPercent}%` }} 
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
          className="absolute top-0 right-0 chart-quadrant" style={{ backgroundColor: '#FF0033' }} 
        />
        <motion.div 
          initial={{ width: 0, height: 0 }} animate={{ width: `${bPercent}%`, height: `${dPercent}%` }} 
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
          className="absolute bottom-0 left-0 chart-quadrant" style={{ backgroundColor: '#00CC66' }} 
        />
        <motion.div 
          initial={{ width: 0, height: 0 }} animate={{ width: `${aPercent}%`, height: `${dPercent}%` }} 
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
          className="absolute bottom-0 right-0 chart-quadrant" style={{ backgroundColor: '#FFCC00' }} 
        />
        
        {/* Axes - Fade in */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="absolute top-0 h-full w-[2px] bg-white/60 z-10" style={{ left: `${bPercent}%` }}></motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="absolute left-0 w-full h-[2px] bg-white/60 z-10" style={{ top: `${cPercent}%` }}></motion.div>

        {/* Quadrant Labels */}
        <div className="absolute top-4 left-4 text-white font-black text-shadow-lg text-lg z-20">כחול</div>
        <div className="absolute top-4 right-4 text-white font-black text-shadow-lg text-lg z-20">אדום</div>
        <div className="absolute bottom-4 left-4 text-white font-black text-shadow-lg text-lg z-20">ירוק</div>
        <div className="absolute bottom-4 right-4 text-white font-black text-shadow-lg text-lg z-20">צהוב</div>
        
        {/* Center Point Indicator */}
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.4, type: 'spring' }}
          className="absolute w-5 h-5 bg-white rounded-full border-[3px] border-black shadow-[0_0_15px_white] transform -translate-x-1/2 -translate-y-1/2 z-30" style={{ left: `${bPercent}%`, top: `${cPercent}%` }}>
        </motion.div>
      </div>
      
       <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
        className="mt-8 text-center bg-glass-light backdrop-blur-md p-5 rounded-2xl border border-glass-border shadow-lg"
       >
        <p className="text-gray-100 text-sm md:text-base font-medium">
          הגרף מציג את החלוקה היחסית של סגנונות התקשורת שלך. 
          <br/>
          <span className="text-cyan-400 font-bold">שטח הצבע</span> מייצג את הדומיננטיות של הסגנון.
        </p>
      </motion.div>
    </motion.div>
  );
};
