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
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Enable Email auth in Authentication → Providers.
5. For production, configure Google OAuth in Supabase and the Google Cloud console, then add the redirect URLs shown by Supabase.
6. Install the Supabase CLI, link your project, then deploy the function:
   - `supabase functions deploy ai-chat`
   - `supabase secrets set OPENAI_API_KEY=your_server_side_key`
7. Invoke the Edge Function from an authenticated client. Never add provider secrets to `VITE_*` variables.

## Current implementation status

- Implemented: responsive dashboard, AI directory (32 platforms), category pages, search and filters, external official-site launch, favourites in current browser session, dark/light theme, chat workspace preview, Supabase email sign-up/sign-in/sign-out wiring.
- Starter backend included: RLS-protected profile/favourite/conversation schema and an authenticated OpenAI Edge Function.
- Not yet implemented: persistence wiring for favourites/conversations, Google OAuth UI flow, side-by-side multi-model comparison, image/video generation API connections, and API connections for providers other than the example OpenAI function. Do not advertise these as live until credentials, provider permissions, backend code, and tests are complete.

## Production checklist

- Add provider-specific adapters and model selection on the server.
- Add rate limits, quotas, abuse prevention, request logging without sensitive prompt retention, and cost controls.
- Add Google OAuth and password reset flows.
- Persist favourites and chat messages to Supabase with the included RLS policies.
- Validate provider terms, data handling, age requirements, and regional availability.
- Replace permissive CORS with your deployed app origin.
- Add tests, monitoring, and deployment configuration.
