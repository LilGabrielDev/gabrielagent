# Deploying Owly on Vercel

Owly can run on Vercel for the Next.js dashboard, API routes, hosted Postgres, OpenAI, email, Twilio, webhooks, and the embedded widget.

WhatsApp Web QR mode is disabled on Vercel because it depends on Puppeteer, a long-running browser process, and persistent local `.wwebjs_auth` storage. For WhatsApp on Vercel, use WhatsApp Business API mode or run the WhatsApp Web worker on a separate long-running host.

## 1. Create a production database

Create a hosted PostgreSQL database with Neon, Supabase, Vercel Postgres, Railway, or another provider.

Run migrations against that database before or during deployment:

```bash
npx prisma migrate deploy
```

## 2. Import the project in Vercel

Import the repository as a Next.js project. The included `vercel.json` configures:

- `PUPPETEER_SKIP_DOWNLOAD=1 npm install`
- `npm run vercel-build`
- `prisma generate` before `next build`

## 3. Add environment variables

Set these in Vercel Project Settings > Environment Variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
JWT_SECRET="use-a-random-32-plus-character-secret"
NEXT_PUBLIC_APP_URL="https://your-vercel-domain.vercel.app"
OPENAI_API_KEY="sk-..."
WEBHOOK_SECRET="use-a-random-32-plus-character-secret"
```

Optional, depending on enabled channels:

```bash
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
ELEVENLABS_API_KEY=""
NEXTAUTH_SECRET=""
CORS_ORIGIN=""
```

## 4. Deploy

Push to the connected branch or run:

```bash
vercel --prod
```

After deployment, open:

```text
https://your-vercel-domain.vercel.app/api/health
```

## Notes

- Vercel does not use the Dockerfile or `docker-compose.yml`.
- `prisma migrate deploy` should run whenever migrations change.
- Server-sent events under `/api/realtime` can work for light usage, but Vercel function duration limits still apply.
- For full WhatsApp Web QR support, deploy the Docker version on a long-running host instead of Vercel.
