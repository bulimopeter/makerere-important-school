import { getStore } from "@netlify/blobs";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secretKey = process.env.FLW_SECRET_KEY;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!secretKey || !siteUrl) return json({ error: "Payment service is not configured yet." }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }

  const amount = Number(input.amount);
  const name = String(input.name || "").trim().slice(0, 100);
  const email = String(input.email || "").trim().slice(0, 150);
  const phone = String(input.phone || "").replace(/\D/g, "");
  const network = String(input.network || "").toUpperCase();

  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 50000000) return json({ error: "Donation amount is outside the allowed range." }, 400);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter your name and a valid email address." }, 400);
  if (!/^256\d{9}$/.test(phone)) return json({ error: "Enter a valid Ugandan mobile number." }, 400);
  if (!["MTN", "AIRTEL"].includes(network)) return json({ error: "Choose MTN or Airtel." }, 400);

  const txRef = `MIS-${crypto.randomUUID()}`;
  const store = getStore("school-donations");
  const record = {
    txRef, amount, currency: "UGX", network,
    donorName: name, donorEmail: email, donorPhone: phone,
    status: "pending", createdAt: new Date().toISOString(),
  };
  await store.setJSON(`donation:${txRef}`, record, { onlyIfNew: true });

  const redirectUrl = new URL("/", siteUrl);
  redirectUrl.searchParams.set("donation_ref", txRef);

  try {
    const providerResponse = await fetch("https://api.flutterwave.com/v3/charges?type=mobile_money_uganda", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: String(amount),
        currency: "UGX",
        email,
        phone_number: phone,
        fullname: name,
        network,
        redirect_url: redirectUrl.toString(),
        meta: { purpose: "Donation to Makerere Important School" },
      }),
    });
    const providerData = await providerResponse.json();
    const authorizationUrl = providerData?.data?.meta?.authorization?.redirect;
    if (!providerResponse.ok || providerData?.status !== "success" || !authorizationUrl) {
      await store.setJSON(`donation:${txRef}`, { ...record, status: "initiation_failed", providerMessage: "Provider did not return an authorisation URL." });
      return json({ error: "The payment provider could not start this payment. Please try again later." }, 502);
    }

    await store.setJSON(`donation:${txRef}`, {
      ...record,
      providerTransactionId: providerData?.data?.id ?? null,
      status: "pending_authorisation",
    });
    return json({ txRef, redirectUrl: authorizationUrl });
  } catch (error) {
    await store.setJSON(`donation:${txRef}`, { ...record, status: "initiation_failed" });
    return json({ error: "Payment service is temporarily unavailable. Please try again later." }, 502);
  }
};

export const config = { path: "/api/create-payment", method: "POST" };
