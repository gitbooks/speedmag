/**
 * Auto-categorizer for transactions.
 * Sets category (Business/Personal/Transfer/Uncategorized)
 * and businessCategory for known transaction types.
 *
 * Order of checks:
 *  1. BUSINESS_RULES (most specific — checked first so Stripe/Google beats Transfer)
 *  2. PERSONAL_RULES
 *  3. TRANSFER_RULES (only internal NFCU account moves)
 *  4. Fallback → Uncategorized
 */

const BUSINESS_RULES = [
  // ── Income sources ────────────────────────────────────────────────────────
  { pattern: /google|adsense|youtube/i,                 cat: 'Business', bizCat: 'Advertising & Marketing' },
  { pattern: /facebook ads?|meta ads?|instagram ad|twitter ad|linkedin ad/i, cat: 'Business', bizCat: 'Advertising & Marketing' },
  { pattern: /mailchimp|klaviyo|hubspot|activecampaign/i, cat: 'Business', bizCat: 'Advertising & Marketing' },

  // ── Payment processors ────────────────────────────────────────────────────
  // Stripe appears in "Deposit - ACH Paid From Stripe Transfer" AND "Paid To - Stripe Transfer"
  { pattern: /stripe/i,   cat: 'Business', bizCat: 'Payment Processing' },
  { pattern: /paypal/i,   cat: 'Business', bizCat: 'Payment Processing' },
  { pattern: /square/i,   cat: 'Business', bizCat: 'Payment Processing' },

  // ── Software & Subscriptions ──────────────────────────────────────────────
  { pattern: /microsoft|office 365|azure/i,             cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /apple\.com|itunes|app store/i,             cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /amazon web|aws/i,                          cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /adobe|figma|canva/i,                       cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /github|atlassian|jira|slack|zoom|notion|dropbox|cloudflare/i, cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /godaddy|namecheap|wix|shopify|squarespace/i, cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /openai|anthropic|midjourney/i,             cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /quickbooks|intuit/i,                       cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /envato|envat/i,                            cat: 'Business', bizCat: 'Software & Subscriptions' },
  { pattern: /bambulab|bambu/i,                          cat: 'Business', bizCat: 'Software & Subscriptions' },
  // US.Store.Bambulab = 3D printer supplies/hardware
  { pattern: /us\.store\.bambu|us\.store/i,              cat: 'Business', bizCat: 'Office & Supplies' },

  // ── Amazon (must come AFTER AWS check) ────────────────────────────────────
  // Amzn / Amazon Marketplace purchases
  { pattern: /amzn|amazon mktpl|amazon mktplace|amazon\.com/i, cat: 'Business', bizCat: 'Office & Supplies' },
  { pattern: /amazon(?! web)/i,                          cat: 'Business', bizCat: 'Office & Supplies' },

  // ── Banking & Fees ────────────────────────────────────────────────────────
  { pattern: /service fee|monthly fee|account fee|wire fee|overdraft/i, cat: 'Business', bizCat: 'Banking & Fees' },
  { pattern: /atm fee|atm\s+fee/i,                       cat: 'Business', bizCat: 'Banking & Fees' },
  { pattern: /dividend|interest earned/i,                cat: 'Business', bizCat: 'Bank Dividend' },

  // ── Professional Services ──────────────────────────────────────────────────
  { pattern: /attorney|lawyer|legal|cpa|accountant|bookkeep/i, cat: 'Business', bizCat: 'Professional Services' },
  { pattern: /fiverr|upwork|freelancer/i,                cat: 'Business', bizCat: 'Professional Services' },

  // ── Utilities ──────────────────────────────────────────────────────────────
  { pattern: /at&t|verizon|t-mobile|comcast|xfinity|spectrum|cox/i, cat: 'Business', bizCat: 'Utilities' },
  { pattern: /electric|gas company|water bill|utility/i, cat: 'Business', bizCat: 'Utilities' },

  // ── Office & Supplies ──────────────────────────────────────────────────────
  { pattern: /staples|office depot|office max/i,         cat: 'Business', bizCat: 'Office & Supplies' },
  { pattern: /best buy|costco/i,                         cat: 'Business', bizCat: 'Office & Supplies' },
  { pattern: /home depot|lowes|lowe's/i,                 cat: 'Business', bizCat: 'Office & Supplies' },

  // ── Travel & Transportation ────────────────────────────────────────────────
  { pattern: /airline|delta air|united air|southwest|american air|spirit air/i, cat: 'Business', bizCat: 'Travel & Transportation' },
  { pattern: /hotel|marriott|hilton|hyatt|airbnb|vrbo/i, cat: 'Business', bizCat: 'Travel & Transportation' },
  { pattern: /uber(?!\s+eats)|lyft|taxi|car rental|enterprise rent/i, cat: 'Business', bizCat: 'Travel & Transportation' },

  // ── Meals & Entertainment ──────────────────────────────────────────────────
  { pattern: /restaurant|mcdonald|starbucks|chick-fil|chipotle|doordash|grubhub|uber eats/i, cat: 'Business', bizCat: 'Meals & Entertainment' },

  // ── POS Credit Adjustments / Refunds ──────────────────────────────────────
  { pattern: /pos credit adjustment/i,                   cat: 'Business', bizCat: 'Other Business' },
];

// Only match INTERNAL NFCU transfers (not "Stripe Transfer", "ACH Transfer", etc.)
const TRANSFER_RULES = [
  /transfer to shares/i,
  /transfer from chk\/mmsa/i,
  /navy federal trnsfr/i,
  /trnsfr (to|from) (chk|mmsa|savings|checking)/i,
  /internal xfr/i,
  /nameoffice llc/i,      // Known internal company transfer
];

const PERSONAL_RULES = [
  /atm withdrawal/i,
  /personal/i,
];

function autoCategorize(transaction) {
  const desc = transaction.description || '';

  // 1. Business rules first (most specific)
  for (const rule of BUSINESS_RULES) {
    if (rule.pattern.test(desc)) {
      return { ...transaction, category: rule.cat, businessCategory: rule.bizCat };
    }
  }

  // 2. Personal rules
  for (const pat of PERSONAL_RULES) {
    if (pat.test(desc)) {
      return { ...transaction, category: 'Personal', businessCategory: null };
    }
  }

  // 3. Internal transfer rules
  for (const pat of TRANSFER_RULES) {
    if (pat.test(desc)) {
      return { ...transaction, category: 'Transfer', businessCategory: null };
    }
  }

  // 4. Fallback — user must categorize
  return { ...transaction, category: 'Uncategorized', businessCategory: null };
}

module.exports = { autoCategorize };
