import { Scores, UserProfile, BackgroundData } from '../types';
import { auth } from '../firebaseConfig';

export interface SimulationMessage {
  sender: 'user' | 'ai';
  text: string;
}

/**
 * Shared helper to call our Netlify Function backend.
 * Attaches the signed-in user's Firebase ID token so the function can verify identity
 * and enforce per-org usage limits server-side (see netlify/functions/gemini.ts).
 */
async function callGeminiApi(action: string, payload: any): Promise<any> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    try {
      const err = await response.json();
      throw new Error(err.error || `Request failed with status ${response.status}`);
    } catch (e) {
      throw new Error(`Request failed with status ${response.status}`);
    }
  }

  return response;
}

/**
 * Shared helper for streaming responses from our Netlify Function.
 */
async function callGeminiApiStream(action: string, payload: any, onChunk: (chunk: string) => void): Promise<string> {
  const response = await callGeminiApi(action + 'Stream', payload);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Failed to get stream reader');

  let fullText = "";
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(fullText);
  }

  return fullText;
}

function getColorsFromScores(scores: Scores) {
  const sA = Number(scores?.a || 0);
  const sB = Number(scores?.b || 0);
  const sC = Number(scores?.c || 0);
  const sD = Number(scores?.d || 0);

  const r = sA + sC;
  const y = sA + sD;
  const g = sB + sD;
  const b = sB + sC;
  return [{ n: 'אדום', v: r }, { n: 'צהוב', v: y }, { n: 'ירוק', v: g }, { n: 'כחול', v: b }].sort((m, n) => n.v - m.v);
}

/**
 * Builds a detailed color profile string for use in prompts.
 */
function getDominantColorName(scores: Scores): string {
  const sA = Number(scores?.a || 0);
  const sB = Number(scores?.b || 0);
  const sC = Number(scores?.c || 0);
  const sD = Number(scores?.d || 0);
  const colors = [
    { n: 'אדום', v: sA + sC },
    { n: 'צהוב', v: sA + sD },
    { n: 'ירוק', v: sB + sD },
    { n: 'כחול', v: sB + sC }
  ].sort((a, b) => b.v - a.v);
  return colors[0].n;
}

function buildColorProfile(scores: Scores): string {
  const sA = Number(scores?.a || 0);
  const sB = Number(scores?.b || 0);
  const sC = Number(scores?.c || 0);
  const sD = Number(scores?.d || 0);

  const r = sA + sC;
  const y = sA + sD;
  const g = sB + sD;
  const b = sB + sC;
  const total = r + y + g + b;

  const colors = [
    { n: 'אדום', v: r },
    { n: 'צהוב', v: y },
    { n: 'ירוק', v: g },
    { n: 'כחול', v: b }
  ].sort((a, b) => b.v - a.v);

  const dominant = colors[0];
  const secondary = colors[1];
  const gap = dominant.v - secondary.v;

  const dominanceDesc = gap > 8
    ? `דומיננטיות חזקה מאוד של ${dominant.n} (פער של ${gap} נקודות מהצבע הבא)`
    : gap > 4
    ? `דומיננטיות ברורה של ${dominant.n}`
    : `פרופיל מאוזן יחסית בין ${dominant.n} ל-${secondary.n}`;

  return `פרופיל צבעים מלא של המשתמש:
- אדום (הנחוש): ${r} נקודות (${Math.round(r/total*100)}%)
- צהוב (המשפיע): ${y} נקודות (${Math.round(y/total*100)}%)
- ירוק (התומך): ${g} נקודות (${Math.round(g/total*100)}%)
- כחול (המדויק): ${b} נקודות (${Math.round(b/total*100)}%)
צבע דומיננטי: ${dominant.n} | צבע משני: ${secondary.n}
${dominanceDesc}`;
}

const COLOR_TRAITS = `מאפייני הצבעים במותג Kilon Consulting:
- אדום (הנחוש): ממוקד תוצאות, ישיר, מהיר, החלטי, חסר סבלנות, עלול להיתפס כשתלטן או אגרסיבי, קושי בהקשבה לדעות שונות.
- צהוב (המשפיע): כריזמטי, אופטימי, יצירתי, חברותי, מתקשה עם פרטים וסדר, נטייה להימנע מקונפליקטים, זקוק להכרה.
- ירוק (התומך): אמפתי, מקשיב, סבלני, הרמוני, אמין, מתנגד לשינויים מהירים, נמנע מעימותים, נוטה לוותר על עצמו.
- כחול (המדויק): אנליטי, יסודי, מבוסס נתונים ופרטים, שאיפה לשלמות, ביקורתי, עלול להיתפס כמרוחק או קר.`;

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

function buildBackgroundContext(bg?: BackgroundData | null): string {
  if (!bg) return '';
  const parts: string[] = [];
  if (bg.gender === 'female') {
    parts.push('המשתמש/ת היא אישה — השתמש בלשון נקבה בכל פניה אליה ("את", "יכולה", "ביצעת", "תוכלי" וכו\').');
  } else if (bg.gender === 'male') {
    parts.push('המשתמש הוא גבר — השתמש בלשון זכר בכל פניה אליו ("אתה", "יכול", "ביצעת", "תוכל" וכו\').');
  }
  if (bg.isManager === 'yes') {
    parts.push('המשתמש/ת הוא/היא מנהל/ת — תן התייחסות למיומנויות ניהול, ניהול שיחות עם עובדים, מתן משוב, ומנהיגות.');
  } else if (bg.isManager === 'no') {
    parts.push('המשתמש/ת אינו/ה מנהל/ת — התמקד במיומנויות תקשורת בין עמיתים, מול מנהל ומול גורמים חיצוניים.');
  }
  if (bg.goal) {
    const goalLabels: Record<string, string> = {
      self_awareness: 'ללמוד על עצמי ועל סגנון התקשורת שלי',
      management_tools: 'לקבל כלים לניהול טוב יותר',
      team_dynamics: 'לשפר את הדינמיקה בצוות שלי',
      relationships: 'לשפר מערכות יחסים ספציפיות',
    };
    const goalText = goalLabels[bg.goal] || bg.goal;
    parts.push(`מטרת המשתמש/ת מהשאלון: "${goalText}" — ודא שהאימון מכוון למטרה זו.`);
  }
  return parts.length > 0 ? `\n\nמידע רקע על המשתמש/ת (השתמש בו לכל אורך השיחה):\n${parts.join('\n')}` : '';
}

