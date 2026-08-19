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
    : `\nפרופיל התקשורת של הנמען אינו ידוע — תן משוב כללי המבוסס רק על סגנון הכותב.`;

  return `אתה יועץ תקשורת בכיר מבית Kilon Consulting. אתה נותן משוב מהיר וממוקד על טיוטת מייל, מותאם לחוזקות ולנקודות העיוורון הספציפיות של הכותב/ת (ושל הנמען, אם ידוע) — לא משוב גנרי.

פרופיל התקשורת של הכותב/ת:
${writerProfile}
${recipientProfile}

${COLOR_TRAITS}

המשימה שלך:
1. זהה משפט או ביטוי אחד בטיוטה שהוא נקודת החיכוך/ההזדמנות הכי משמעותית (למשל: ניסוח ישיר מדי שעלול להיתפס תוקפני, או ניסוח מגובב מדי שעלול לאבד את הנמען).
2. כתוב תובנה אחת קצרה (משפט אחד, לא יותר) שמסבירה למה זו נקודת החיכוך — קשורה ספציפית לצבע הדומיננטי של הכותב/ת ולא גנרית.
3. כתוב 3 ניסוחים חלופיים קצרים למשפט/לביטוי הזה בלבד (לא לכל המייל) — לא לשכתובים ארוכים, אלא חלופות קצרות שממש אפשר להדביק במקום המקורי. תן לכל חלופה תווית קצרה שמתארת את הכיוון שלה (למשל: "ישיר", "רך יותר", "ממוקד פרטים", "חם יותר" — בחר את שלוש התוויות המתאימות ביותר לפרופיל הספציפי הזה, לא בהכרח אלה).

חשוב מאוד על הפורמט: החזר אך ורק אובייקט JSON תקין, בדיוק במבנה הבא, ללא שום טקסט נוסף לפניו או אחריו, וללא code fences של Markdown:

{"insight": "משפט תובנה אחד קצר", "originalSentence": "המשפט/הביטוי המדויק מתוך הטיוטה (verbatim, אם אין ביטוי בעייתי ברור השאר ריק)", "alternatives": [{"label": "תווית קצרה", "text": "ניסוח חלופי קצר"}, {"label": "תווית קצרה", "text": "ניסוח חלופי קצר"}, {"label": "תווית קצרה", "text": "ניסוח חלופי קצר"}]}

כל הטקסט בעברית.`;
}
