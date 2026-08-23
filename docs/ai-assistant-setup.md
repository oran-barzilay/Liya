# AI Assistant Setup (Google AI Studio)

This app now includes a shopping/tasks assistant in `Inventory`.

## What it can do now
- Answer questions about your shopping list (based on current inventory)
- Add inventory items from natural language
- Add tasks from natural language

Examples:
- `תוסיף חלב, ביצים וטיטולים`
- `מה חסר לי לקנייה השבוע?`
- `תיצור משימה להחליף מצעים מחר`
- `תוסיף משימה חזרתית לנקות קומקום בימי שישי ב-09:00`

## Required setup

1. Create a Google AI Studio API key
2. In Vercel project settings, add environment variable:
   - `GOOGLE_AI_API_KEY=<your-key>`
3. Redeploy

The backend endpoint is `api/assistant.ts` and runs on Vercel Edge Function.

## Security notes
- API key is server-side only (not exposed to browser)
- Frontend sends only app context (inventory/tasks) and user message
- Actual writes are done with existing Supabase mutations and RLS rules

## File map
- `api/assistant.ts` - Gemini bridge + structured action output
- `src/components/AiAssistantCard.tsx` - chat UI + action executor
- `src/pages/Inventory.tsx` - integration in shopping/inventory screen
- `vercel.json` - rewrite updated to allow `/api/*`

## Local dev note
Vite dev server does not run Vercel functions by default.
For local API testing use `vercel dev`.

