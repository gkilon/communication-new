importScripts('config.js', 'prompt.js');

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
const REFRESH_BASE = "https://securetoken.googleapis.com/v1";

async function login(email, password) {
  const res = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${CONFIG.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "התחברות נכשלה");

  await chrome.storage.local.set({
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (Number(data.expiresIn) * 1000),
    email: data.email
  });
  return data.email;
}

async function logout() {
  await chrome.storage.local.clear();
}

async function getValidIdToken() {
  const stored = await chrome.storage.local.get(["idToken", "refreshToken", "expiresAt"]);
  if (!stored.idToken) return null;

  // Refresh if less than 5 minutes of validity left
  if (Date.now() > stored.expiresAt - 5 * 60 * 1000) {
    const res = await fetch(`${REFRESH_BASE}/token?key=${CONFIG.FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${stored.refreshToken}`
    });
    const data = await res.json();
    if (!res.ok) {
      await logout();
      return null;
    }
    await chrome.storage.local.set({
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) * 1000)
    });
    return data.id_token;
  }
  return stored.idToken;
}

async function safeJson(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Surface the real response instead of a bare "Unexpected token" — this is almost
    // always an HTML error page or empty body from an upstream failure, not our JSON.
    throw new Error(`Server returned non-JSON (status ${res.status}): ${raw.slice(0, 200)}`);
  }
}

async function fetchContext(idToken) {
  const res = await fetch(`${CONFIG.SITE_URL}/api/get-context`, {
    headers: { "Authorization": `Bearer ${idToken}` }
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || "שגיאה בטעינת פרופיל");
  return data; // { writer: {scores, displayName}, colleagues: [...] }
}

async function checkEmailStyle(draftText, writerScores, recipientScores, recipientName) {
  const idToken = await getValidIdToken();
  if (!idToken) throw new Error("NOT_LOGGED_IN");

  if (!writerScores) throw new Error("לא נמצא פרופיל תקשורת — יש להשלים קודם את השאלון באתר.");

  const systemInstruction = buildEmailFeedbackPrompt(writerScores, recipientScores || null, recipientName);
  const writerColor = getDominantColorName(writerScores);
  const recipientColor = recipientScores ? getDominantColorName(recipientScores) : null;

  const res = await fetch(`${CONFIG.SITE_URL}/api/gemini`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      action: "generateContent",
      payload: {
        model: "gemini-3.6-flash",
        contents: `הטיוטה לבדיקה:\n\n${draftText}`,
        config: {
          systemInstruction,
          temperature: 0.5,
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        },
        // Metadata-only usage log for the future weekly summary — no email text is stored,
        // just which color pairing this check involved. See netlify/functions/gemini.ts.
        logEvent: { writerColor, recipientColor, source: "extension" }
      }
    })
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `שגיאה (${res.status})`);

  let parsed;
  try {
    parsed = JSON.parse(data.text);
  } catch (e) {
    throw new Error("המודל החזיר תשובה שלא בפורמט הצפוי. נסה/י שוב.");
  }
  if (typeof parsed.suggestion !== 'string' || typeof parsed.why !== 'string') {
    throw new Error("תשובת המודל חסרה שדות נדרשים. נסה/י שוב.");
  }
  return parsed; // { originalSentence, suggestion, why }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "LOGIN": {
          const email = await login(msg.email, msg.password);
          sendResponse({ ok: true, email });
          break;
        }
        case "LOGOUT": {
          await logout();
          sendResponse({ ok: true });
          break;
        }
        case "AUTH_STATE": {
          const stored = await chrome.storage.local.get(["idToken", "email"]);
          sendResponse({ ok: true, loggedIn: !!stored.idToken, email: stored.email });
          break;
        }
        case "GET_COLLEAGUES": {
          const idToken = await getValidIdToken();
          if (!idToken) { sendResponse({ ok: false, error: "NOT_LOGGED_IN" }); break; }
          const context = await fetchContext(idToken);
          sendResponse({ ok: true, writer: context.writer, colleagues: context.colleagues });
          break;
        }
        case "CHECK_EMAIL_STYLE": {
          const feedback = await checkEmailStyle(msg.draftText, msg.writerScores, msg.recipientScores, msg.recipientName);
          sendResponse({ ok: true, feedback });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep the message channel open for the async response
});
