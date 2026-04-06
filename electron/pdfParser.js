/**
 * Navy Federal Credit Union Statement Parser (STMSSCM format)
 *
 * PDF two-column extraction order:
 *   Left column  → all dates + descriptions for ALL accounts (read first)
 *   Right column → all amounts + balances for ALL accounts (read second)
 *
 * The divider between columns is the "Business Checking - XXXXXXXXXX" label block.
 *
 * Extra complication: an "Items Paid" supplementary table appears in the description
 * block for months with debit-card transactions. These look like real date rows
 * ("MM-DD POS  18.58") but are NOT transactions — they must be skipped.
 */

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function parseCurrency(s) {
  return parseFloat(String(s).replace(/,/g, '')) || 0;
}

function getStatementDateFromFilename(filename) {
  const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { year: parseInt(m[1]), month: parseInt(m[2]) };
  return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
}

/** Returns {amount, balance} if line is a pure currency line, else null */
function parseAmountLine(raw) {
  const line = raw.trim();
  if (!line) return null;

  // Two-amount: "255.00   255.00" or "3,755.93   4,033.59" (optional trailing -)
  const two = line.match(/^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*-?\s*$/);
  if (two) return { amount: parseCurrency(two[1]), balance: parseCurrency(two[2]) };

  // Single-amount: "   0.00" or "4,033.60" (beginning/ending balances)
  const one = line.match(/^([\d,]+\.\d{2})\s*-?\s*$/);
  if (one) return { amount: parseCurrency(one[1]), balance: parseCurrency(one[1]), single: true };

  return null;
}

/** True if this description string is an "Items Paid" supplementary entry
 *  (not a real transaction). These start with a payment-type code immediately
 *  followed by a currency amount with no merchant name.
 *  Examples: "POS  18.58", "ACH  28.00 03-26 POS  21.66", "ATMO  100.0006-09ATMO  204.00"
 */
function isItemsPaid(desc) {
  return /^(POS|ACH|ATMO|ATME|CHCK|DDA)\s+[\d,]+\.\d{2}/i.test(desc);
}

/** Lines that should be completely skipped when collecting descriptions */
function isSkipLine(line) {
  const t = line.trim();
  if (!t) return true;
  // Headers — handle both spaced and squished variants
  if (/^Date\s*Transaction\s*Detail/i.test(t)) return true;
  if (/^Date\s*Item\s*Amount/i.test(t)) return true;
  if (/^No\s+Transactions\s+This\s+Period/i.test(t)) return true;
  if (/^For [A-Z ]+$/i.test(t)) return true;   // "For RADER LLC"
  if (/^\s*Page \d+ of \d+/i.test(t)) return true;
  if (/^(Checking|Savings|MMSA)\s*$/i.test(t)) return true;
  if (/^Items Paid\s*$/i.test(t)) return true;
  return false;
}

/** True if this is the account-label divider line */
function isAccountLabel(line) {
  return /^(Business Checking|Mbr Business Savings|Bus Money Mkt Savings|Business Savings)\s*[-–]\s*\d{6,}/i.test(
    line.trim()
  );
}

/** Strong keyword-based type override */
function getKeywordType(desc) {
  const u = desc.toUpperCase();
  const depositKw = ['DEPOSIT', ' CR ', 'ACH CR', 'DIRECT DEP', 'REFUND', 'DIVIDEND', 'INTEREST CR', 'ZELLE CR',
    'TRNSFR CR', 'POS CREDIT', 'CREDIT ADJ'];
  const withdrawalKw = ['WITHDRAWAL', ' DB ', 'ACH DB', 'ATM ', 'ATM\t', 'FEE -', 'CHARGE', 'TRNSFR DR',
    'ZELLE DR', 'POS DEBIT', 'PAID TO'];
  if (depositKw.some((k) => u.includes(k))) return 'deposit';
  if (withdrawalKw.some((k) => u.includes(k))) return 'withdrawal';
  return null;
}

function guessTypeFromDescription(desc) {
  const u = desc.toUpperCase();
  if (u.includes('GOOGLE') || u.includes('YOUTUBE') || u.includes('ADSENSE')) return 'deposit';
  if (u.includes('STRIPE') && !u.includes('PAID TO')) return 'deposit';
  if (u.includes('TRANSFER FROM') || u.includes('TRNSFR FROM')) return 'deposit';
  if (u.includes('TRANSFER TO') || u.includes('TRNSFR TO')) return 'withdrawal';
  return 'withdrawal';
}

