# Munshi 🧾 — Offline-First Roman Urdu Assistant for Kiryana Shops

> Type or say what happened in the shop, in Roman Urdu. Munshi turns it into a draft, you confirm, and it is saved even without internet.

**Live demo:** https://munshi-two.vercel.app/
**Event:** AI-Powered SE-MAX Hackathon, CUI Tech Fest FA'26 (10 Nov 2026)

---

## 1. The problem

Small kiryana shop owners track stock and customer udhaar (credit) in notebooks or memory. Mistakes, forgotten balances and lost customers follow. Most business apps need English, forms and a stable connection, none of which suit a busy counter.

## 2. What Munshi does

The owner types a line such as:

> `Ali ko 2 kg chawal udhaar par diya`

1. A **rule-based Roman Urdu parser** turns it into a **Draft** (customer, items, quantity, price, direction).
2. The owner sees a **confirmation screen** and approves or edits it.
3. The entry is **saved locally first** (IndexedDB) and put in an **outbox**.
4. When online, it **syncs to the server** using idempotent operation IDs, so a retry never creates a duplicate.

If the parser is not sure about a name, amount, product or direction, it **asks one short Roman Urdu question** or sends the owner to manual entry. It never guesses.

## 3. Features

| Area | What it does |
|---|---|
| Stock | Products with quantities and low-stock alerts |
| Sales | Cash and udhaar sales, with stock deducted |
| Khata | Per-customer balances, payments received (wasooli) and returns |
| Parser | Roman Urdu understanding: `ko` / `ne` / `se` / `wapas`, fractions (adha, paun, sawa, derh, dhai), units, price per unit vs total |
| Audit trail | Append-only history; mistakes are fixed with **reversals**, not edits or deletes |
| Offline + sync | Entries survive reload and sync exactly once |
| Safety rules | A sale that would make stock negative is blocked, with a "record purchase" option. Overpayment and over-credit-limit warnings need a second confirmation |
| Stretch | Mobile packages/easyload, voice input (online only), WhatsApp-style reminders |

The app **works fully without AI or voice**. Both are optional extras.

## 4. How it works

```
Owner input (text / voice*)
        │
        ▼
 js/parser.js  ──►  Draft  ──►  Confirmation screen
 (rule-based)                          │ confirm
                                       ▼
                         IndexedDB (local)  +  Outbox
                                       │ online
                                       ▼
                    POST /api/sync  (idempotent operationId)
                                       │
                                       ▼
                       Supabase Postgres + processed_operations
```
\*Voice is online only and disabled offline.

**Sync status labels:** Saved locally → Sync pending → Syncing → Synced, or **Needs review** (the server rejected it; the local entry is kept so the owner can fix and resend, or reverse it). The server is authoritative for balances after sync.

### Key design decisions
- **Money** is stored as integer paisa. **Quantity** is stored as integer base units (g, ml, pieces). 1 kg = 1000 g, 1 dozen = 12. Rounding is half-up.
- **Direction:** `X ko ... udhaar diya` raises the balance. `X ne ... diye` and `X se ... liye` are payments that lower it. `X ne ... wapas kiya` (goods) is a return. `X ko ... wapas kiye` (money) is ambiguous, so the app asks.
- **Price:** `150 rupay kilo` is per unit. `5 kg 1500 ka` is a total. If it is unclear, the app asks.
- **One operation per business transaction**, with server-stored `operationId`s for idempotency.
- **AI keys stay server-side.** The browser never sees them.

## 5. Tech stack

- **Frontend:** HTML, CSS and vanilla JavaScript, deployed on Vercel
- **Local data:** IndexedDB with an outbox
- **Backend:** Node.js, Express, TypeScript
- **Database:** Supabase (Postgres)
- **Parser:** `js/parser.js`, pure JS with no dependencies, works in the browser and in Node
- **Tests:** Node built-in test runner (`node --test`)

## 6. Getting started

```bash
git clone https://github.com/Ahmed-innit/Munshi-SE-MAX-Hackathon.git
cd Munshi-SE-MAX-Hackathon

# configuration
cp .env.example .env        # fill in the values (see .env.example)

# frontend: open index.html, or serve the folder
npx serve .

# backend [adjust to your folder/scripts]
cd [backend-folder]
npm install
npm run dev
```

Environment variables are listed in `.env.example`. Never commit real keys.

## 7. Testing

```bash
node --test tests/*.test.js
```

The parser suite covers:
- direction (`ko` / `ne` / `se` / `wapas`)
- quantity, unit and fraction parsing
- per-unit vs total price and half-up rounding
- "never guess" behaviour (missing name, missing unit, zero quantity, gibberish)
- purity: the same input always gives the same Draft

Manual and end-to-end checks are in [`docs/testing.md`](docs/testing.md) and [`docs/judge-checks.md`](docs/judge-checks.md):
- save offline → reload → entry still there
- sync → replay → **no duplicate**
- oversell is blocked
- reversal keeps history and corrects the balance
- AI and voice off → app still works

## 8. Demo script (≈3 min)

1. **Normal flow:** type `Ali ko 2 kg chawal udhaar diya` → confirmation → saved.
2. **Offline:** turn the network off, add 2 entries, reload → they are still there ("Sync pending").
3. **Sync:** go online → entries sync → status changes to "Synced".
4. **Retry safety:** replay a sync → no duplicate balance change.
5. **Oversell:** try to sell more than the stock → blocked, with the "record purchase" option.
6. **Reversal:** reverse an entry → history is kept and the balance is corrected.
7. **Ambiguity:** `Ali ko 500 wapas kiye` → Munshi asks instead of guessing.

## 9. Responsible AI

- **Rules first, AI optional.** The core parser is deterministic and explainable. AI is an optional helper, and the app works without it.
- **Human in the loop.** Every entry shows a confirmation screen. Nothing is saved without the owner's approval.
- **No guessing.** Unclear names, amounts or directions trigger a question, never an assumption.
- **Privacy.** AI keys are server-side, and customer data is only sent where needed for sync. [Add what you send to AI, if anything.]
- **Auditability.** The history is append-only, and corrections are reversals.
- **Limits.** Roman Urdu spelling varies a lot, so the parser may ask for clarification. Voice accuracy depends on the speech service.

## 10. AI usage

Per the hackathon rules, AI assistance is logged in [`docs/ai-usage-log.md`](docs/ai-usage-log.md) (what was generated, what was reviewed, and what was changed by hand).

## 11. Project structure

```
index.html, css/, js/     frontend (js/parser.js = Roman Urdu parser)
tests/                    parser tests (node --test)
docs/                     SRS, testing, judge checks, draft contract, AI usage log
.github/                  organizer template
.env.example              required environment variables
README.md, SUBMISSION.md
```

See [`docs/draft-contract.md`](docs/draft-contract.md) for the parser's Draft format.

## 12. Known limitations

- One user role only (owner).
- Voice needs an internet connection.
- [Add anything still unfinished, such as packages or reminders, so judges see an honest status.]

## 13. Team

| Name | Role |
|---|---|
| [Name] | Backend (Node/Express/TypeScript, Supabase, `/api/sync`) |
| [Name] | Frontend |
| [Name] | Local database and outbox (IndexedDB) |
| Ahmed | Parser, tests, documentation, QA |

## 14. Licence

[Add licence or "Hackathon prototype, all rights reserved".]
