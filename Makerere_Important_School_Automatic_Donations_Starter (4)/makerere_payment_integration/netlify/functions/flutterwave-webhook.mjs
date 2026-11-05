import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = request.headers.get("verif-hash") || "";
  if (!secretHash || !safeEqual(signature, secretHash)) return new Response("Unauthorized", { status: 401 });

  let payload;
  try { payload = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const data = payload?.data;
  const txRef = typeof data?.tx_ref === "string" ? data.tx_ref : "";
  const transactionId = data?.id;
  if (!txRef || !transactionId) return new Response("Ignored", { status: 200 });

  const store = getStore("school-donations");
  const key = `donation:${txRef}`;
  const donation = await store.get(key, { type: "json", consistency: "strong" });
  if (!donation) return new Response("Unknown reference", { status: 200 });
  if (donation.status === "successful") return new Response("Already processed", { status: 200 });

  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) return new Response("Server not configured", { status: 500 });

  // Never trust a webhook payload alone: verify the transaction directly with Flutterwave.
  const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transactionId))}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!verifyResponse.ok) return new Response("Verification unavailable", { status: 500 });
  const verified = await verifyResponse.json();
  const tx = verified?.data;
  const valid = verified?.status === "success"
    && tx?.status === "successful"
    && tx?.tx_ref === txRef
    && tx?.currency === "UGX"
    && Number(tx?.amount) >= Number(donation.amount);

  if (valid) {
    await store.setJSON(key, {
      ...donation,
      status: "successful",
      providerTransactionId: String(transactionId),
      paidAmount: Number(tx.amount),
      paidAt: tx.created_at || new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    });
  } else if (tx?.status === "failed" || tx?.status === "cancelled") {
    await store.setJSON(key, { ...donation, status: "failed", verifiedAt: new Date().toISOString() });
  }

  return new Response("OK", { status: 200 });
};

export const config = { path: "/api/flutterwave-webhook", method: "POST" };
