# Dev Anxiety Killer (code-clarity)

A tiny app that explains code in simple technical language with less jargon.

## Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- LLM: Groq (BYOK)

## Features in Layer 1
- Paste code and request explanation
- Output sections:
  - Job of the code
  - Key breakdown
  - Plumbing and systems view
  - Summary
- Bring-your-own key (never stored)
- Mock response fallback when key is missing

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## API

`POST /api/explain`

Request body:

```json
{
  "apiKey": "optional",
  "code": "your code snippet",
  "language": "javascript",
  "model": "llama-3.1-8b-instant"
}
```

## Important security note
If an API key is ever pasted publicly (chat, screenshots, commits), rotate it immediately in provider settings.
# code-clarity
