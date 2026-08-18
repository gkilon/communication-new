import Stripe from "stripe";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Requires env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_TEAM,
// FIREBASE_SERVICE_ACCOUNT_KEY (same base64-encoded service account JSON as gemini.ts),
// and SITE_URL (e.g. https://communication-new.kilon-consulting.com) for redirect URLs.
//
// NOTE: Pricing/plan names below (starter/team) are placeholders — swap in your actual
// Stripe Price IDs once pricing is decided. This function is a working skeleton, not final.

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return initializeApp({ credential: cert(serviceAccount) });
}

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  team: process.env.STRIPE_PRICE_ID_TEAM,
};

export default async (req: Request) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured (STRIPE_SECRET_KEY missing)." }), { status: 500 });
    }
    const stripe = new Stripe(stripeKey);

    const app = getAdminApp();
    if (!app) {
      return new Response(JSON.stringify({ error: "Server auth not configured." }), { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return new Response(JSON.stringify({ error: "Missing Authorization token." }), { status: 401 });

    const decoded = await getAuth(app).verifyIdToken(idToken);
    const db = getFirestore(app);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    if (!userData || userData.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Only an org admin can manage billing." }), { status: 403 });
    }
    const orgId = userData.orgId;

    const { plan } = await req.json(); // 'starter' | 'team'
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Unknown or unconfigured plan: ${plan}` }), { status: 400 });
    }

    const orgSnap = await db.collection("organizations").doc(orgId).get();
    const org = orgSnap.data();

    const siteUrl = process.env.SITE_URL || "http://localhost:8888";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: org?.stripeCustomerId || undefined,
      customer_email: org?.stripeCustomerId ? undefined : decoded.email,
      client_reference_id: orgId,
      subscription_data: { metadata: { orgId } },
      success_url: `${siteUrl}/?billing=success`,
      cancel_url: `${siteUrl}/?billing=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("create-checkout-session error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const config = {
  path: "/api/create-checkout-session"
};
