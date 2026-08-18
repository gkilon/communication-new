import { Scores } from '../types';

interface Analysis {
  general: string;
  strengths: string;
  weaknesses: string;
  recommendations: string;
}

// Data store for color characteristics
const colorData = {
  red: {
    name: "אדום",
    adjective: "הנחוש",
    general: "מנהיגות טבעית, נחישות ומיקוד במטרה. אתה מונחה תוצאות, אוהב אתגרים ולא חושש לקבל החלטות מהירות.",
    strengths: ["יכולת הנעת תהליכים", "החלטיות תחת לחץ", "תקשורת ישירה ויעילה", "חתירה למטרה"],
    weaknesses: ["חוסר סבלנות", "עלול להיתפס כשתלטן או אגרסיבי", "קושי בהקשבה לדעות שונות", "התמקדות ב'מה' על חשבון ה'איך'"],
    recommendation_focus: "לשלב את הנחישות עם הקשבה פעילה ואמפתיה"
  },
  yellow: {
    name: "צהוב",
    adjective: "המשפיע",
    general: "כריזמה, אופטימיות ויכולת להלהיב אחרים. אתה יצירתי, חברותי ושואב אנרגיה מאינטראקציה חברתית.",
    strengths: ["יצירת קשרים והשפעה חברתית", "הנעה באמצעות חזון והתלהבות", "חשיבה יצירתית וראיית התמונה הגדולה", "יצירת אווירה חיובית"],
    weaknesses: ["קושי בהתמודדות עם פרטים וסדר", "נטייה להימנע מקונפליקטים", "אופטימיות יתר שעלולה להוביל לחוסר תכנון", "זקוק להכרה ומשוב חיובי"],
    recommendation_focus: "לתרגם את הרעיונות הגדולים לתוכניות עבודה מעשיות"
  },
  green: {
    name: "ירוק",
    adjective: "התומך",
    general: "יציבות, הרמוניה וחשיבות עליונה ליחסים בינאישיים. אתה איש צוות מעולה, סבלני, יודע להקשיב ומהווה עוגן של תמיכה.",
    strengths: ["יכולת הקשבה ואמפתיה", "אמינות ויציבות", "גישור ופתרון קונפליקטים", "יצירת סביבת עבודה תומכת והרמונית"],
    weaknesses: ["הימנעות מקונפליקטים ועימותים", "התנגדות לשינויים פתאומיים", "קושי בקבלת החלטות מהירות", "נטייה לוותר על צרכים אישיים למען הקבוצה"],
    recommendation_focus: "להביע את דעתך ועמדותיך באופן אסרטיבי ומכבד"
  },
  blue: {
    name: "כחול",
    adjective: "המדויק",
    general: "חשיבה אנליטית, יסודיות ושאיפה לאיכות ללא פשרות. אתה מבוסס נתונים, מקפיד על פרטים, נהלים וסדר.",
    strengths: ["תכנון וארגון מעולים", "דיוק ותשומת לב לפרטים", "חשיבה לוגית ואנליטית", "שמירה על סטנדרטים גבוהים"],
    weaknesses: ["ביקורתיות יתר (עצמית וכלפי אחרים)", "שיתוק כתוצאה מעודף ניתוח (Analysis paralysis)", "עלול להיתפס כקר, מרוחק ופסימי", "קושי בגמישות ובאילתור"],
    recommendation_focus: "לאזן בין השאיפה לשלמות לבין הצורך להתקדם ולהיות פרגמטי"
  }
};

type Color = keyof typeof colorData;

