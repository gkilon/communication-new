
import React, { useState, useRef, useEffect } from 'react';
import { Scores, BackgroundData } from '../types';
import { getAiCoachAdviceStream, translateText } from '../services/geminiService';
import { SparklesIcon } from './icons/Icons';

interface AiCoachProps {
  scores: Scores;
  backgroundData?: BackgroundData | null;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

const PRESET_QUESTIONS = [
  "איך אוכל לשפר את עבודת הצוות שלי?",
  "מה הדרך הטובה ביותר עבורי להשפיע על אחרים?",
  "תן לי טיפ להתמודדות עם קונפליקטים.",
  "כיצד אוכל למנף את החוזקות שלי כדי להתקדם?"
];

const AiMessageContent: React.FC<{ text: string }> = ({ text }) => {
  const [currentText, setCurrentText] = useState(text);
  const [currentLang, setCurrentLang] = useState<string>('HE');
  const [translations, setTranslations] = useState<Record<string, string>>({ 'HE': text });
  const [loadingLang, setLoadingLang] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    // When the original text changes (new message streaming finished), reset
    if (text !== translations['HE']) {
        setTranslations({ 'HE': text });
        setCurrentText(text);
        setCurrentLang('HE');
    }
  }, [text]);

  useEffect(() => {
    const renderMarkdown = () => {
      const marked = (window as any).marked;
      try {
        if (marked) {
          const parsed = typeof marked.parse === 'function' ? marked.parse(currentText) : (typeof marked === 'function' ? marked(currentText) : currentText);
          setHtmlContent(parsed);
        } else {
          setHtmlContent(currentText.replace(/\n/g, '<br />'));
        }
      } catch (error) {
        setHtmlContent(currentText.replace(/\n/g, '<br />'));
      }
    };
    renderMarkdown();
  }, [currentText]);

  const handleTranslate = async (lang: string, langName: string) => {
    if (lang === currentLang) return;
    if (translations[lang]) {
      setCurrentText(translations[lang]);
      setCurrentLang(lang);
      return;
    }

    setLoadingLang(lang);
    try {
      const translated = await translateText(text, langName);
      setTranslations(prev => ({ ...prev, [lang]: translated }));
      setCurrentText(translated);
      setCurrentLang(lang);
    } catch (error) {
      console.error("Translation fail:", error);
    } finally {
      setLoadingLang(null);
    }
  };

  const isRtl = currentLang === 'HE' || currentLang === 'AR';

  if (!text) return null;

  return (
    <div className="space-y-4">
      <div
        className={`prose prose-invert max-w-none prose-p:text-gray-200 prose-p:leading-relaxed prose-ul:text-gray-200 prose-li:text-gray-200 ${isRtl ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      
      <div className={`flex gap-1 pt-3 border-t border-white/5 no-print ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {[
          { id: 'HE', name: 'עברית', label: 'עב' },
          { id: 'EN', name: 'English', label: 'EN' },
          { id: 'RU', name: 'Русский', label: 'RU' },
          { id: 'AR', name: 'العربية', label: 'AR' }
        ].map(l => (
          <button
            key={l.id}
            onClick={() => handleTranslate(l.id, l.name)}
            disabled={loadingLang !== null}
            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all flex items-center justify-center min-w-[24px] ${
              currentLang === l.id 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {loadingLang === l.id ? (
              <div className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : l.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export const AiCoach: React.FC<AiCoachProps> = ({ scores, backgroundData }) => {
  const [userInput, setUserInput] = useState('');
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, isLoading]);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || userInput;
    if (!text.trim() || isLoading) return;

    const newUserMessage: Message = { sender: 'user', text };
    setConversation(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    // Add a placeholder for AI response
    setConversation(prev => [...prev, { sender: 'ai', text: '' }]);

    try {
      await getAiCoachAdviceStream(scores, text, (chunk) => {
        setConversation(prev => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (next[lastIdx] && next[lastIdx].sender === 'ai') {
                next[lastIdx] = { ...next[lastIdx], text: chunk };
            }
            return next;
        });
      });
    } catch (error: any) {
      console.error("AI Coach interaction failed:", error);
      setConversation(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.sender === 'ai' && !last.text) {
            last.text = "מצטער, חלה שגיאה בחיבור לשרת ה-AI. וודא שחיבור האינטרנט תקין ונסה שוב.";
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-cyan-500/20 p-2 rounded-xl">
          <SparklesIcon className="w-8 h-8 text-yellow-400" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">מאמן ה-AI האישי שלך</h3>
          <p className="text-gray-400 text-sm font-medium">ייעוץ מותאם אישית לפרופיל התקשורת שלך</p>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="bg-gray-900/80 rounded-2xl h-[440px] overflow-y-auto mb-6 border border-gray-700/50 p-6 shadow-inner scroll-smooth"
      >
        {conversation.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-dashed border-gray-700">
                <p className="text-gray-400 mb-4 font-medium italic">"היי! אני כאן כדי לעזור לך לרתום את החוזקות שלך. על מה נרצה לדבר היום?"</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESET_QUESTIONS.map((q, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSendMessage(q)} 
                      className="text-right text-sm bg-gray-800 hover:bg-gray-700 hover:text-cyan-400 text-gray-300 p-3 rounded-xl transition-all border border-gray-700 shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {conversation.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                  msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-cyan-700 to-blue-800 text-white rounded-tl-none' 
                  : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tr-none'
                }`}
              >
                {msg.sender === 'ai' ? (
                   <AiMessageContent text={msg.text} />
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          
           {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl rounded-tr-none">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <span className="text-xs text-gray-500 mr-2 font-bold uppercase tracking-wider">מעבד נתונים...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative group">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="כתוב את שאלתך כאן..."
          className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 pr-5 pl-20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all shadow-lg"
          disabled={isLoading}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={isLoading || !userInput.trim()}
          className="absolute left-2 top-2 bottom-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 rounded-xl transition-all disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-md"
        >
          {isLoading ? '...' : 'שלח'}
        </button>
      </div>
    </div>
  );
};
