import Stripe from "stripe";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Requires env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT_KEY.
// Register this endpoint in the Stripe dashboard as: https://<your-site>/api/stripe-webhook
// Listen for: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return initializeApp({ credential: cert(serviceAccount) });
}

// Plan -> seat/usage limits. Adjust once real pricing tiers are finalized.
const PLAN_LIMITS: Record<string, { seatLimit: number; monthlyAiCallLimit: number }> = {
  starter: { seatLimit: 10, monthlyAiCallLimit: 500 },
  team: { seatLimit: 50, monthlyAiCallLimit: 3000 },
};

export default async (req: Request) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 500 });
  }
  const stripe = new Stripe(stripeKey);

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const app = getAdminApp();
  if (!app) return new Response("Server auth not configured", { status: 500 });
  const db = getFirestore(app);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.client_reference_id;
        if (orgId) {
          await db.collection("organizations").doc(orgId).set({
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
          }, { merge: true });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          const status = sub.status === "active" ? "active" : (sub.status === "past_due" ? "past_due" : "canceled");
          const planKey = event.type === "customer.subscription.deleted" ? undefined : (sub.metadata?.plan as string);
          const limits = planKey ? PLAN_LIMITS[planKey] : undefined;
          await db.collection("organizations").doc(orgId).set({
            subscriptionStatus: status,
            ...(limits ? { seatLimit: limits.seatLimit, monthlyAiCallLimit: limits.monthlyAiCallLimit, plan: planKey } : {}),
          }, { merge: true });
        }
        break;
      }
      default:
        break; // Ignore other event types
    }
  } catch (e: any) {
    console.error("Webhook handling error:", e);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

export const config = {
  path: "/api/stripe-webhook"
};