export const generateProfileAnalysis = (scores: Scores): Analysis => {
  const { a, b, c, d } = scores;

  // Calculate scores for each of the four colors based on the two axes
  const colorScores = {
    red: a + c,    // Extrovert + Task
    yellow: a + d, // Extrovert + People
    green: b + d,  // Introvert + People
    blue: b + c    // Introvert + Task
  };

  const totalScore = Object.values(colorScores).reduce((sum, score) => sum + score, 0);
  
  // Handle the edge case of a perfectly balanced score (or zero scores) to avoid division by zero
  if (totalScore === 0) {
    return {
      general: "לא ניתן היה לקבוע פרופיל דומיננטי. ייתכן שהתשובות היו מאוזנות לחלוטין.",
      strengths: "היכולת לראות את כל הצדדים באופן שווה.",
      weaknesses: "קושי בקבלת החלטה על נתיב פעולה מועדף.",
      recommendations: "נסה לבחון באילו מצבים אתה מרגיש יותר בנוח כדי לזהות נטיות טבעיות."
    };
  }

  const sortedColors = (Object.keys(colorScores) as Color[]).sort((colorA, colorB) => colorScores[colorB] - colorScores[colorA]);
  
  const [dominant, secondary, , weakest] = sortedColors;
  const dominantData = colorData[dominant];
  const secondaryData = colorData[secondary];
  const weakestData = colorData[weakest];

  const secondaryPercentage = Math.round((colorScores[secondary] / totalScore) * 100);

  // --- Generate Analysis Texts Dynamically ---

  // 1. General Analysis — no raw percentages, focus on the combined map
  let general = `הפרופיל שלך מראה דומיננטיות ברורה של הסגנון ה${dominantData.name} — ${dominantData.adjective}. המשמעות היא ש${dominantData.general} המפה המשולבת שלך מגלה כיצד הנטיות הללו מתבטאות בפועל בצמתי ההתנהגות השונים.`;
  if (secondaryPercentage > 20) {
    general += ` לצד זה, הסגנון ה${secondaryData.name} (${secondaryData.adjective}) נוכח בצורה משמעותית בפרופיל שלך. שילוב זה — ${dominantData.name} ו${secondaryData.name} — מעניק לך גישה ייחודית: `;
    if ((dominant === 'red' && secondary === 'yellow') || (dominant === 'yellow' && secondary === 'red')) {
        general += "אתה מנהיג כריזמטי שיודע להניע אנשים הן דרך הצבת יעדים ברורים והן דרך יצירת התלהבות וחזון משותף. האנרגיה שאתה משדר מושכת אחרים לפעולה, ובה בעת אתה מסוגל לשמור על כיוון ומיקוד.";
    } else if ((dominant === 'red' && secondary === 'blue') || (dominant === 'blue' && secondary === 'red')) {
        general += "אתה מנהל אסטרטגי ויעיל, המשלב נחישות ואוריינטציה לתוצאות עם תכנון מדוקדק ורציונלי. המפה שלך מצביעה על יכולת נדירה להיות גם רוח הגב וגם השכל המנחה.";
    } else if ((dominant === 'red' && secondary === 'green') || (dominant === 'green' && secondary === 'red')) {
        general += "אתה מנהיג מכיל — כזה שמשיג תוצאות מבלי לרמוס אנשים. המפה שלך חושפת שילוב ייחודי של עוצמה ורגישות, שיכול להיות מנוף עצום בניהול צוותים.";
    } else if ((dominant === 'yellow' && secondary === 'green') || (dominant === 'green' && secondary === 'yellow')) {
        general += "אתה ה'דבק' החברתי בכל סביבה — אדם שיוצר אווירה, מחזק קשרים ומניע שיתוף פעולה. המפה שלך מגלה שהאינטליגנציה הרגשית שלך היא כלי עצמה.";
    } else if ((dominant === 'yellow' && secondary === 'blue') || (dominant === 'blue' && secondary === 'yellow')) {
        general += "אתה פותר בעיות יצירתי עם ראש אנליטי — שני נדירים שבדרך כלל לא נמצאים יחד. המפה שלך מראה שאתה יכול לחשוב מחוץ לקופסה וגם לבדוק את הרעיון לפני שמוציאים אותו לפועל.";
    } else if ((dominant === 'blue' && secondary === 'green') || (dominant === 'green' && secondary === 'blue')) {
        general += "אתה איש צוות אמין ומסור, המשלב בין יסודיות ושאיפה לאיכות לבין סבלנות ורצון אמיתי לתמוך באחרים. המפה שלך מצביעה על עוגן יציב בכל סביבת עבודה.";
    }
  } else {
    general += ` הפרופיל שלך ממוקד ביותר — צבע דומיננטי אחד בולט בבירור על פני האחרים. זה הופך את סגנון התקשורת שלך לעקבי ומזוהה, ומאפשר לסביבה שלך לדעת למה לצפות ממך.`;
  }
  
  // 2. Strengths Analysis — deeper, map-oriented
  let strengths = `החוזקות הטבעיות שלך נובעות ישירות מהסגנון ה${dominantData.name}: ${dominantData.strengths.slice(0, 3).join(', ')}. `;
  strengths += `אלה אינן רק תכונות — הן מתבטאות בהתנהגות יומיומית ומשפיעות על האופן שבו אחרים חווים אותך בשיחה, בישיבה, ובמצבי לחץ. `;
  if (secondaryPercentage > 20) {
      strengths += `הסגנון ה${secondaryData.name} מעשיר את הפרופיל ב${secondaryData.strengths[0]} וב${secondaryData.strengths[1]}. `;
      if ((dominant === 'red' && secondary === 'blue') || (dominant === 'blue' && secondary === 'red')) {
        strengths += "השילוב הזה מאפשר לך להוביל פרויקטים מורכבים מקצה לקצה — מהרעיון הראשוני ועד לביצוע המדויק — מה שהופך אותך לנכס בכל צוות.";
      } else if ((dominant === 'yellow' && secondary === 'green') || (dominant === 'green' && secondary === 'yellow')) {
        strengths += "שני הצבעים גם יחד מאפשרים לך לבנות אמון בצורה מהירה ואמיתית — אנשים מרגישים שאתה 'בשבילם', וזה פותח דלתות שלוגיקה בלבד לא תפתח.";
      } else {
        strengths += "הגמישות הנובעת מהשילוב הזה מאפשרת לך להתאים את עצמך למגוון רחב של אנשים ומצבים, ולהיות אפקטיבי גם כשהנסיבות משתנות.";
      }
  }

  // 3. Weaknesses/Development Areas Analysis — deeper, candid but constructive
  let weaknesses = `כל סגנון חזק מגיע עם 'צד צל'. הדומיננטיות של ה${dominantData.name} עלולה להוביל ל${dominantData.weaknesses[0]} ול${dominantData.weaknesses[1]} — לא כישלון, אלא דפוס אוטומטי שפועל מתחת לרדאר. `;
  weaknesses += `חשוב להכיר בכך שהחוזקה הגדולה ביותר, כשהיא מופעלת בעוצמה יתרה, היא גם נקודת הפגיעות. `;
  if (secondaryPercentage > 20) {
      weaknesses += `השילוב עם ה${secondaryData.name} יכול להעצים נקודת עיוורון ספציפית: ${secondaryData.weaknesses[0]}. `;
  }
  weaknesses += `המפה המשולבת גם מגלה שהסגנון ה${weakestData.name} נמוך יחסית — מה שאומר שתכונות כמו ${weakestData.strengths[0]} ו${weakestData.strengths[1]} לא מגיעות אליך באופן אוטומטי. זהו אזור פיתוח שדורש מאמץ מודע, אך גם מסמן לאן הצמיחה הגדולה ביותר שלך יכולה להגיע.`;

  // 4. Recommendations Analysis
  let recommendations = `ההמלצה הראשונה עבורך: ${dominantData.recommendation_focus}. `;
  recommendations += `נסה לשאול את עצמך בשיחות מפתח: "איך צבע ${weakestData.name} היה מתייחס לרגע הזה?" — לאו דווקא כדי לשנות את עצמך, אלא כדי להרחיב את ה'תפריט' שלך. `;
  if (secondaryPercentage > 20) {
    recommendations += `הכוח של הפרופיל שלך טמון בשילוב — ה${dominantData.name} וה${secondaryData.name} יחדיו. נסה לאמץ גם כלים מה${secondaryData.name}: ${secondaryData.recommendation_focus}. `;
  }
  recommendations += `ההמלצה המרכזית: ${weakestData.recommendation_focus}, גם כשזה לא מרגיש טבעי. זה יהפוך אותך מ'מומחה בסגנון שלי' לאדם שיכול לדבר בשפה של כל סגנון — וזה ההבדל בין תקשורת טובה לתקשורת מצוינת.`;

  return { general, strengths, weaknesses, recommendations };
};
