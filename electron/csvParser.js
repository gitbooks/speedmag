/**
 * CSV Bank Statement Parser
 *
 * Auto-detects format by inspecting headers, then maps to our Transaction schema.
 * Supported formats:
 *   - Chase (checking/credit)
 *   - Bank of America
 *   - Capital One
 *   - Wells Fargo
 *   - Citi
 *   - Generic (date, description, amount columns — any bank)
 */

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Parse a CSV string into array of row objects keyed by header */
function parseCSVRows(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  // Find first non-empty line as header
  const headerIdx = lines.findIndex((l) => l.trim().length > 0);
  if (headerIdx === -1) return [];

  const headers = splitCSVLine(lines[headerIdx]).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = splitCSVLine(line).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    if (vals.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }

  return rows;
}

/** Split a CSV line respecting quoted fields */
function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Parse a dollar string → number (handles negative, parens, commas) */
function parseDollar(s) {
  if (!s) return null;
  const clean = String(s).replace(/[$,\s]/g, '');
  if (!clean || clean === '-' || clean === '') return null;
  // Parentheses = negative: (100.00)
  if (clean.startsWith('(') && clean.endsWith(')')) return -Math.abs(parseFloat(clean.slice(1, -1)));
  return parseFloat(clean);
}

/** Parse various date formats → YYYY-MM-DD */
function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // MM/DD/YYYY or MM-DD-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m1) return `${m1[3]}-${m1[1].padStart(2, '0')}-${m1[2].padStart(2, '0')}`;
  // MM/DD/YY
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m2) {
    const yr = parseInt(m2[3]) < 50 ? `20${m2[3]}` : `19${m2[3]}`;
    return `${yr}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  }
  return null;
}

/** Detect which bank format we have by inspecting headers */
function detectFormat(headers) {
  const h = headers.join(',');

  // Chase: "transaction date,post date,description,category,type,amount"
  if (h.includes('transaction date') && h.includes('post date') && h.includes('type') && h.includes('amount'))
    return 'chase';

  // Capital One: "transaction date,posted date,card no.,description,category,debit,credit"
  if (h.includes('card no') || (h.includes('debit') && h.includes('credit') && h.includes('transaction date')))
    return 'capitalone';

  // Bank of America: "posted date,reference number,payee,address,amount"
  if (h.includes('reference number') && h.includes('payee'))
    return 'bofa';

  // Citi: "date,description,debit,credit"
  if (h.includes('debit') && h.includes('credit') && !h.includes('transaction date'))
    return 'citi';

  // Wells Fargo often has no headers — detected by column count elsewhere
  if (h.includes('check number') || (h.includes('date') && h.includes('amount') && h.includes('description')))
    return 'generic';

  return 'generic';
}

/** Convert a detected-format row to a standard transaction object */
function rowToTransaction(row, format, statementId) {
  let date, description, amount, type;

  if (format === 'chase') {
    date = parseDate(row['transaction date']);
    description = row['description'] || row['memo'] || '';
    amount = parseDollar(row['amount']);
    // Chase: negative = debit
    type = (amount !== null && amount >= 0) ? 'deposit' : 'withdrawal';
    if (amount !== null) amount = Math.abs(amount);

  } else if (format === 'capitalone') {
    date = parseDate(row['transaction date'] || row['posted date']);
    description = row['description'] || '';
    const debit = parseDollar(row['debit']);
    const credit = parseDollar(row['credit']);
    if (credit !== null && credit > 0) { amount = credit; type = 'deposit'; }
    else if (debit !== null && debit > 0) { amount = debit; type = 'withdrawal'; }
    else { amount = 0; type = 'withdrawal'; }

  } else if (format === 'bofa') {
    date = parseDate(row['posted date'] || row['date']);
    description = row['payee'] || row['description'] || '';
    amount = parseDollar(row['amount']);
    type = (amount !== null && amount >= 0) ? 'deposit' : 'withdrawal';
    if (amount !== null) amount = Math.abs(amount);

  } else if (format === 'citi') {
    date = parseDate(row['date']);
    description = row['description'] || '';
    const debit = parseDollar(row['debit']);
    const credit = parseDollar(row['credit']);
    if (credit !== null && credit > 0) { amount = credit; type = 'deposit'; }
    else if (debit !== null && debit > 0) { amount = debit; type = 'withdrawal'; }
    else { amount = 0; type = 'withdrawal'; }

  } else {
    // Generic: look for common column names
    date = parseDate(
      row['date'] || row['transaction date'] || row['posted date'] || row['trans date'] || ''
    );
    description = row['description'] || row['memo'] || row['payee'] || row['details'] ||
                  row['transaction details'] || row['narrative'] || '';

    // Try separate debit/credit columns first
    const debit = parseDollar(row['debit'] || row['debit amount'] || row['withdrawals'] || '');
    const credit = parseDollar(row['credit'] || row['credit amount'] || row['deposits'] || '');

    if (credit !== null && credit > 0) { amount = credit; type = 'deposit'; }
    else if (debit !== null && debit > 0) { amount = debit; type = 'withdrawal'; }
    else {
      // Fall back to single amount column
      const raw = parseDollar(row['amount'] || row['transaction amount'] || '');
      if (raw !== null) {
        type = raw >= 0 ? 'deposit' : 'withdrawal';
        amount = Math.abs(raw);
      } else {
        return null; // can't parse
      }
    }
  }

  if (!date || amount === null || isNaN(amount)) return null;
  if (!description.trim()) return null;

  return {
    id: uuidv4(),
    statementId,
    date,
    rawDate: date.slice(5), // MM-DD
    description: description.trim(),
    amount,
    balance: 0,
    type,
    category: 'Uncategorized',
    businessCategory: null,
    accountNumber: 'CSV Import',
  };
}

function parseCSVStatement(text, filename) {
  const rows = parseCSVRows(text);
  if (rows.length === 0) throw new Error('No rows found in CSV');

  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);

  const statementId = `stmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const transactions = [];

  for (const row of rows) {
    const txn = rowToTransaction(row, format, statementId);
    if (txn) transactions.push(txn);
  }

  if (transactions.length === 0) throw new Error('Could not parse any transactions. Check that your CSV has Date, Description, and Amount columns.');

  return { transactions, format };
}

module.exports = { parseCSVStatement };
