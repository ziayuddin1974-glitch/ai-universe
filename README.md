# AI UNIVERSE

A responsive React + TypeScript AI directory and workspace starter. It distinguishes **external website shortcuts** from **real API integrations**. In the starter, all listed providers are external shortcuts; the chat screen explicitly reports that no model is connected rather than fabricating answers.

## Run locally

1. Install Node.js (LTS) and a code editor.
2. Extract this folder and open a terminal in it.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Add your Supabase project URL and anon/public key to `.env.local`.
6. Run `npm run dev` and open the local URL shown by Vite.

Without Supabase variables, the site still runs in preview mode. Directory, search, category navigation, favourites (local session), theme toggle, external platform links, and the honest chat preview work.

## Android app

The Android app is built with Capacitor. Install Android Studio and its Android SDK, then run:

1. `npm install`
2. `npm run build:android`
3. `npm run open:android`
4. In Android Studio, build the APK from **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Voice commands use Android speech recognition and request microphone permission when first used. In Chrome, the microphone button uses the browser's speech-recognition support. Say commands such as **“open image tools”**, **“show chat assistants”**, or **“search for Claude”**. The app opens external AI platforms in a browser tab.

## Supabase setup

1. Create a Supabase project.
2. In Project Settings → API, copy the Project URL and anon/public key into `.env.local`.
3. Apply the database migration with `supabase link --project-ref YOUR_PROJECT_ID` and `supabase db push`, or run `supabase/schema.sql` in the Supabase SQL editor.
4. Enable Email auth in Authentication → Providers.
5. Add `OPENAI_API_KEY` under Project Settings → Edge Functions → Secrets. Never put provider keys in the frontend or GitHub Pages variables.
6. Deploy the chat function with `supabase functions deploy ai-chat`.
7. In GitHub repository Settings → Secrets and variables → Actions, add:
   - Variable `VITE_SUPABASE_URL` with the Supabase project URL.
   - Secret `VITE_SUPABASE_ANON_KEY` with the Supabase anon/publishable key.
   - To deploy backend changes from Actions, also add secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`, and variable `SUPABASE_PROJECT_ID`; then run **Deploy Supabase backend** under the Actions tab.
8. Re-run the **Deploy AI Universe to GitHub Pages** and **Build Android APK** workflows after setting the frontend variables.

## Current implementation status

- Implemented: responsive dashboard, AI directory, search and filters, voice navigation/search, external official-site launch, Supabase email authentication, authenticated favourites and conversation persistence, and an authenticated OpenAI chat Edge Function with a per-user request limit.
- Requires your Supabase project, frontend URL/anon key, and server-side OpenAI API key before live account sync and AI chat are available.
- Not yet implemented: Google OAuth UI flow, side-by-side multi-model comparison, image/video generation API connections, and API connections for providers other than OpenAI.

## Production checklist

- Add provider-specific adapters and model selection on the server.
- Configure production request quotas, abuse prevention, request logging without sensitive prompt retention, and cost controls.
- Add Google OAuth and password reset flows.
- Validate provider terms, data handling, age requirements, and regional availability.
- Replace permissive CORS with your deployed app origin.
- Add tests, monitoring, and deployment configuration.
