# KaushalPramaan
AI-assisted Recognition of Prior Learning (RPL) assessment console.
Smart India Hackathon 2026, PS 26242 (Smart Education).

## Working in this prototype
- Voice self-declaration (Web Speech API, Hindi/English and other Indian languages)
- Field extraction from Hindi/English declarations: name, years, tasks, tools
- QP matching with TF-IDF + cosine similarity over 5 NSQF Qualification Packs,
  with the matched terms shown for each NOS (explainable top-3)
- PC-level rubric scoring with advisory checks (safety-critical PCs, missing evidence)
- Evidence capture: SHA-256 file hash, timestamp, geo-tag, hash-chained ledger
  with chain verification and a tamper test
- Offline mode with an outbox that syncs automatically on reconnect
- Inter-assessor agreement (Fleiss' kappa) and score spread
- Signed competency profile, exportable as JSON

## Simulated or planned
- Parsing and matching are rule-based / TF-IDF in the browser; the full design uses an LLM and LaBSE embeddings
- Co-assessor scores used for kappa are generated
- Sync goes to a local stub unless API_BASE is set (FastAPI backend planned)
- State is in memory; IndexedDB + service worker are next
- PC text is condensed; QP and NOS codes are from NQR

## Run
npm install && npm run dev