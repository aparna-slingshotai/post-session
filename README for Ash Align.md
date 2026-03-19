# Ash Align

A mediated conversation space for couples. Two participants join a shared room and go through AI-facilitated phases — **Intake** (private 1:1 with Ash), **Commons** (joint conversation), and **Conclusion** (AI-generated summary).

**Live:** https://alignwithash.com/

## Tech Stack

Next.js 16, TypeScript, Tailwind CSS 4, Supabase (Postgres), Anthropic SDK, p5.js + p5.brush.

## Deploying

The app deploys on [Vercel](https://vercel.com). You do not need to run it locally.

### What you need

- A **GitHub** account (to push code)
- A **Vercel** account (to deploy — free tier works)
- A **Supabase** project with the schema already applied (see below)
- An **Anthropic API key** from https://console.anthropic.com/

### 1. Set up the database

The schema is in `supabase/migrations/20260312151526_initial_schema.sql`. Open your Supabase project dashboard, go to **SQL Editor**, paste the file contents, and run it. This creates the `rooms`, `participants`, and `messages` tables with RLS policies.

You only need to do this once. The app does not run migrations at deploy time.

### 2. Push to GitHub

Push this repo to a GitHub repository (public or private).

### 3. Import into Vercel

1. Go to https://vercel.com/new and import the GitHub repo.
2. Add these environment variables in **Project Settings > Environment Variables**:

| Variable | Value | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Dashboard > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon / public key) | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key) | Same page — keep this secret |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | https://console.anthropic.com/ |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` (optional) | Defaults to claude-sonnet-4-6 if omitted |

3. Deploy. Vercel auto-detects Next.js and handles the build.

### 4. Custom domain (optional)

Configure in **Vercel > Project Settings > Domains** and update your DNS.

## Required Permissions

**Supabase:** The anon key is used client-side (read-only via RLS). The service role key is used server-side in API routes to bypass RLS for writes. No Supabase Auth or user accounts are involved.

**Anthropic:** The API key needs Messages API access (`messages.create`).

**GitHub:** Push access to the repo.

**Vercel:** Permission to import and deploy projects.

## Local Development (optional)

If you do want to run locally, you'll need Node.js 20+, a `.env.local` with the variables listed above, and `npm install && npm run dev`. The Supabase database must already exist and have the schema applied — there is no way to push migrations from the dev environment.

## Project Structure

See `CLAUDE.md` for a full architecture reference, including the database workaround patterns, prompt engineering notes, phase flow, and component details.