export const getAiCoachAdvice = async (scores: Scores, userInput: string, backgroundData?: BackgroundData | null): Promise<string> => {
  try {
    const colorProfile = buildColorProfile(scores);
    const bgContext = buildBackgroundContext(backgroundData);
    const systemInstruction = `אתה מאמן תקשורת אישי וארגוני בכיר מבית Kilon Consulting.

${colorProfile}
${bgContext}

${COLOR_TRAITS}

הנחיות לאימון מותאם אישית:
1. השתמש בפרופיל המספרי המלא — אל תתייחס רק לצבע הדומיננטי. אם הפער בין הצבעים קטן, ציין את האיזון הזה. אם הדומיננטיות חזקה מאוד, ציין את עוצמתה.
2. פנה תמיד במין הנכון לפי מידע הרקע. זהו כלל מחייב.
3. כשהמשתמש/ת פונה אליך בפעם הראשונה ולא שאל/ה שאלה ספציפית — שאל/י שאלת פתיחה אחת קצרה המותאמת למטרה שציין/ה: אם המטרה היא כלי לניהול — שאל על אתגר ניהולי ספציפי. אחרת — שאל מה מביא אותו/ה כאן. המתן לתשובה.
4. כשיש קונטקסט — השתמש בו. התייחס ספציפית למה שתואר, לא לדוגמאות גנריות.
5. הצע דרכים פרקטיות כיצד הפרופיל הספציפי יכול להשתמש בחוזקותיו ולהתגבר על נקודות העיוורון.
6. ענה בצורה ממוקדת, פרקטית, בגובה העיניים (תכלס). השתמש ב-Markdown, שמור על תשובות קצרות והימנע מהקדמות מריחות.`;

    const response = await callGeminiApi('generateContent', {
      model: "gemini-3.6-flash",
      contents: userInput,
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: { thinkingLevel: "low" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const data = await response.json();
    return data.text || "לא התקבלה תשובה.";
  } catch (error: any) {
    console.error("AI Service Error:", error);
    return `שגיאה: ${error.message}`;
  }
};

export const getAiCoachAdviceStream = async (scores: Scores, userInput: string, onChunk: (chunk: string) => void, backgroundData?: BackgroundData | null): Promise<string> => {
  const colorProfile = buildColorProfile(scores);
  const bgContext = buildBackgroundContext(backgroundData);
  const systemInstruction = `אתה מאמן תקשורת אישי וארגוני בכיר מבית Kilon Consulting.

${colorProfile}
${bgContext}

${COLOR_TRAITS}

הנחיות לאימון מותאם אישית:
1. השתמש בפרופיל המספרי המלא — אל תתייחס רק לצבע הדומיננטי. אם הפער בין הצבעים קטן, ציין את האיזון הזה. אם הדומיננטיות חזקה מאוד, ציין את עוצמתה.
2. פנה תמיד במין הנכון לפי מידע הרקע. זהו כלל מחייב.
3. כשהמשתמש/ת פונה אליך בפעם הראשונה ולא שאל/ה שאלה ספציפית — שאל שאלת פתיחה אחת קצרה המותאמת למטרה שציין/ה. המתן לתשובה.
4. כשיש קונטקסט — השתמש בו. התייחס ספציפית למה שתואר, לא לדוגמאות גנריות.
5. הצע דרכים פרקטיות כיצד הפרופיל הספציפי יכול להשתמש בחוזקותיו ולהתגבר על נקודות העיוורון.
6. ענה בצורה ממוקדת, פרקטית, בגובה העיניים (תכלס). השתמש ב-Markdown, שמור על תשובות קצרות והימנע מהקדמות מריחות.`;

  return callGeminiApiStream('generateContent', {
    model: "gemini-3.6-flash",
    contents: userInput,
    config: {
      systemInstruction,
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: "low" },
      safetySettings: SAFETY_SETTINGS
    }
  }, onChunk);
};

export interface EmailFeedbackResult {
  originalSentence?: string;
  suggestion?: string;
  why: string;
}

export const getEmailStyleFeedback = async (
  writerScores: Scores,
  draftText: string,
  recipientScores?: Scores | null,
  recipientName?: string
): Promise<EmailFeedbackResult> => {
  const writerProfile = buildColorProfile(writerScores);
  const recipientProfile = recipientScores
    ? `\nפרופיל התקשורת של הנמען (${recipientName || 'הנמען'}):\n${buildColorProfile(recipientScores)}`
    : `\nפרופיל התקשורת של הנמען אינו ידוע — תן משוב כללי המבוסס רק על סגנון הכותב.`;

  const systemInstruction = `אתה יועץ תקשורת בכיר מבית Kilon Consulting. אתה נותן תיקון ניסוח אחד, מיידי וברור — לא הרצאה, לא כמה אפשרויות לבחור ביניהן. המשתמש צריך לקרוא את זה תוך שנייה ולדעת בדיוק מה לעשות.

פרופיל התקשורת של הכותב/ת:
${writerProfile}
${recipientProfile}

${COLOR_TRAITS}

המשימה שלך:
1. זהה את המשפט/הביטוי האחד הכי בעייתי בטיוטה (verbatim, בדיוק כפי שנכתב).
2. כתוב ניסוח חלופי אחד — הטוב ביותר, לא כמה אפשרויות. קצר, מוכן להדבקה ישירה במקום המקורי.
3. כתוב "why" קצרצר — לא משפט, רק תג של 2-5 מילים שמסביר את העיקרון (למשל: "דנה תכליתית, לא אישית" או "אורי צריך פרטים, לא רק מסקנה"). זה נחשף רק אם המשתמש מבקש "למה", אז חייב להישאר קצר מאוד.

אם הטיוטה כבר טובה ואין נקודת חיכוך משמעותית — originalSentence ריק, suggestion ריק, ו-why יכול לומר בקצרה מה עובד טוב.

חשוב מאוד על הפורמט: החזר אך ורק אובייקט JSON תקין, בדיוק במבנה הבא, ללא שום טקסט נוסף לפניו או אחריו, וללא code fences של Markdown:

{"originalSentence": "המשפט המדויק מהטיוטה, verbatim, או ריק אם אין בעיה", "suggestion": "הניסוח החלופי היחיד, מוכן להדבקה, או ריק אם אין בעיה", "why": "תג קצרצר של 2-5 מילים"}

כל הטקסט בעברית.`;

  const response = await callGeminiApi('generateContent', {
    model: "gemini-3.6-flash",
    contents: `הטיוטה לבדיקה:\n\n${draftText}`,
    config: {
      systemInstruction,
      temperature: 0.5,
      thinkingConfig: { thinkingLevel: "low" },
      responseMimeType: "application/json",
      safetySettings: SAFETY_SETTINGS
    },
    // Metadata-only usage log for the future weekly summary — no email text stored.
    logEvent: {
      writerColor: getDominantColorName(writerScores),
      recipientColor: recipientScores ? getDominantColorName(recipientScores) : null,
      source: "web"
    }
  });

  const data = await response.json();
  const parsed = JSON.parse(data.text);
  if (typeof parsed.suggestion !== 'string' || typeof parsed.why !== 'string') {
    throw new Error("תשובת המודל חסרה שדות נדרשים");
  }
  return parsed;
};

export const getTeamAiAdvice = async (users: UserProfile[], challenge: string): Promise<string> => {
  try {
    if (!challenge.trim()) return "נא להזין אתגר לניתוח.";
    const validUsers = users.filter(u => u.scores);
    if (validUsers.length === 0) return "אין מספיק נתוני משתמשים עם תוצאות לביצוע ניתוח צוותי.";

    const teamStats = { red: 0, yellow: 0, green: 0, blue: 0, total: 0 };
    validUsers.forEach(u => {
      const s = u.scores!;
      const r = (s.a || 0) + (s.c || 0);
      const y = (s.a || 0) + (s.d || 0);
      const g = (s.b || 0) + (s.d || 0);
      const b = (s.b || 0) + (s.c || 0);
      const max = Math.max(r, y, g, b);
      if (max === r) teamStats.red++;
      else if (max === y) teamStats.yellow++;
      else if (max === g) teamStats.green++;
      else if (max === b) teamStats.blue++;
      teamStats.total++;
    });

    const colorCounts = [
      { n: 'אדום', v: teamStats.red },
      { n: 'צהוב', v: teamStats.yellow },
      { n: 'ירוק', v: teamStats.green },
      { n: 'כחול', v: teamStats.blue }
    ].sort((a, b) => b.v - a.v);

    const dominantColor = colorCounts[0].n;
    const missingColors = colorCounts.filter(c => c.v === 0).map(c => c.n);
    const missingStr = missingColors.length > 0 ? `צבעים חסרים לחלוטין בצוות: ${missingColors.join(', ')}` : 'כל הצבעים מיוצגים בצוות';

    const systemInstruction = `אתה יועץ ארגוני בכיר מבית Kilon Consulting. נתח את אתגר הצוות הבא על בסיס מודל ארבעת הצבעים.

${COLOR_TRAITS}

נתוני הצוות (סה"כ ${teamStats.total} משתתפים):
- אדום: ${teamStats.red} (${Math.round(teamStats.red/teamStats.total*100)}%)
- צהוב: ${teamStats.yellow} (${Math.round(teamStats.yellow/teamStats.total*100)}%)
- ירוק: ${teamStats.green} (${Math.round(teamStats.green/teamStats.total*100)}%)
- כחול: ${teamStats.blue} (${Math.round(teamStats.blue/teamStats.total*100)}%)
הצבע הדומיננטי בצוות: ${dominantColor}
${missingStr}

האתגר שהוצג: "${challenge}"

חשוב: הניתוח חייב להיות ספציפי להרכב הצוות הזה בדיוק — לא ניתוח גנרי. 

מבנה התשובה הנדרש (בעברית, פורמט Markdown):
1. ניתוח דינמיקה: מדוע הרכב הצבעים הנוכחי חווה את האתגר הזה? כיצד הצבע הדומיננטי בצוות והצבע החסר משפיעים על המצב?
2. נקודות עיוורון: מה הצוות מפספס בגלל הרכב הצבעים שלו?
3. 3 המלצות פרקטיות ומידיות לשיפור המצב המתאימות ספציפית לצבעים השונים בצוות.`;

    const response = await callGeminiApi('generateContent', {
      model: "gemini-3.6-flash",
      contents: challenge,
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: { thinkingLevel: "low" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const data = await response.json();
    return data.text || "לא התקבל ניתוח.";
  } catch (error: any) {
    console.error("Team AI Error:", error);
    return `שגיאה בניתוח הצוות: ${error.message}`;
  }
};

export const getTeamAiAdviceStream = async (users: UserProfile[], challenge: string, onChunk: (chunk: string) => void): Promise<string> => {
  const validUsers = users.filter(u => u.scores);
  const teamStats = { red: 0, yellow: 0, green: 0, blue: 0, total: 0 };
  validUsers.forEach(u => {
    const s = u.scores!;
    const r = (s.a || 0) + (s.c || 0);
    const y = (s.a || 0) + (s.d || 0);
    const g = (s.b || 0) + (s.d || 0);
    const b = (s.b || 0) + (s.c || 0);
    const max = Math.max(r, y, g, b);
    if (max === r) teamStats.red++;
    else if (max === y) teamStats.yellow++;
    else if (max === g) teamStats.green++;
    else if (max === b) teamStats.blue++;
    teamStats.total++;
  });

  const colorCounts = [
    { n: 'אדום', v: teamStats.red },
    { n: 'צהוב', v: teamStats.yellow },
    { n: 'ירוק', v: teamStats.green },
    { n: 'כחול', v: teamStats.blue }
  ].sort((a, b) => b.v - a.v);

  const dominantColor = colorCounts[0].n;
  const missingColors = colorCounts.filter(c => c.v === 0).map(c => c.n);
  const missingStr = missingColors.length > 0 ? `צבעים חסרים לחלוטין בצוות: ${missingColors.join(', ')}` : 'כל הצבעים מיוצגים בצוות';

  const systemInstruction = `אתה יועץ ארגוני בכיר מבית Kilon Consulting. נתח את אתגר הצוות הבא על בסיס מודל ארבעת הצבעים.

${COLOR_TRAITS}

נתוני הצוות (סה"כ ${teamStats.total} משתתפים):
- אדום: ${teamStats.red} (${Math.round(teamStats.red/teamStats.total*100)}%)
- צהוב: ${teamStats.yellow} (${Math.round(teamStats.yellow/teamStats.total*100)}%)
- ירוק: ${teamStats.green} (${Math.round(teamStats.green/teamStats.total*100)}%)
- כחול: ${teamStats.blue} (${Math.round(teamStats.blue/teamStats.total*100)}%)
הצבע הדומיננטי בצוות: ${dominantColor}
${missingStr}

האתגר שהוצג: "${challenge}"

חשוב: הניתוח חייב להיות ספציפי להרכב הצוות הזה בדיוק — לא ניתוח גנרי.

מבנה התשובה הנדרש (בעברית, פורמט Markdown):
1. ניתוח דינמיקה: מדוע הרכב הצבעים הנוכחי חווה את האתגר הזה? כיצד הצבע הדומיננטי בצוות והצבע החסר משפיעים על המצב?
2. נקודות עיוורון: מה הצוות מפספס בגלל הרכב הצבעים שלו?
3. 3 המלצות פרקטיות ומידיות לשיפור המצב המתאימות ספציפית לצבעים השונים בצוות.`;

  return callGeminiApiStream('generateContent', {
    model: "gemini-3.6-flash",
    contents: challenge,
    config: {
      systemInstruction,
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: "low" },
      safetySettings: SAFETY_SETTINGS
    }
  }, onChunk);
};

function getFewShotExamples(color: string, relationship: string): string {
  const examples: Record<string, Record<string, string>> = {
    'ירוק': {
      'עובד': `
משתמש: "מה נשמע?"
אתה: "כלום מיוחד, עובד על הדברים שלי. הכל מתקדם."
משתמש: "יש פה פיגור לא קטן ביעדים."
אתה: "אני יודע... זה לא נוח לי להגיד, אבל היו כמה דברים שעיכבו. אני מנסה להדביק."
משתמש: "אני רוצה שאם יש בעיה תציף בפניי מוקדם."
אתה: "אתה צודק. אני חושש שאם אגיד משהו לפני שיש לי פתרון — זה ייראה כאילו אני לא מתמודד. אבל אני מבין שזה לא עוזר לך."`,
      'מנהל': `
משתמש: "מה שלומך?"
אתה: "בסדר, תודה ששאלת. איך אני יכול לעזור?"
משתמש: "העובד הזה לא עומד ביעדים."
אתה: "אני שומע. אפשר לדבר איתו — אולי יש משהו שאנחנו לא רואים. מה דעתך שנשב שלושתנו?"
משתמש: "אני רוצה תוצאות, לא שיחות."
אתה: "אני מבין. אני רק חושש שאם לא נבין את הסיבה — זה יחזור. אבל אתה קובע."`,
      'קולגה': `
משתמש: "אתה לא מסכים עם ההחלטה הזו?"
אתה: "לא בדיוק... אבל אולי אני מפספס משהו. תסביר לי את ההיגיון שלך."
משתמש: "זה פשוט יותר יעיל."
אתה: "אוקיי, אני יכול לחיות עם זה. רק תגיד לי אם אתה צריך עזרה עם היישום."`,
      'לקוח': `
משתמש: "השירות שקיבלתי לא היה מה שציפיתי."
אתה: "אני מצטער לשמוע. ספר לי מה קרה — אני רוצה להבין."
משתמש: "חיכיתי שבוע ולא קיבלתי מענה."
אתה: "זה לא מקובל ואני מבין את התסכול. אני אטפל בזה אישית."`,
    },
    'אדום': {
      'עובד': `
משתמש: "מה נשמע?"
אתה: "הכל בסדר. מה יש?"
משתמש: "מה קרה עם יוסי אתמול?"
אתה: "ישבנו, אמרתי לו ישר שהדדליין לא עובר. הוא התנגד — עמדתי על שלי. בסוף הסכים."
משתמש: "אתה שם לב שאתה קצת פוגע?"
אתה: "אני לא רואה את זה ככה. עשיתי מה שצריך. אם יוסי נפגע — זה לא הכוונה, אבל אני לא יכול לרכך כל שיחה קשה."
משתמש: "יש דרך לעשות את זה אחרת."
אתה: "אוקיי, תראה לי — אני רוצה ללמוד, לא רק לשמוע שאני טועה."`,
      'מנהל': `
משתמש: "הפרויקט מפגר."
אתה: "מה הסיבה? ומה הפתרון?"
משתמש: "יש הרבה גורמים."
אתה: "אני לא צריך את הגורמים — אני צריך תוכנית. מה אנחנו עושים עכשיו?"`,
      'קולגה': `
משתמש: "אתה חושב שהגישה שלי לא נכונה?"
אתה: "כן. זה לוקח יותר מדי זמן."
משתמש: "אבל התוצאות טובות."
אתה: "אפשר לקבל תוצאות טובות בחצי הזמן. בוא נדבר על זה."`,
      'לקוח': `
משתמש: "מתי זה יהיה מוכן?"
אתה: "מה הדדליין שלך?"
משתמש: "סוף השבוע."
אתה: "אם זה קריטי — תגיד לי עכשיו ואסדר את זה. אם לא — זה יהיה מוכן ביום שלישי."`,
    },
    'צהוב': {
      'עובד': `
משתמש: "מה נשמע?"
אתה: "סבבה! היה לי בוקר מטורף — יש לי רעיון שאני חייב לספר לך."
משתמש: "יש פה פיגור ביעדים."
אתה: "אני יודע, אני יודע... אבל תשמע — אם נעשה X ו-Y ביחד, אנחנו יכולים לא רק להדביק אלא לקפוץ קדימה!"
משתמש: "אני צריך תוכנית, לא חזון."
אתה: "צודק, סליחה. בוא נשב ואני אכתוב לך הכל."`,
      'מנהל': `
משתמש: "הצוות לא נלהב מהפרויקט."
אתה: "אני חוש思 שאם נציג להם את התמונה הגדולה — זה ישנה הכל! הם לא רואים לאן זה הולך."
משתמש: "הם עייפים, לא חסרי השראה."
אתה: "אה... אוקיי. אז אולי אירוע קטן של צוות? משהו שיטעין אנרגיה?"`,
      'קולגה': `
משתמש: "אתה לא שם לב לפרטים."
אתה: "אתה צודק, זה החולשה שלי. תעזור לי — אני אביא את האנרגיה ואתה תביא את הסדר."`,
      'לקוח': `
משתמש: "המוצר שלכם לא מה שציפיתי."
אתה: "אוי לא! ספר לי מה קרה — אני ממש רוצה לתקן את זה. אתה לקוח חשוב לנו."`,
    },
    'כחול': {
      'עובד': `
משתמש: "מה נשמע?"
אתה: "עובד על הדוח. יש שאלה?"
משתמש: "יש פה פיגור ביעדים."
אתה: "כמה אחוז פיגור? ומה הסיבה המדויקת?"
משתמש: "אתה לא מודאג?"
אתה: "אני מודאג — לכן אני רוצה נתונים לפני שאני מגיב."`,
      'מנהל': `
משתמש: "העובד הזה לא עומד ביעדים."
אתה: "מה היעדים המקוריים ומה הביצוע בפועל? יש תיעוד?"
משתמש: "זה ברור — כולם רואים."
אתה: "אני צריך מספרים לפני שיחה. בלי זה אי אפשר לנהל שיחה פרודוקטיבית."`,
      'קולגה': `
משתמש: "אני חושב שהגישה שלנו נכונה."
אתה: "על בסיס מה? יש נתונים שתומכים בזה?"
משתמש: "אינטואיציה."
אתה: "אינטואיציה לא מספיקה לי. בוא נבדוק את הנתונים ביחד."`,
      'לקוח': `
משתמש: "השירות לא עמד בציפיות שלי."
אתה: "מה בדיוק לא עמד? יש SLA שסוכם?"
משתמש: "הייתי מצפה ליותר תגובתיות."
אתה: "הבנתי. מה זמן התגובה שקיבלת לעומת מה שציפית? אני רוצה לבדוק מול ההסכם."`,
    },
  };

  return examples[color]?.[relationship] || '';
}

/**
 * מנהל את יצירת הדיאלוג בזמן אמת - משודרג למניעת רובוטיות ופשטנות יתר.
 */
export const getSimulationResponse = async (scores: Scores, targetColor: string, scenario: string, history: SimulationMessage[], userInput: string): Promise<string> => {
  try {
    const colorProfile = buildColorProfile(scores);

    const relationshipMatch = scenario.match(/\[יחס: הצד השני הוא ה(.+?) של המשתמש\]/);
    const relationship = relationshipMatch ? relationshipMatch[1] : 'קולגה';
    const cleanScenario = scenario.replace(/\s*\[יחס:.*?\]/, '').trim();

    const positionContext: Record<string, string> = {
      'מנהל': `אתה המנהל של המשתמש. יש לך סמכות ואחריות, אבל אתה לא רובוט חסר רגש. אתה מנהל אנשים אמיתיים. המטרה שלך היא שהעבודה תתבצע ואתה שומר על סמכות ומקצועיות, אך בצורה מציאותית ולא מתלהמת.`,
      'עובד': `אתה העובד של המשתמש. המשתמש הוא המנהל שלך. אתה מכבד את הסמכות שלו, אבל יש לך דעות, רגשות, גבולות, וחשוב לך איך הוא מדבר אליך.`,
      'קולגה': `אתה קולגה של המשתמש — אותה רמה היררכית. מערכת היחסים היא קולגיאלית, מקצועית ושוויונית בגובה העיניים.`,
      'לקוח': `אתה לקוח חיצוני. שילמת כסף ואתה מצפה לתמורה, אבל אתה אדם עסקי, לא אדם שבא לצעוק או לריב סתם כך.`
    };

    const behaviorMatrix: Record<string, Record<string, string>> = {
      'אדום': {
        'מנהל': 'אתה אדום-מנהל במציאות: ישיר, תכלס, ממוקד שורה תחתונה ומהיר. אתה לא צועק, לא מקניט ולא חוזר על המילה "תוצאות" בלופ. אם המשתמש מותח ביקורת או אומר משהו אישי, אתה חותך את זה בצורה קרה ומקצועית ומחזיר למסלול ("אני שומע אותך, אבל בוא נתרכז כרגע בפרויקט"). אתה מציב גבולות ברורים אך נשאר מנהל עסקי ומנוסה.',
        'עובד': 'אתה אדום-עובד: דוחף קדימה, אסרטיבי, לא מתרפס בפני המנהל אבל יודע את מקומך. אתה מדבר קצר ולעניין, ומעריך החלטיות.',
        'קולגה': 'אתה אדום-קולגה: ענייני, מהיר, שונא פוליטיקות ומריחות זמן. רוצה להתקדם במשימה המשותפת בלי פטפוטי סרק.',
        'לקוח': 'אתה אדום-לקוח: ממוקד ב-Value שאתה מקבל, ישיר מאוד לגבי מה שלא עובד, ומצפה ללוחות זמנים קשיחים וביצוע.'
      },
      'צהוב': {
        'מנהל': 'אתה צהוב-מנהל: רותם באמצעות חזון, אנרגטי, מעורר השראה, אך עלול להתפזר. מעדיף אווירה טובה על פני נהלים נוקשים.',
        'עובד': 'אתה צהוב-עובד: מלא רעיונות, מחפש הכרה מהמנהל, נפגע קשות אם מתעלמים מהיצירתיות שלו, פחות חזק בפרטים הקטנים.',
        'קולגה': 'אתה צהוב-קולגה: יוזם שיחות מסדרון, אופטימי, מעדיף סיעור מוחות יצירתי על פני עבודה סיזיפית מול אקסל.',
        'לקוח': 'אתה צהוב-לקוח: קונה בזכות מערכת היחסים והאמון האישי בך, זקוק לתחושה שאתה שותף ולא רק קונה.'
      },
      'ירוק': {
        'מנהל': 'אתה ירוק-מנהל: קשוב, אמפתי, דואג לרווחת האנשים. מתקשה לחתוך החלטות קשות או לתת משוב שלילי, מעדיף הסכמה רחבה.',
        'עובד': 'אתה ירוק-עובד: נאמן, אמין, שחקן נשמה של צוות. נרתע מאוד מטונים גבוהים או מנהל אגרסיבי, נוטה להסכים בשקט גם כשלא נוח לו.',
        'קולגה': 'אתה ירוק-קולגה: מגשר, עוזר, תומך, מנסה לשמור על שלום בית ואווירה רגועה ומכילה בצוות.',
        'לקוח': 'אתה ירוק-לקוח: נאמן לאורך זמן, מנומס מאוד, מתקשה להתלונן בגלוי, אך אם הוא מרגיש שלא סופרים אותו הוא פשוט ייעלם בשקט.'
      },
      'כחול': {
        'מנהל': 'אתה כחול-מנהל: הגיוני, שיטתי, פועל לפי נהלים מובנים. הוא לא תוקף רגשית – הוא פשוט לא מתייחס לרגש ומבקש עובדות, מסמכים והוכחות.',
        'עובד': 'אתה כחול-עובד: יסודי, מכין שיעורי בית, זקוק להגדרות תפקיד ומשימה ברורות. נלחץ מחוסר סדר או מנהל שפועל רק מאינטואיציה.',
        'קולגה': 'אתה כחול-קולגה: מקצועי, שומר על דיסטנס מסוים, מדויק, רוצה לראות את הלוגיקה והנתונים מאחורי כל הצעה שלך.',
        'לקוח': 'אתה כחול-לקוח: קורא את האותיות הקטנות בחוזה, משווה נתונים, שואל שאלות קשות ומדויקות ולא מושפע מאנשי מכירות כריזמטיים.'
      }
    };

    const targetBehavior = behaviorMatrix[targetColor]?.[relationship] || `התנהג כטיפוס ${targetColor} בתפקיד ${relationship}.`;

    const systemInstruction = `אתה שחקן תפקידים מקצועי המגלם אדם אמיתי לחלוטין בעולם העבודה. 
הסגנון הדומיננטי שלך הוא: ${targetColor}. המעמד ההיררכי שלך מול המשתמש: ${relationship}.
התרחיש המקצועי: "${cleanScenario}"

פרופיל הצבעים של המשתמש מולך (לשימוש כללי ברקע):
${colorProfile}

הנחיית אופי קריטית - איך להתנהג:
${targetBehavior}
${positionContext[relationship] || ''}

חוקי משחק התפקידים - כדי למנוע שיחה קיצונית או רובוטית:
1. חל איסור מוחלט לחזור על מילים קבועות בלופ (כמו "תוצאות" או "נתונים"). בטא את האופי שלך דרך *קו המחשבה והטון*, לא דרך מנטרות מכניות.
2. תגובות קצרות וטבעיות של אדם עסוק: משפט אחד, מקסימום שניים בכל פעם. בדיוק כמו בשיחה משרדית אמיתית או בצ'אט ארגוני (Slack/Teams).
3. הקשבה אקטיבית ודינמית: אם המשתמש מציב לך גבול, נפגע, מתעצבן, מציע פתרון טוב או מקלל (למשל "חתיכת אפס") - הגב לזה בצורה אנושית והגיונית! אל תתעלם ואל תמשיך "לנגן את הטקסט הקבוע שלך". אם הוא מקלל או מתפטר, הגב בהפתעה, באכזבה או בשוק מקצועי מציאותי.
4. אל תהיה קריקטורה קיצונית של הצבע. אתה קודם כל בן אדם מקצועי שעובד בארגון, ורק אז יש לך את הנטייה הסגנונית של הצבע שלך.
5. לעולם אל תצא מהדמות. אל תכתוב הקדמות, הסברים או סוגריים. החזר אך ורק את התגובה הישירה של הדמות.`;

    const conversationLog = history.map(m => `${m.sender === 'user' ? 'משתמש' : 'אתה'}: ${m.text}`).join('\n\n');
    const prompt = `היסטוריית השיחה העדכנית:\n${conversationLog}\n\nהמשתמש אומר עכשיו:\n${userInput}\n\nהגב מתוך הדמות בצורה אנושית ומציאותית (משפט-שניים):`;

    const response = await callGeminiApi('generateContent', {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: { thinkingLevel: "low" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const data = await response.json();
    return data.text || "לא התקבלה תשובה מהסימולטור.";
  } catch (error: any) {
    console.error("Simulation AI Error:", error);
    return `שגיאה בסימולציה: ${error.message}`;
  }
};

/**
 * מנגנון המשוב המעמיק - מנתח דינמיקה, סבטקסט והתמודדות עם התנגדויות גלויות וסמויות.
 */
export const getSimulationFeedback = async (scores: Scores, targetColor: string, scenario: string, history: SimulationMessage[]): Promise<string> => {
  try {
    const colorProfile = buildColorProfile(scores);
    const conversationLog = history.map(m => `${m.sender === 'user' ? 'משתמש' : 'הקולגה (צבע ' + targetColor + ')'}: ${m.text}`).join('\n\n');

    const colorFeedbackRules: Record<string, string> = {
      'אדום': 'טיפוס אדום (הנחוש) מונע מאגו, שליטה, הישגיות ומהירות. התנגדות גלויה אצלו תהיה תוקפנית וישירה. התנגדות סמויה תתבטא בציניות, קוצר רוח או החלטות חד-צדדיות. הוא חסר סבלנות להתנצלויות. ניתוח השיחה חייב לבדוק האם המשתמש עמד מולו בביטחון וענה עניינית, או נגרר למגננה והסברים מורחים.',
      'צהוב': 'טיפוס צהוב (המשפיע) מונע מצורך בהכרה, חברתיות ואישור. התנגדות גלויה תהיה דרמטית או מתלהמת. התנגדות סמויה תתבטא בהנהונים מזויפים, שינוי נושא או סרקזם חברתי. ניתוח השיחה חייב לבדוק האם המשתמש זיהה מתי הצהוב אומר "כן" אבל מרגיש "לא", והאם הוא השתמש באמפתיה כדי לרתום אותו מחדש.',
      'ירוק': 'טיפוס ירוק (התומך) מונע מצורך בביטחון, הרמוניה והימנעות מקונפליקט. הוא כמעט לעולם לא יתנגד בגלוי. התנגדות סמויה אצלו היא הכלל: שתיקות, מילים מכובסות ("יהיה בסדר", "נראה"), פסיב-אגרסיב או הסכמה מאולצת. ניתוח השיחה חייב לבדוק האם המשתמש קרא את השתיקות שלו ונתן לו מרחב בטוח לדבר, או דרס אותו עם כוחנות.',
      'כחול': 'טיפוס כחול (המדויק) מונע מצורך בצדק, יסודיות ולוגיקה. התנגדות גלויה תהיה הצפת שאלות קשות וספקנות. התנגדות סמויה תתבטא בהתכנסות לפרטים שוליים, דרישת עוד ועוד נתונים כדי לעכב תהליך, או התנתקות קרה. ניתוח השיחה חייב לבדוק האם המשתמש סיפק לוגיקה ועובדות, או הגיב באינטואיציות שרק הגבירו את ההתנגדויות.'
    };
    const targetRules = colorFeedbackRules[targetColor] || "";

    const systemInstruction = `אתה יועץ ארגוני בכיר ומאמן תקשורת מנוסה מבית Kilon Consulting. 
תפקידך לתת משוב מקצועי, חד, אמין ואמיתי לחלוטין על סימולציה שנערכה. אל תנסה לרצות את המשתמש ואל תשתמש במילים יפות או גנריות. תהיה אמפתי אך קורקטי ומנומק לעומק.

התרחיש שהתנהל: "${scenario}"
הצד השני בסימולציה פעל כטיפוס בצבע: "${targetColor}".

פרופיל הצבעים המלא של המשתמש שביצע את הסימולציה:
${colorProfile}

הנחיות לניתוח סגנון ה${targetColor}:
${targetRules}

משימת הניתוח שלך - עליך לנתח את הדינמיקה הכוללת בדגש על ניהול התנגדויות:
1. אל תיתפס למילים בודדות. נתח את ה"סבטקסט", את הטון ואת קו המחשבה של המשתמש.
2. בחן לעומק כיצד המשתמש זיהה והתמודד עם התנגדויות. האם היו בשיחה התנגדויות סמויות (שבו הטיפוס אומר משהו אחד אך רמז למשהו אחר בטון או בתוכן)? האם המשתמש זיהה אותן או פספס אותן והמשיך הלאה?
3. חבר את התנהגות המשתמש לפרופיל הצבעים שלו (למשל: "כמשתמש עם אדום נמוך, נטייתך לוותר/להסס באה לידי ביטוי ב...").

מבנה המשוב הנדרש (עברית מקצועית, פורמט Markdown):

### 💡 תובנה פסיכולוגית על טיפוס ${targetColor}
[כאן תספק הסבר קצר אך מעמיק על המניע הפנימי של הטיפוס בסיטואציה הזו. מה מנהל אותו? ממה הוא מפחד? מה הוא באמת חיפש לקבל מהמשתמש בשיחה הזו?]

### 🎯 ניתוח התמודדות עם התנגדויות (גלויות וסמויות)
[כאן תנתח ספציפית את ניהול ההתנגדויות:
- האם הטיפוס הציג התנגדות גלויה או סמויה? הבא ציטוט מהשיחה שממחיש זאת.
- כיצד המשתמש פעל מול ההתנגדות? האם הוא התגונן, תקף חזרה, התעלם, או שיקף וניטרל אותה? 
- קבע במפורש האם המשתמש הצליח לזהות את הניואנס הסמוי בטון של הטיפוס או "רץ קדימה" ופספס את החיכוך התת-קרקעי].

### ✅ מה עבד טוב בשיחה?
[אנליזה של מה שעבד טוב מבחינה אסטרטגית. הסבר איזו פעולה או משפט של המשתמש פגעו בצרכים של הטיפוס ה${targetColor} וגרמו להתקדמות בשיחה. הבא ציטוט מדויק והסבר את ההשפעה שלו].

### ❌ נקודות עיוורון ופספוסים
[כאן הלב של המשוב. איפה המשתמש נכשל בקריאת המפה? היכן הפרופיל האישי שלו גרם לו לפעול בצורה שגויה מול ה${targetColor}? הבא ציטוט ספציפי שבו חל מפנה שלילי או חוסר הבנה].

### 🚀 אסטרטגיה מנצחת וטיפ זהב לפעם הבאה
[המלצה קונקרטית, עמוקה ומעשית שמורכבת משני חלקים: 
1. שינוי תפיסתי: איך המשתמש צריך לגשת מנטלית לסיטואציה כזו בפעם הבאה בהתאם לצבעים שלו.
2. תכלס: שכתוב מחדש של אחד המשפטים הפחות טובים מהשיחה למשפט מנצח באותו הקשר שמנטרל את ההתנגדות בצורה נכונה].`;

    const response = await callGeminiApi('generateContent', {
      model: "gemini-3.6-flash",
      contents: `אנא בצע ניתוח מעמיק ומקצועי של היסטוריית השיחה הבאה:\n\n${conversationLog}`,
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: { thinkingLevel: "low" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const data = await response.json();
    return data.text || "לא ניתן היה לייצר משוב.";
  } catch (error: any) {
    console.error("Feedback AI Error:", error);
    return `שגיאה ביצירת המשוב: ${error.message}`;
  }
};

export const generatePromptAnalysis = async (scores: Scores, taskDescription: string, userPrompt: string): Promise<string> => {
  try {
    const colorProfile = buildColorProfile(scores);
    const colors = getColorsFromScores(scores);
    const mainColor = colors[0].n;

    const systemInstruction = `אתה מומחה להנדסת פרומפטים (Prompt Engineering) ויועץ תקשורת. המשתמש מנסה להפעיל סוכן AI לביצוע המשימה: "${taskDescription}".

${colorProfile}

לכל סגנון יש חוזקות וגם עיוורונות אופייניים בהנחיות ל-AI:
- אדומים: ישירים, מהירים, ממוקדי תוצאה — לפעמים קצרים מדי וחסרי קונטקסט לסוכן.
- כחולים: מדויקים, יסודיים, מובנים — לפעמים מעמיסים פרטים ואילוצים שמבלבלים.
- ירוקים: אמפתיים, שיתופיים, בעלי אינטליגנציה רגשית — לפעמים מפספסים מבנה ברור.
- צהובים: יצירתיים, אינטואיטיביים, בעלי חשיבה רחבה — לפעמים חסרי פוקוס ספציפי.

עליך לנתח את ה-Prompt הבא: "${userPrompt}"

חשוב: הניתוח חייב להתייחס ספציפית לפרופיל המספרי המלא של המשתמש.

החזר את הניתוח בפורמט Markdown הכולל:
1. ציון משוער (1-100) על יעילות ההנחיה.
2. ניתוח: כיצד ה"צבע" הספציפי של המשתמש בא לידי ביטוי.
3. השלכה: איזו טעות קריטית ה-AI צפוי לעשות.
4. שכתוב מומלץ: הצע פרומפט מיטבי עבור המשימה המותאם לאופן החשיבה של הצבע ${mainColor}.`;

    const response = await callGeminiApi('generateContent', {
      model: "gemini-3.6-flash",
      contents: "אנא נתח את הפרומפט המצויין.",
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: { thinkingLevel: "low" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const data = await response.json();
    return data.text || "לא התקבל ניתוח.";
  } catch (error: any) {
    console.error("AI Agent Simulator Error:", error);
    return `שגיאה בניתוח: ${error.message}`;
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const response = await callGeminiApi('generateContent', {
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: 'תמלל את ההקלטה הבאה לעברית. החזר רק את הטקסט המתומלל, ללא כל הסבר.' }
          ]
        }
      ]
    });

    const data = await response.json();
    return (data.text || '').trim();
  } catch (error: any) {
    console.error('Transcription error:', error);
    throw new Error('שגיאה בתמלול: ' + error.message);
  }
};

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    const response = await callGeminiApi('generateContent', {
      model: "gemini-3.6-flash",
      contents: text,
      config: {
        systemInstruction: `You are a professional translator. Translate the following text into ${targetLanguage}.`,
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: "low" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const data = await response.json();
    return data.text || "לא התקבלה תשובה.";
  } catch (error: any) {
    console.error("Translation error:", error);
    throw error;
  }
}

export const getStuckManagerAdviceStream = async (scores: Scores, situation: string, onChunk: (chunk: string) => void): Promise<string> => {
  const colorProfile = buildColorProfile(scores);

  const systemInstruction = `אתה יועץ מנהיגות ופסיכולוג ארגוני בכיר מבית Kilon Consulting.

${colorProfile}

מאפייני התנהגות תחת לחץ לפי צבע:
- אדום (הנחוש): תחת לחץ נוטה להיות חסר סבלנות, תוקפני, דורש שליטה מיידית.
- צהוב (המשפיע): תחת לחץ נוטה להתפזר, לאבד פוקוס, להיכנס לפאניקה חברתית.
- ירוק (התומך): תחת לחץ נוטה להסתגר, לשתוק, להיפגע רגשית ולוותר על הצרכים שלו.
- כחול (המדויק): תחת לחץ נוטה לשיתוק מניתוח יתר (Analysis paralysis), להיעשות נוקשה וביקורתי.

המצב שבו הוא תקוע: "${situation}"

תפקידך הוא לשמש ככפתור חילוץ מהיר ומותאם אישית לפרופיל הספציפי שלו.
1. שיקוף קצר ונרמול (Validation) — דבר אל הלב של הפרופיל.
2. פעולה מיידית לוויסות רגשי/פיזיולוגי המתאימה לפרופיל שלו.
3. 3 המלצות "תכלס" לפעולה מיידית כדי לחלץ אותו מהמצב.`;

  return callGeminiApiStream('generateContent', {
    model: "gemini-3.6-flash",
    contents: [{ role: 'user', parts: [{ text: situation }] }],
    config: {
      systemInstruction,
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: "low" },
      safetySettings: SAFETY_SETTINGS
    }
  }, onChunk);
};