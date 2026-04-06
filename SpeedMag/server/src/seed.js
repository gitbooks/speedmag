const pool = require('./db');

const ideas = [
  // Submitted
  {
    title: 'Windows version',
    description: 'Would love to use SpeedMag on my Windows PC at work. The Mac version is great but I need cross-platform support for my team.',
    author_name: 'Chris P.',
    status: 'submitted',
    upvote_count: 134,
  },
  {
    title: 'Invoice generation',
    description: 'It would be amazing to create and send invoices directly from SpeedMag. Auto-fill client details, add line items, and track payment status.',
    author_name: 'Rachel S.',
    status: 'submitted',
    upvote_count: 97,
  },
  {
    title: 'Receipt scanning via phone camera',
    description: 'A companion iOS/Android app that lets me snap a photo of a receipt and have it automatically categorized and added to my books.',
    author_name: 'David L.',
    status: 'submitted',
    upvote_count: 82,
  },
  {
    title: 'Direct bank sync via API',
    description: 'Instead of manually downloading CSVs, connect directly to my bank and pull transactions automatically. Even if it\'s a paid add-on.',
    author_name: 'Amanda K.',
    status: 'submitted',
    upvote_count: 71,
  },
  {
    title: 'Mileage tracking for tax deductions',
    description: 'I drive a lot for work. A built-in mileage log that calculates the IRS standard deduction would save me so much time at tax season.',
    author_name: null,
    status: 'submitted',
    upvote_count: 45,
  },

  // Under Review
  {
    title: 'Dark mode for the app UI',
    description: 'The current light theme is fine but I work late and a dark mode would be much easier on the eyes. Bonus if it matches the website aesthetic.',
    author_name: 'Tyler M.',
    status: 'under_review',
    upvote_count: 112,
    admin_response: 'Love this idea! We\'re evaluating the best approach for a system-aware dark mode that respects your macOS appearance settings.',
  },
  {
    title: 'Multi-currency support',
    description: 'I receive payments in USD, EUR, and GBP. Need the ability to track different currencies and see converted totals in my home currency.',
    author_name: 'Sofia R.',
    status: 'under_review',
    upvote_count: 68,
    admin_response: 'This is on our radar. We\'re researching reliable exchange rate APIs and how to handle historical rate snapshots for accurate reporting.',
  },
  {
    title: 'CSV template customization',
    description: 'My credit union exports CSVs in a slightly different format. Let me define custom column mappings so I can import from any bank.',
    author_name: 'Greg H.',
    status: 'under_review',
    upvote_count: 53,
    admin_response: 'Great suggestion. We\'re designing a column-mapping UI that will let you define custom import templates and save them for reuse.',
  },

  // In Progress
  {
    title: 'Recurring transaction rules',
    description: 'I pay the same subscriptions every month. Let me set up rules that auto-categorize transactions matching certain descriptions so I don\'t have to do it manually every time.',
    author_name: 'Jennifer W.',
    status: 'in_progress',
    upvote_count: 89,
    admin_response: 'Actively building this! You\'ll be able to create rules based on description keywords. When a matching transaction is imported, it\'ll be auto-categorized instantly.',
  },
  {
    title: 'Enhanced PDF report formatting',
    description: 'The PDF exports work but could look more polished. Add the company logo, better typography, and maybe a cover page for the full financial package.',
    author_name: 'Marcus T.',
    status: 'in_progress',
    upvote_count: 61,
    admin_response: 'Working on this now. The new reports will include your business name, logo, and professional formatting. Expect this in the next update.',
  },
  {
    title: 'Year-over-year comparison in reports',
    description: 'Show me this year vs last year side-by-side in the P&L and cash flow reports. Would make it easy to spot trends and growth.',
    author_name: 'Linda C.',
    status: 'in_progress',
    upvote_count: 47,
    admin_response: 'In development. The comparison view will let you overlay any two time periods across all report types.',
  },

  // Shipped
  {
    title: 'Auto-categorization engine',
    description: 'Automatically sort imported transactions into Business, Personal, or Transfer categories based on intelligent pattern matching.',
    author_name: 'SpeedMag Team',
    status: 'shipped',
    upvote_count: 156,
    admin_response: 'Shipped in v1.0! The auto-categorizer uses keyword matching and learns from your corrections. Handles the majority of transactions on import.',
    changelog_url: '#',
  },
  {
    title: 'Multi-business profiles',
    description: 'Support for running multiple businesses from a single app, each with completely separate books, transactions, and reports.',
    author_name: 'Karen M.',
    status: 'shipped',
    upvote_count: 143,
    admin_response: 'Live now! Create color-coded profiles and switch between them instantly. Each profile has fully isolated data.',
    changelog_url: '#',
  },
  {
    title: 'Navy Federal PDF import',
    description: 'Direct PDF statement import for Navy Federal Credit Union members. No need to convert to CSV first.',
    author_name: 'Tony R.',
    status: 'shipped',
    upvote_count: 128,
    admin_response: 'Shipped! NFCU\'s unique PDF format is fully supported. Just drag and drop your statement PDF and SpeedMag handles the rest.',
    changelog_url: '#',
  },
  {
    title: 'Inventory tracking with COGS',
    description: 'Full inventory management that tracks stock levels, records purchases and sales, and feeds Cost of Goods Sold into the P&L automatically.',
    author_name: 'Derek W.',
    status: 'shipped',
    upvote_count: 94,
    admin_response: 'Available now! Track SKUs, set reorder points, and your inventory value automatically appears on the Balance Sheet.',
    changelog_url: '#',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    // Clear existing data
    await client.query('DELETE FROM upvotes');
    await client.query('DELETE FROM ideas');
    await client.query('ALTER SEQUENCE ideas_id_seq RESTART WITH 1');

    for (const idea of ideas) {
      await client.query(`
        INSERT INTO ideas (title, description, author_name, status, upvote_count, admin_response, changelog_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        idea.title,
        idea.description,
        idea.author_name,
        idea.status,
        idea.upvote_count,
        idea.admin_response || null,
        idea.changelog_url || null,
      ]);
    }

    console.log(`Seeded ${ideas.length} ideas across all columns.`);
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