function parseNFCUStatement(rawText, filename) {
  const { year, month: stmtMonth } = getStatementDateFromFilename(filename);
  const lines = rawText.split('\n');

  // ── Phase 1: scan lines ────────────────────────────────────────────────────
  const descRows = [];       // { date, description, rowType }
  const accountNumbers = []; // in order from divider block
  const amtRows = [];        // { amount, balance, [single] }

  let phase = 'desc'; // 'desc' | 'divider' | 'amounts'
  let currentRow = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // ── Transition to divider phase when we hit account-label line ──
    if (phase === 'desc' && isAccountLabel(line)) {
      phase = 'divider';
    }

    // ── Desc phase ────────────────────────────────────────────────────────
    if (phase === 'desc') {
      if (isSkipLine(line)) { currentRow = null; continue; }

      // Date line — NFCU uses "MM-DD " (with space) or "MM-DDDescription" (no space)
      // Pattern: two digits, hyphen, two digits, then any text
      const dm = line.match(/^(\d{2}-\d{2})\s*(.*)/);
      if (dm) {
        const desc = dm[2].trim();
        // ── Items Paid filter ──
        if (isItemsPaid(desc)) {
          currentRow = null; // don't let continuation lines attach here
          continue;
        }
        const rowType = /beginning balance/i.test(desc)
          ? 'begin'
          : /ending balance/i.test(desc)
          ? 'end'
          : 'transaction';
        currentRow = { date: dm[1], description: desc, rowType };
        descRows.push(currentRow);
      } else if (currentRow) {
        // Continuation of previous row's description (e.g. "Amzn.Com/Bill WA")
        // Skip obvious non-description fragments
        if (!/^\d{4,}$/.test(line)) { // skip bare account numbers
          currentRow.description += ' ' + line;
        }
      }
      continue;
    }

    // ── Divider phase ─────────────────────────────────────────────────────
    if (phase === 'divider') {
      const am = line.match(
        /^(Business Checking|Mbr Business Savings|Bus Money Mkt Savings|Business Savings)\s*[-–]\s*(\d{6,})/i
      );
      if (am) accountNumbers.push(am[2]);

      // Transition to amounts on first pure-amount line
      const amt = parseAmountLine(line);
      if (amt) {
        phase = 'amounts';
        amtRows.push(amt);
      }
      continue;
    }

    // ── Amounts phase ─────────────────────────────────────────────────────
    if (phase === 'amounts') {
      const amt = parseAmountLine(line);
      if (amt) amtRows.push(amt);
    }
  }

  // ── Phase 2: zip descRows with amtRows → build transactions ──────────────
  const transactions = [];
  let accountIdx = -1;
  const prevBalance = {}; // accountIdx → last known balance

  // Zip conservatively — if counts differ, use the minimum
  const len = Math.min(descRows.length, amtRows.length);

  for (let i = 0; i < len; i++) {
    const row = descRows[i];
    const amt = amtRows[i];

    if (row.rowType === 'begin') {
      accountIdx = Math.max(0, accountIdx + 1);
      prevBalance[accountIdx] = amt.amount;
      continue;
    }
    if (row.rowType === 'end') continue;

    const accountNumber = accountNumbers[accountIdx] ?? 'Unknown';

    // Determine type from balance delta (credit = balance goes up)
    const prev = prevBalance[accountIdx] ?? 0;
    let type;
    if (!amt.single && amt.balance !== amt.amount) {
      type = amt.balance >= prev - 0.005 ? 'deposit' : 'withdrawal';
    } else {
      type = guessTypeFromDescription(row.description);
    }
    prevBalance[accountIdx] = amt.balance;

    // Override with strong keyword signals
    const kwType = getKeywordType(row.description);
    if (kwType) type = kwType;

    // Build ISO date, handling year rollovers
    const [txnMonthStr, txnDayStr] = row.date.split('-');
    const txnMonth = parseInt(txnMonthStr);
    let txnYear = year;
    if (stmtMonth === 1 && txnMonth === 12) txnYear = year - 1;
    if (stmtMonth === 12 && txnMonth === 1) txnYear = year + 1;
    const isoDate = `${txnYear}-${txnMonthStr}-${txnDayStr}`;

    transactions.push({
      id: uuidv4(),
      date: isoDate,
      rawDate: row.date,
      description: row.description.trim(),
      amount: amt.amount,
      balance: amt.balance,
      type,
      category: 'Uncategorized',
      businessCategory: null,
      accountNumber,
    });
  }

  return transactions;
}

module.exports = { parseNFCUStatement };
