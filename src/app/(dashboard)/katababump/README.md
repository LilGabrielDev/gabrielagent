# Katababump WhatsApp WebJS Panel

This folder adds an alternative dashboard route at `/katababump`.

The page reuses the existing `/api/channels/whatsapp` route so nothing in the current Channels screen is removed. On Vercel, that API intentionally reports `unsupported` because `whatsapp-web.js` needs Puppeteer plus persistent local auth storage, which belongs on a long-running Node server rather than a serverless deployment.

Use this Vercel page as the visible panel, then connect it to a separate worker when that worker endpoint exists.
