import { getStore } from "@netlify/blobs";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const txRef = new URL(request.url).searchParams.get("tx_ref") || "";
  if (!/^MIS-[0-9a-f-]{36}$/i.test(txRef)) return json({ error: "Invalid reference." }, 400);
  const store = getStore("school-donations");
  const donation = await store.get(`donation:${txRef}`, { type: "json", consistency: "strong" });
  if (!donation) return json({ error: "Reference not found." }, 404);
  // Only return the minimum information needed by the public return page.
  return json({ status: donation.status, amount: donation.amount, currency: donation.currency, reference: donation.txRef });
};

export const config = { path: "/api/check-payment", method: "GET" };
