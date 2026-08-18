import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// --- Server-side auth + per-org usage limiting ---
// Every AI call must come from a signed-in user with a valid Firebase ID token, and every
// org has a monthly cap (monthlyAiCallLimit on the organizations/{orgId} doc). This is the
// actual enforcement point — the Firestore usage counter is just a ledger for the UI.

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    return initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    return null;
  }
}

async function checkAuthAndUsage(req: Request): Promise<{ ok: true; uid: string; orgId: string } | { ok: false; status: number; error: string }> {
  const app = getAdminApp();
  if (!app) {
    // Firebase Admin isn't configured — fail closed rather than silently allowing
    // unauthenticated, unlimited access to a paid AI endpoint.
    return { ok: false, status: 500, error: "Server auth not configured (FIREBASE_SERVICE_ACCOUNT_KEY missing)." };
  }

  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { ok: false, status: 401, error: "Missing Authorization token." };

  let uid: string;
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (e) {
    return { ok: false, status: 401, error: "Invalid or expired token." };
  }

  const db = getFirestore(app);
  const userSnap = await db.collection("users").doc(uid).get();
  const orgId = userSnap.data()?.orgId;
  if (!orgId) return { ok: false, status: 403, error: "User has no organization." };

  const orgSnap = await db.collection("organizations").doc(orgId).get();
  const org = orgSnap.data();
  if (!org) return { ok: false, status: 403, error: "Organization not found." };
  if (org.subscriptionStatus === 'canceled') {
    return { ok: false, status: 402, error: "Subscription inactive." };
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  const usageRef = db.collection("organizations").doc(orgId).collection("usage").doc(monthKey);
  const usageSnap = await usageRef.get();
  const currentCalls = usageSnap.data()?.aiCalls || 0;
  const limit = org.monthlyAiCallLimit ?? 200;

  if (currentCalls >= limit) {
    return { ok: false, status: 429, error: `Monthly AI usage limit reached (${limit}). Upgrade your plan to continue.` };
  }

  // Increment first (fail-safe against a burst of concurrent requests slipping through).
  await usageRef.set({ aiCalls: FieldValue.increment(1), month: monthKey }, { merge: true });

  return { ok: true, uid, orgId };
}

function convertToGroqMessages(contents: any, systemInstruction?: string) {
  const messages: any[] = [];
  
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  
  if (typeof contents === "string") {
    messages.push({ role: "user", content: contents });
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === "string") {
        messages.push({ role: "user", content: item });
      } else if (item && typeof item === "object") {
        const role = item.role === "model" ? "assistant" : (item.role || "user");
        let textContent = "";
        
        if (Array.isArray(item.parts)) {
          for (const part of item.parts) {
            if (part.text) {
              textContent += part.text;
            }
          }
        } else if (typeof item.text === "string") {
          textContent = item.text;
        }
        
        if (textContent) {
          messages.push({ role, content: textContent });
        }
      }
    }
  }
  
  return messages;
}

export default async (req: Request) => {
  try {
    const authCheck = await checkAuthAndUsage(req);
    if (!authCheck.ok) {
      return new Response(JSON.stringify({ error: authCheck.error }), {
        status: authCheck.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { action, payload } = await req.json();
    
    const groqApiKey = process.env.GROQ_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    // Use Groq if available
    if (groqApiKey) {
      const systemInstruction = payload.config?.systemInstruction;
      const messages = convertToGroqMessages(payload.contents, systemInstruction);
      
      // Allow caller to request a specific Groq model (e.g. deepseek for simulation)
let groqModel = payload.groqModel || "llama-3.3-70b-versatile";

// אם הגיע מהפרונטאנד מודל שנמחק, נחליף אותו ידנית למודל פעיל ותקין ב-Groq
if (groqModel === "deepseek-r1-distill-llama-70b") {
  groqModel = "llama-3.3-70b-versatile";
}
      // Streaming implementation for Groq
      if (action.endsWith('Stream')) {
        try {
          const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: groqModel,
              messages,
              temperature: payload.config?.temperature ?? 0.7,
              stream: true
            })
          });

          if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            throw new Error(`Groq API error: ${errText}`);
          }

          const reader = groqResponse.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const stream = new ReadableStream({
            async start(controller) {
              try {
                if (!reader) {
                  controller.close();
                  return;
                }

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    const cleaned = line.trim();
                    if (!cleaned) continue;
                    if (cleaned === "data: [DONE]") continue;

                    if (cleaned.startsWith("data: ")) {
                      try {
                        const json = JSON.parse(cleaned.substring(6));
                        const text = json.choices?.[0]?.delta?.content || "";
                        if (text) {
                          controller.enqueue(new TextEncoder().encode(text));
                        }
                      } catch (e) {
                        // Ignore parse errors for incomplete chunks
                      }
                    }
                  }
                }
                controller.close();
              } catch (e: any) {
                console.error("Groq Stream processing error:", e);
                controller.error(e);
              }
            }
          });

          return new Response(stream, {
            headers: { 
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            }
          });
        } catch (streamError: any) {
          console.error("Groq Streaming initialization error:", streamError);
          return new Response(JSON.stringify({ error: streamError.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Non-streaming implementation for Groq
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: groqModel,
          messages,
          temperature: payload.config?.temperature ?? 0.7
        })
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        throw new Error(`Groq API error: ${errText}`);
      }

      const data = await groqResponse.json();
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ text }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fallback to Gemini if Groq is not available
    if (!geminiApiKey) {
      console.error("API Keys missing");
      return new Response(JSON.stringify({ error: "API Key missing in environment" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const modelName = payload.model || "gemini-2.0-flash";

    // Helper for streaming
    if (action.endsWith('Stream')) {
      try {
        const result = await ai.models.generateContentStream({
          model: modelName,
          contents: payload.contents,
          config: payload.config
        });

        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result) {
                const text = chunk.text;
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text));
                }
              }
              controller.close();
            } catch (e: any) {
              console.error("Stream processing error:", e);
              controller.error(e);
            }
          }
        });

        return new Response(stream, {
          headers: { 
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      } catch (streamError: any) {
        console.error("Streaming initialization error:", streamError);
        return new Response(JSON.stringify({ error: streamError.message }), { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Non-streaming actions
    const response = await ai.models.generateContent({
      model: modelName,
      contents: payload.contents,
      config: payload.config
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Netlify Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = {
  path: "/api/gemini"
};