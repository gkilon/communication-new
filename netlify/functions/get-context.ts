import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Returns { writer: {scores, displayName}, colleagues: [{uid, displayName, scores}] }
// for the authenticated caller. Used by the Chrome extension (and could be reused by
// the web app) so the client never needs direct Firestore access to list org members.

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async (req: Request) => {
  try {
    const app = getAdminApp();
    if (!app) {
      return new Response(JSON.stringify({ error: "Server auth not configured." }), { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return new Response(JSON.stringify({ error: "Missing Authorization token." }), { status: 401 });

    const decoded = await getAuth(app).verifyIdToken(idToken);
    const db = getFirestore(app);

    const meSnap = await db.collection("users").doc(decoded.uid).get();
    const me = meSnap.data();
    if (!me || !me.orgId) {
      return new Response(JSON.stringify({ error: "User has no organization." }), { status: 403 });
    }

    const orgUsersSnap = await db.collection("users").where("orgId", "==", me.orgId).get();
    const colleagues = orgUsersSnap.docs
      .map(d => d.data())
      .filter((u: any) => u.uid !== decoded.uid && u.scores)
      .map((u: any) => ({ uid: u.uid, displayName: u.displayName || u.email, scores: u.scores }));

    return new Response(JSON.stringify({
      writer: { scores: me.scores || null, displayName: me.displayName || me.email },
      colleagues
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("get-context error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const config = {
  path: "/api/get-context"
};
