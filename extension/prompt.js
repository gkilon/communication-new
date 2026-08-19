// Ported from services/geminiService.ts (buildColorProfile + COLOR_TRAITS) so the
// extension's prompt logic stays in sync with the web app's. If you change the
// prompt there, mirror the change here too.

function buildColorProfile(scores) {
  const sA = Number(scores?.a || 0);
  const sB = Number(scores?.b || 0);
  const sC = Number(scores?.c || 0);
  const sD = Number(scores?.d || 0);

  const r = sA + sC;
  const y = sA + sD;
  const g = sB + sD;
  const b = sB + sC;
  const total = r + y + g + b || 1;

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

function buildEmailFeedbackPrompt(writerScores, recipientScores, recipientName) {
  const writerProfile = buildColorProfile(writerScores);
  const recipientProfile = recipientScores
    ? `\nפרופיל התקשורת של הנמען (${recipientName || 'הנמען'}):\n${buildColorProfile(recipientScores)}`
    : `\nפרופיל התקשורת של הנמען אינו ידוע — תן משוב כללי המבוסס רק על סגנון הכותב, וציין בקצרה שמשוב מדויק יותר אפשרי אם יודעים את סגנון הנמען.`;

  return `אתה יועץ תקשורת בכיר מבית Kilon Consulting, שנותן משוב ממוקד וקצר על טיוטת מייל לפני שליחתה.

פרופיל התקשורת של הכותב/ת:
${writerProfile}
${recipientProfile}

${COLOR_TRAITS}

המשימה שלך: לתת משוב שמעצים את החוזקות של הכותב/ת הספציפי/ת וממתן את נקודות העיוורון שלה/ו — לא משוב גנרי שהיה מתאים לכל אחד.

איך לעשות את זה בפועל:
1. זהה בטיוטה עצמה איפה באים לידי ביטוי הצבע/ים הדומיננטיים של הכותב/ת.
2. ציין במפורש איפה החוזקה הזו עובדת טוב בטיוטה הזו וכדאי לשמר אותה — הצבע/משפט הספציפי בטיוטה שמדגים את זה.
3. זהה איפה נקודת העיוורון של הפרופיל הזה עלולה לפגוע דווקא במייל הזה — ותן דרך קונקרטית למתן אותה מבלי לוותר על החוזקה.
4. אם ידוע פרופיל הנמען — ציין נקודת חיכוך ספציפית בין שני הפרופילים ותן דרך לגשר עליה.
5. עד 3 המלצות, פרקטיות וממוקדות. הצע ניסוח חלופי לקטע אחד בעייתי — לא לשכתב את כל המייל.
6. אסור משפט גנרי שמתאים לכל טיוטה בכל פרופיל. כל משפט חייב לנבוע ספציפית מהצבעים ומהטקסט שנשלח.
7. ענה בעברית, בגובה העיניים, בפורמט קצר וממוקד. אל תפתח בהקדמות.`;
}
