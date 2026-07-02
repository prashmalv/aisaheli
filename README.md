# 🤝 AI Saheli — MoWCD Demo

A mobile-first, browser-based AI assistant demo for the **Ministry of Women & Child Development (MoWCD)**, focused on three flagship schemes:

- **Poshan Abhiyaan** — nutrition, maternal & child health, Anganwadi, PMMVY
- **Mission Vatsalya** — child protection, CHILDLINE 1098, adoption (CARA)
- **Mission Shakti** — women's safety, Helpline 181, One Stop Centres

It has two faces:

1. **Citizen app** — a multilingual (Hindi / English), voice-and-text chat assistant with scheme cards and quick helplines, designed to feel like a real phone app.
2. **Ministry dashboard** — an analytics view of citizen interactions (top questions, regional hotspots, language mix, emerging concerns).

The assistant is powered by **Azure OpenAI (gpt-4o-mini)**. If no key/endpoint is configured it automatically falls back to curated scripted answers, so the demo always works in front of an audience.

**Live demo:** https://ai-saheli-egov-poc.azurewebsites.net

---

## Quick start

```bash
# 1. Install
npm install

# 2. (Recommended) add your Anthropic API key so the AI is truly conversational
cp .env.example .env
#   then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run in dev (frontend on :5173, API on :3001, hot reload)
npm run dev
#   open http://localhost:5173
```

> No API key? It still runs — in **Demo mode** with high-quality scripted answers for the common questions. The header pill shows whether you're **Live** (Claude) or in **Demo mode**.

### Production-style single-server run

```bash
npm run serve      # builds the frontend, then serves everything from :3001
#   open http://localhost:3001
```

---

## Configuration (`.env`)

| Variable                  | Default        | Purpose                                                        |
| ------------------------- | -------------- | -------------------------------------------------------------- |
| `AZURE_OPENAI_ENDPOINT`   | _(none)_       | Azure OpenAI v1 endpoint (`https://<res>.openai.azure.com/openai/v1`) |
| `AZURE_OPENAI_API_KEY`    | _(none)_       | API key. Without endpoint+key → scripted mode                  |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o-mini`  | Deployment (model) name in Azure AI Foundry                    |
| `PORT`                    | `3001`         | Express server port                                            |

## Deployed on Azure

- **App:** Azure App Service (Linux, Node 22, **B1** plan) — `ai-saheli-egov-poc`
- **Resource group:** `ai-saheli-rg` (region: Central India)
- **AI:** existing `gpt-4o-mini` deployment on `egov-poc-proj-two-rjt-resource`
- The API key lives in **App Service application settings** (`AZURE_OPENAI_API_KEY`), not in the repo.

Redeploy after code changes:
```bash
npm run build   # optional; Azure also builds on deploy
zip -r /tmp/saheli.zip . -x "node_modules/*" "dist/*" ".git/*" ".env" "*.log"
az webapp deploy -g ai-saheli-rg -n ai-saheli-egov-poc --src-path /tmp/saheli.zip --type zip
```
Stop all billing for the demo: `az group delete -n ai-saheli-rg`.

---

## How it works

```
Browser (React, mobile-first)
   │  POST /api/chat   (streams tokens)
   ▼
Express server  ──►  Azure OpenAI · gpt-4o-mini (system prompt = scheme knowledge base)
   │                    └─ falls back to scripted answers on error / no key
   ├─ GET /api/dashboard  → mock analytics
   └─ GET /api/health     → live/scripted mode + suggested questions
```

- **Scheme knowledge** for accurate answers lives in `server/knowledge.js` (baked into the system prompt, prompt-cached).
- **Scripted fallback** lives in `server/fallback.js` (bilingual, keyword-matched).
- **Safety-first**: distress / abuse / missing-child messages always surface **181 / 1098 / 112** first.
- **Voice input** uses the browser Web Speech API (mic button in chat). Best in Chrome/Edge.

---

## Turning this into a native app later

The whole thing is a standard web app, so it can be wrapped in a WebView / [Capacitor](https://capacitorjs.com/) shell to ship as an Android/iOS app opening the same UI — no rewrite needed.

---

## Project structure

```
AI Saheli/
├─ server/            Express API
│  ├─ index.js        routes: /api/chat (stream), /api/dashboard, /api/health
│  ├─ knowledge.js    scheme knowledge + Claude system prompt + starters
│  ├─ fallback.js     scripted bilingual answers (offline mode)
│  └─ dashboard.js    mock ministry analytics
├─ src/               React frontend
│  ├─ App.jsx         device shell, header, tab bar
│  ├─ components/     Home, Chat, Dashboard
│  ├─ data.js         scheme cards, helplines, i18n strings
│  └─ styles.css      mobile-first theme (MWCD magenta + tricolor)
└─ index.html
```

---

_Confidential — prepared by Uneecops Technologies for the Ministry of Women & Child Development. Scheme details are indicative and for demonstration; verify against official MoWCD sources before public use._
