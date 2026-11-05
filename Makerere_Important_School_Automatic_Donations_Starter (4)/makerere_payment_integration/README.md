# Makerere Important School — donation integration starter

This package preserves the supplied school's visual design and adds a server-side Flutterwave Uganda Mobile Money integration starter using Netlify Functions and Netlify Blobs.

## Important status

**This is an integration starter, not a live/approved payment system.** It cannot accept real donations until an authorized adult/school representative has an approved merchant account, adds the provider credentials privately in Netlify, configures the webhook, deploys the site, and completes provider-approved testing. The school must confirm that it is legally entitled to collect donations and that its merchant account is approved for this purpose.

The Uganda Flutterwave v3 charge flow can return a hosted authorisation URL. This code redirects the donor to that URL. It does not promise that every MTN/Airtel transaction will appear as a native handset push prompt.

## Files

- `public/index.html` — updated donation page
- `public/Mako.html` — same updated page under its previous filename
- `public/*.jpg` — original supplied images
- `netlify/functions/create-payment.mjs` — creates a UGX Mobile Money charge
- `netlify/functions/flutterwave-webhook.mjs` — checks webhook secret and verifies the transaction directly with Flutterwave before marking it successful
- `netlify/functions/check-payment.mjs` — returns limited payment status to the donor's return page
- Netlify Blobs store — saves pending and verified donation records

## Setup (adult/school representative should do the account and money-related steps)

1. In Netlify, open the existing Makerere Important School site and confirm the correct production site before changing anything.
2. Download a backup of the current published deploy/source before deploying this package.
3. Deploy this project folder as the site's project root (it contains `netlify.toml`, `package.json`, `public/`, and `netlify/functions/`).
4. In the Netlify project, add these environment variables under Project configuration / Environment variables:
   - `FLW_SECRET_KEY` — start with an approved Flutterwave **test** secret key.
   - `FLW_SECRET_HASH` — a long random webhook secret chosen by the adult/school administrator; use the same value in Flutterwave's webhook settings.
5. In Flutterwave's dashboard, configure the webhook URL as `https://YOUR-SITE-DOMAIN/api/flutterwave-webhook` and set its secret hash. Enable retries if the dashboard offers that setting.
6. Redeploy after adding environment variables.
7. Test only with provider-approved sandbox/test credentials and test procedures. Do not ask real donors to test. Confirm successful, failed, cancelled, duplicate-webhook and delayed-webhook cases.
8. Only after the school representative and provider approve the live account and testing, switch to live credentials in Netlify. Never put secret keys in HTML, JavaScript, chat, email, or Git.

## Where records are stored

Verified donation records are stored in the Netlify Blobs store named `school-donations`. An authorized site administrator can inspect the store in Netlify's Data & Storage / Blobs area. This starter does not expose a public donation list or public admin dashboard.

## Limitations to address before production

- No email receipt service is configured yet.
- No staff-only donation dashboard/export is included.
- No refund workflow is included.
- The school's legal/charitable status, account ownership, fees, settlement account and privacy notice must be confirmed by the responsible adult/school representative and provider.
- The current payment status page waits for the webhook to update Netlify Blobs. If the webhook is delayed, the donor sees a pending message rather than a false success.
- Consider moving to a dedicated transactional database if donation volume grows; Netlify Blobs is a simple key/value store, not a full accounting system.

## Local checks

Install dependencies with `npm install`. Use Netlify CLI (`netlify dev`) to test functions locally. Local Blobs are sandboxed; use only provider sandbox credentials and test flows.
