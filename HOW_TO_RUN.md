# Rader Financial Planner — Setup & Run Guide

## First-Time Setup (do once)

Open Terminal, then:

```bash
cd "/Users/Michael/Desktop/RaderLLC Financial Planner"
npm install
```

## Run the App (every time)

```bash
cd "/Users/Michael/Desktop/RaderLLC Financial Planner"
npm run dev
```

This starts the Vite dev server AND launches the Electron desktop app automatically.

---

## How to Use

### 1. Import Statements
- Click **Import Statements** in the sidebar
- Click the drop zone (or drag-and-drop your Navy Federal PDF statements)
- All 6 months will be parsed and auto-categorized automatically

### 2. Review & Categorize Transactions
- Click **Transactions** in the sidebar
- The app auto-categorizes into: **Business**, **Personal**, **Transfer**, or **Uncategorized**
- Click any transaction row to open the categorization modal
- Choose: Business / Personal / Transfer / Uncategorized
- For **Business** transactions, select a sub-category (Advertising & Marketing, Software & Subscriptions, etc.)
- Check "Apply to similar transactions" to bulk-categorize matching descriptions at once
- Use the bulk selector (checkboxes) to categorize multiple transactions at once

### 3. View Reports
- Click **Reports** in the sidebar
- **P&L Statement** — Monthly income, expenses, net income, and margins
- **Cash Flow** — Bar chart + table of monthly cash in/out
- **Expense Breakdown** — Pie chart of business expenses by category
- **Tax Summary** — Schedule C-style deductible expenses list

### 4. Export
- In **Transactions**, click **Export CSV** to save all filtered transactions

---

## Business Categories Available

| Category | Used For |
|---|---|
| Advertising & Marketing | Google, YouTube, AdSense, Meta Ads |
| Payment Processing | Stripe, PayPal, Square income/fees |
| Software & Subscriptions | AWS, Adobe, GitHub, Envato, etc. |
| Banking & Fees | ATM fees, account fees, dividends |
| Bank Dividend | Interest/dividend income |
| Professional Services | Legal, accounting, contractors |
| Office & Supplies | Amazon, Costco, general supplies |
| Utilities | Phone, internet, electricity |
| Travel & Transportation | Airlines, hotels, Uber |
| Meals & Entertainment | Restaurants, DoorDash |
| Payroll & Contractors | Staff payments |
| Business Income | General business revenue |
| Other Business | Anything else business-related |

---

## Where Data is Stored

All data is saved locally at:
`~/Library/Application Support/rader-financial-planner/financial-data.json`

Nothing leaves your Mac — no cloud, no uploads.

---

## Build a Distributable .app (optional)

```bash
cd "/Users/Michael/Desktop/RaderLLC Financial Planner"
npm run dist
```

The `.dmg` installer will appear in the `release/` folder.
