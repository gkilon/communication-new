
// הגדרה זו קובעת האם האפליקציה תעבוד במצב "מלא" (עם Firebase, הרשמה וניהול)
// או במצב "פשוט" (כמו הגרסה המקורית).

// פונקציה בטוחה לשליפת משתנים שלא תקרוס גם אם הסביבה לא מוגדרת כשורה
const getEnv = (): any => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env;
    }
  } catch (e) {
    // במקרה של שגיאה, נחזיר אובייקט ריק
  }
  return {};
};

const env = getEnv();

// בדיקה האם מפתח ה-API קיים ותקין (ולא רק דגל ההפעלה)
const apiKey = env.VITE_FIREBASE_API_KEY;
export const hasValidFirebaseConfig = !!apiKey && apiKey.length > 20 && !apiKey.includes("API_KEY");

// לוגיקה חכמה לבחירת מצב:
// אם בכתובת ה-URL מופיע ?mode=team, אנחנו נכנסים למצב ארגון בכל מקרה.
// אם אין קונפיגורציה תקינה, הקוד ב-App.tsx יציג מסך שגיאה מתאים.
const isTeamModeUrl = typeof window !== 'undefined' && window.location.search.includes('mode=team');

export const USE_FIREBASE_MODE = (env.VITE_FORCE_FIREBASE === 'true' || isTeamModeUrl);

// הדפסה לקונסול כדי שתוכל לראות איזה מצב נבחר כשאתה פותח את האתר (F12 -> Console)
console.log("------------------------------------------------");
console.log("App Configuration Loaded:");
console.log(`Mode Selected: ${USE_FIREBASE_MODE ? "🔥 Team/Full Version" : "⚡ Personal/Simple Version"}`);
console.log(`Firebase Config Valid: ${hasValidFirebaseConfig}`);
console.log("------------------------------------------------");
