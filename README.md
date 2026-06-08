# Riki McClure — Academic Sales Cycle Dashboard (v2)

Next.js dashboard rebuilt from Zoho exports (pulled 2026-06-08). Extends the original
opportunity/stage-history views with a new **Lead → Opp Funnel** tab that computes the
true lead-to-opportunity conversion rate (the denominator the opp-only dashboard lacked).

## Data
- `data/opportunities.json` — 346 Riki opps (stage, amount, cycle, loss reason, origin)
- `data/stage_history.json` — 1,102 stage transitions
- `data/leads.json` — 371 academic leads (125 converted = 33.7%)
- `data/meta.json` — counts + pull date

Regenerate from source exports with `process_data.py` (kept at repo root).

## Run locally
    npm install
    npm run dev        # http://localhost:3000

## Deploy to Vercel
Push to the connected GitHub repo (auto-deploys), or from this folder:
    npm i -g vercel
    vercel --prod
