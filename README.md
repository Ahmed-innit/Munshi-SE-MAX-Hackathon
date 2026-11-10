# <Product Name>

> AI-Powered SE-MAX · CUI Tech Fest FA'26 · Team: <Team Commit-tea>

## What it does

- **Roman Urdu & Voice AI Command Engine:** Retailers record sales or credit by speaking or typing naturally in Roman Urdu (e.g., *"Bhai Tariq ko 850 udhaar diya"*, *"2 Tapal Tea aur 5kg Cheeni cash sale"*). The natural language parser extracts entities, item quantities, prices, and khata accounts without manual form entry.
- **Bi-Directional POS & Digital Parchi Generation:** Fast counter checkout supporting walk-in cash customers, regular ledger accounts, and split payments (partial cash + remaining udhaar). Generates instant digital receipts with print simulation.
- **OneLoad & Telecom Easyload Portal:** Built-in retailer wallet simulation featuring automatic mobile network prefix detection (Jazz, Telenor, Zong, Ufone), direct easyload top-ups, bundle activations, and transparent margin/commission calculations.
- **Khata Ledger & 1-Tap WhatsApp Recovery:** Tracks active credit balances, tags overdue accounts (>30 days), and generates one-click prefilled Roman Urdu WhatsApp payment reminders.
- **Offline-First Synchronization Engine:** Maintains full operational capability with zero internet connection via local storage and an outbox queue that automatically syncs and reconciles with the cloud database upon reconnection.

## Problem and user

- **The User:** Traditional Pakistani Kiryana store owners, general merchants, and dukan-daars (such as Haji Tariq at Madina Kiryana) working long hours in busy, fast-paced retail environments.
- **The Core Problem:** Paper registers cause untracked micro-credit, lost receivables, inaccurate inventory counts, and time wasted calculating daily totals. Existing enterprise software is complex, English-only, desktop-bound, and completely unusable during routine internet outages.
- **The Solution:** A mobile-first, ultra-responsive progressive web app optimized for low-end devices, Roman Urdu speech commands, seamless offline operation, and rapid WhatsApp debt recovery.

## Live deployment

- **URL / install link:** https://munshiproject.vercel.app/
- **Platform:** Vercel Edge Network (PWA / Mobile Web Shell)

## Judge quick start (under 5 minutes)

1. **Launch App:** Open the live deployment URL on your smartphone or desktop browser (mobile-frame view).
2. **Test Voice / AI Command:**
   - On the **Home** tab, tap one of the quick prompt chips (e.g., `"Bhai Tariq ko 850 rupay udhaar diya"` or `"Chaudhry Bashir ne 2000 wasooli di"`).
   - Review the AI Confirmation card that dynamically parses the name, amount, and transaction type.
3. **Execute a Counter Sale (POS):**
   - Click the central **Bikri** tab in the bottom bar.
   - Tap any item pill (e.g., *Dal Channa*, *Tapal Danedar*) to add to cart.
   - Select **Naqad** or **Split**, then click **Confirm & Generate Parchi** to inspect the receipt modal.
4. **Manage Credit & Debt Recovery:**
   - Switch to the **Udhaar** tab to view customer balances.
   - Tap a customer card to inspect the transaction history and review the auto-generated Roman Urdu WhatsApp message.
5. **Test Offline Sync Mode:**
   - Tap the **Synced** badge at the top right of the header to toggle between Cloud and Local offline mode.

## Test accounts

| Role | Username / email | Password |
| :--- | :--- | :--- |
| **Store Owner (Haji Tariq)** | `admin@madinakiryana.pk` | `MunshiAdmin2026!` |
| **Sales Assistant (Counter)** | `cashier@madinakiryana.pk` | `CounterPass2026!` |
| **Auditor / Judge** | `judge@techfest.pk` | `TechFestJudge2026` |


## Run locally

### Prerequisites
- Node.js (v18.0.0 or higher)
- PostgreSQL (v14+ if using local offline database) or access to the remote Supabase instance
- Git

### Setup
Clone the repository and enter the directory:
```bash
git clone [https://github.com/Ahmed-innit/Munshi-SE-MAX-Hackathon.git](https://github.com/Ahmed-innit/Munshi-SE-MAX-Hackathon.git)
cd Munshi-SE-MAX-Hackathon

### Environment variables

<!-- List variable names only. Values go in a local .env file (see .env.example). -->

### Run

### Run tests

## Known limitations
- Voice Synthesis in Offline Mode: Speech-to-text recognition defaults to standard browser Web Speech API heuristics when disconnected from cloud speech models.

- Hardware Printer Drivers: The thermal print button currently triggers browser-based print styling and simulated parchi rendering rather than a raw ESC/POS Bluetooth driver connection.

- Telecom Operator API Integration: Telecom wallet balances and easyload transfers utilize a simulated retail API sandbox mimicking OneLoad/JazzCash APIs.
## Documentation

- [Requirements](docs/requirements.md)
- [Design](docs/design.md)
- [Testing](docs/testing.md)
- [AI usage log](docs/ai-usage-log.md)
- [Judge checks](docs/judge-checks.md)

## Team

| Name | Role |
|------|------|
|   Ahmed   |   Database Architecture, Supabase Integration & Core System Documentation   |
|   Zainab   |   Frontend UI/UX/Frontend, Mobile Shell, POS Counter & Branding   |
|   Hooriya & Romaisa   |   Backend API, Outbox Sync Engine, SRS Module Parser & Deployment   |