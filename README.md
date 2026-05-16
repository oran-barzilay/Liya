# Family ERP

Family household ERP foundation using React + Vite + TypeScript + Tailwind on the frontend and Supabase for database/auth.

## What Is Implemented

- Vite React app shell (`src/main.tsx`, `src/App.tsx`)
- Tailwind setup (`tailwind.config.ts`, `postcss.config.js`, `src/index.css`)
- Supabase schema + RLS + automation trigger (`supabase/migrations/001_init_family_erp.sql`)
- Domain models and state scaffolding (`src/types/*`, `src/state/*`)
- Supabase client bootstrap (`src/lib/supabase.ts`)

## 1) Run Locally

Copy the environment template and set your Supabase values:

```bash
cp .env.example .env
```

Install and run:

```bash
npm install
npm run dev
```

Optional checks:

```bash
npm run typecheck
npm run build
npm run smoke
```

## 2) Supabase Setup

1. Create a Supabase project.
2. In Supabase dashboard, open SQL Editor.
3. Run `supabase/migrations/001_init_family_erp.sql`.
4. In project settings, copy:
   - Project URL -> `VITE_SUPABASE_URL`
   - anon public key -> `VITE_SUPABASE_ANON_KEY`
5. Put values in local `.env` and Vercel env settings.

## 3) GitHub Setup

Initialize and push this repository:

```bash
git init
git add .
git commit -m "feat: family erp foundation with supabase and vite"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

If your repo already exists, only run `git add`, `git commit`, and `git push`.

## 4) Vercel Deployment

1. Go to Vercel -> New Project -> import the GitHub repo.
2. Framework preset should be Vite (also defined in `vercel.json`).
3. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

After each push to `main`, Vercel redeploys automatically.

## Notes

- Inventory low-threshold automation is SQL trigger based (transaction-safe).
- Edge Functions are still recommended for external notifications, not core business consistency.

