import initSqlJs, { Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'supermarket.sqlite');

let dbInstance: Database | null = null;

let inTransaction = false;

// Helper to run query with params and return array of objects
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const sanitized = params.map((p) => (p === undefined ? null : p));
  const stmt = dbInstance.prepare(sql);
  try {
    stmt.bind(sanitized);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function runExec(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  if (params.length === 0) {
    dbInstance.run(sql);
  } else {
    const sanitized = params.map((p) => (p === undefined ? null : p));
    const stmt = dbInstance.prepare(sql);
    try {
      stmt.run(sanitized);
    } finally {
      stmt.free();
    }
  }
  if (!inTransaction) {
    persistDb();
  }
}

export function runTransaction<T>(fn: () => T): T {
  if (!dbInstance) throw new Error('Database not initialized');
  if (inTransaction) {
    return fn();
  }
  inTransaction = true;
  let transactionStarted = false;
  try {
    dbInstance.run('BEGIN TRANSACTION');
    transactionStarted = true;
  } catch (beginErr) {
    console.warn('BEGIN TRANSACTION notice:', beginErr);
  }

  try {
    const result = fn();
    if (transactionStarted) {
      try {
        dbInstance.run('COMMIT');
      } catch (commitErr) {
        console.warn('COMMIT notice:', commitErr);
      }
    }
    inTransaction = false;
    persistDb();
    return result;
  } catch (err) {
    inTransaction = false;
    if (transactionStarted) {
      try {
        dbInstance.run('ROLLBACK');
      } catch (rollbackErr) {
        // SQLite transaction might have already aborted on constraint failure
        console.warn('Safe rollback ignored notice:', rollbackErr);
      }
    }
    throw err;
  }
}

export function persistDb() {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (e) {
    console.error('Failed to persist database file:', e);
  }
}

export function getDatabaseExport(): Buffer {
  if (!dbInstance) throw new Error('Database not initialized');
  return Buffer.from(dbInstance.export());
}

export function restoreDatabase(buffer: Buffer): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.close();
  // We'll re-init
  fs.writeFileSync(DB_FILE, buffer);
}

export function addAuditLog(
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  entityType: string,
  entityId: string,
  oldVal?: any,
  newVal?: any,
  reason?: string
) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  runExec(
    `INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, entity_type, entity_id, old_value, new_value, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      timestamp,
      userId,
      userName,
      userRole,
      action,
      entityType,
      entityId,
      oldVal ? (typeof oldVal === 'string' ? oldVal : JSON.stringify(oldVal)) : null,
      newVal ? (typeof newVal === 'string' ? newVal : JSON.stringify(newVal)) : null,
      reason || null,
    ]
  );
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      console.log('Loaded existing database from', DB_FILE);
      return dbInstance;
    } catch (err) {
      console.error('Failed to load existing DB file, creating fresh:', err);
    }
  }

  dbInstance = new SQL.Database();
  console.log('Creating fresh schema and seeding database...');
  createSchema(dbInstance);
  seedInitialData(dbInstance);
  persistDb();
  return dbInstance;
}

function createSchema(db: Database) {
  db.run(`
    -- Users and Authentication
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      assigned_counter_id TEXT,
      created_at TEXT NOT NULL
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT
    );

    -- Products Master
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT NOT NULL,
      subcategory TEXT,
      brand TEXT,
      unit TEXT NOT NULL,
      pack_size TEXT,
      is_weighing_scale INTEGER DEFAULT 0,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      mrp REAL NOT NULL,
      wholesale_price REAL,
      min_selling_price REAL,
      current_stock REAL NOT NULL,
      min_stock_level REAL DEFAULT 10,
      max_stock_level REAL DEFAULT 500,
      reorder_level REAL DEFAULT 20,
      hsn_code TEXT NOT NULL,
      gst_rate REAL NOT NULL,
      tax_type TEXT DEFAULT 'INCLUSIVE',
      cess_rate REAL DEFAULT 0,
      supplier_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Product Batches & Expiry
    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      mfg_date TEXT,
      expiry_date TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      mrp REAL NOT NULL,
      selling_price REAL NOT NULL,
      quantity REAL NOT NULL
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      address TEXT,
      gstin TEXT,
      customer_type TEXT DEFAULT 'RETAIL',
      credit_limit REAL DEFAULT 5000,
      outstanding_balance REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      last_purchase_date TEXT,
      created_at TEXT NOT NULL
    );

    -- Customer Khata / Credit Ledger
    CREATE TABLE IF NOT EXISTS customer_khata (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL, -- CREDIT_SALE, PAYMENT_RECEIVED, RETURN_CREDIT, ADJUSTMENT
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_no TEXT,
      notes TEXT,
      recorded_by TEXT NOT NULL
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      gstin TEXT,
      pan TEXT,
      payment_terms TEXT,
      credit_period_days INTEGER DEFAULT 30,
      outstanding_balance REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Purchase Invoices
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      invoice_no TEXT UNIQUE NOT NULL,
      invoice_date TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_gstin TEXT,
      subtotal REAL NOT NULL,
      tax_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      payment_status TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT,
      hsn_code TEXT,
      batch_number TEXT,
      expiry_date TEXT,
      quantity REAL NOT NULL,
      free_quantity REAL DEFAULT 0,
      unit_price REAL NOT NULL,
      mrp REAL NOT NULL,
      selling_price REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      gst_rate REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL
    );

    -- Sales Invoices
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id TEXT PRIMARY KEY,
      invoice_no TEXT UNIQUE NOT NULL,
      invoice_date TEXT NOT NULL,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      counter_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_gstin TEXT,
      subtotal REAL NOT NULL,
      discount_total REAL DEFAULT 0,
      cgst_total REAL DEFAULT 0,
      sgst_total REAL DEFAULT 0,
      igst_total REAL DEFAULT 0,
      cess_total REAL DEFAULT 0,
      tax_total REAL NOT NULL,
      round_off REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_status TEXT NOT NULL,
      status TEXT DEFAULT 'COMPLETED',
      loyalty_points_earned INTEGER DEFAULT 0,
      loyalty_points_redeemed INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS sales_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      hsn_code TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL,
      mrp REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL NOT NULL,
      gst_rate REAL NOT NULL,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      cess_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      batch_number TEXT
    );

    -- Payment Records
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_no TEXT,
      created_at TEXT NOT NULL
    );

    -- Sales Returns
    CREATE TABLE IF NOT EXISTS sales_returns (
      id TEXT PRIMARY KEY,
      return_no TEXT UNIQUE NOT NULL,
      invoice_id TEXT NOT NULL,
      invoice_no TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      refund_amount REAL NOT NULL,
      refund_mode TEXT NOT NULL, -- CASH, STORE_CREDIT, UPI
      reason TEXT NOT NULL,
      authorized_by TEXT NOT NULL
    );

    -- GST History Changes
    CREATE TABLE IF NOT EXISTS gst_rate_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      old_hsn TEXT NOT NULL,
      new_hsn TEXT NOT NULL,
      old_rate REAL NOT NULL,
      new_rate REAL NOT NULL,
      effective_date TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      reference_note TEXT
    );

    -- Cash Counters & Sessions
    CREATE TABLE IF NOT EXISTS cash_counters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      current_cashier_id TEXT,
      current_cashier_name TEXT,
      active_session_id TEXT,
      status TEXT DEFAULT 'CLOSED'
    );

    CREATE TABLE IF NOT EXISTS cashier_sessions (
      id TEXT PRIMARY KEY,
      counter_id TEXT NOT NULL,
      counter_name TEXT NOT NULL,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash REAL NOT NULL,
      cash_sales REAL DEFAULT 0,
      upi_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      credit_sales REAL DEFAULT 0,
      total_sales REAL DEFAULT 0,
      cash_refunds REAL DEFAULT 0,
      expected_cash REAL DEFAULT 0,
      actual_cash REAL,
      difference REAL,
      status TEXT DEFAULT 'OPEN',
      notes TEXT
    );

    -- Staff Management
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      employee_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      designation TEXT NOT NULL,
      department TEXT NOT NULL,
      joining_date TEXT NOT NULL,
      salary REAL NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      user_role TEXT,
      system_user_id TEXT
    );

    -- Staff Attendance
    CREATE TABLE IF NOT EXISTS staff_attendance (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      date TEXT NOT NULL,
      in_time TEXT,
      out_time TEXT,
      status TEXT NOT NULL,
      working_hours REAL,
      overtime_hours REAL,
      notes TEXT
    );

    -- Staff Duty Shifts
    CREATE TABLE IF NOT EXISTS duty_rosters (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      counter_id TEXT,
      counter_name TEXT,
      date TEXT NOT NULL,
      shift_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      description TEXT NOT NULL,
      authorized_by TEXT NOT NULL,
      receipt_number TEXT
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      ip_address TEXT
    );

    -- Store Settings
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Held Bills
    CREATE TABLE IF NOT EXISTS held_bills (
      id TEXT PRIMARY KEY,
      held_at TEXT NOT NULL,
      customer_json TEXT,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL,
      tax_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      note TEXT
    );
  `);
}

function seedInitialData(db: Database) {
  // We'll define password hashing (SHA-256 for simple deterministic seed, standard crypto)
  const hashPassword = (pwd: string) => {
    return crypto.createHash('sha256').update(pwd + 'bharatmart_salt').digest('hex');
  };

  // Seed Users for all Roles
  const users = [
    { id: 'usr-1', username: 'admin', pwd: 'admin123', name: 'Ramesh Sharma', email: 'admin@bharatmart.in', phone: '9876543210', role: 'SUPER_ADMIN' },
    { id: 'usr-2', username: 'manager', pwd: 'manager123', name: 'Vikram Patel', email: 'manager@bharatmart.in', phone: '9876543211', role: 'STORE_MANAGER' },
    { id: 'usr-3', username: 'cashier1', pwd: 'cashier123', name: 'Priya Verma', email: 'priya@bharatmart.in', phone: '9876543212', role: 'CASHIER' },
    { id: 'usr-4', username: 'cashier2', pwd: 'cashier123', name: 'Deepak Rao', email: 'deepak@bharatmart.in', phone: '9876543213', role: 'CASHIER' },
    { id: 'usr-5', username: 'inventory', pwd: 'inventory123', name: 'Sanjay Gupta', email: 'sanjay@bharatmart.in', phone: '9876543214', role: 'INVENTORY_MANAGER' },
    { id: 'usr-6', username: 'accountant', pwd: 'account123', name: 'Anjali Nair', email: 'anjali@bharatmart.in', phone: '9876543215', role: 'ACCOUNTANT' },
    { id: 'usr-7', username: 'hr', pwd: 'hr1234', name: 'Sneha Kulkarni', email: 'sneha@bharatmart.in', phone: '9876543216', role: 'HR_MANAGER' },
    { id: 'usr-8', username: 'auditor', pwd: 'auditor123', name: 'Kailash Mehra', email: 'kailash@bharatmart.in', phone: '9876543217', role: 'AUDITOR' },
  ];

  for (const u of users) {
    db.run(
      `INSERT INTO users (id, username, password_hash, name, email, phone, role, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [u.id, u.username, hashPassword(u.pwd), u.name, u.email, u.phone, u.role]
    );
  }

  // Seed Categories
  const categories = [
    { id: 'cat-1', name: 'Grains & Pulses', slug: 'grains-pulses', description: 'Rice, wheat, dal, millets, whole pulses' },
    { id: 'cat-2', name: 'Flour & Atta', slug: 'flour-atta', description: 'Wheat flour, maida, besan, sooji, rice flour' },
    { id: 'cat-3', name: 'Spices & Masalas', slug: 'spices-masalas', description: 'Turmeric, chilli, garam masala, whole spices' },
    { id: 'cat-4', name: 'Edible Oils & Ghee', slug: 'oils-ghee', description: 'Mustard oil, sunflower oil, cow ghee, olive oil' },
    { id: 'cat-5', name: 'Sugar, Salt & Jaggery', slug: 'sugar-salt-jaggery', description: 'Refined sugar, rock salt, desi gud' },
    { id: 'cat-6', name: 'Dry Fruits & Nuts', slug: 'dry-fruits-nuts', description: 'Almonds, cashews, raisins, walnuts' },
    { id: 'cat-7', name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Fresh milk, paneer, curd, butter, cheese, eggs' },
    { id: 'cat-8', name: 'Packaged Food & Breakfast', slug: 'packaged-food', description: 'Noodles, oats, cornflakes, pasta, ready mixes' },
    { id: 'cat-9', name: 'Snacks & Namkeen', slug: 'snacks-namkeen', description: 'Bhujia, chips, roasted peanuts, mixture' },
    { id: 'cat-10', name: 'Biscuits & Bakery', slug: 'biscuits-bakery', description: 'Cookies, rusk, bread, cream biscuits' },
    { id: 'cat-11', name: 'Beverages & Tea', slug: 'beverages-tea', description: 'Chai patti, filter coffee, soft drinks, juices' },
    { id: 'cat-12', name: 'Household & Cleaning', slug: 'household-cleaning', description: 'Detergents, floor cleaner, dishwash, garbage bags' },
    { id: 'cat-13', name: 'Personal Care & Hygiene', slug: 'personal-care', description: 'Soaps, shampoo, toothpaste, skin creams' },
  ];

  for (const c of categories) {
    db.run(
      `INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)`,
      [c.id, c.name, c.slug, c.description]
    );
  }

  // Seed Counters
  const counters = [
    { id: 'cnt-1', name: 'Counter 1 (Main Entrance)', code: 'POS-01', cashierId: 'usr-3', cashierName: 'Priya Verma', status: 'OPEN' },
    { id: 'cnt-2', name: 'Counter 2 (Express Grocery)', code: 'POS-02', cashierId: 'usr-4', cashierName: 'Deepak Rao', status: 'OPEN' },
    { id: 'cnt-3', name: 'Counter 3 (Dairy & Weighing)', code: 'POS-03', cashierId: null, cashierName: null, status: 'CLOSED' },
    { id: 'cnt-4', name: 'Counter 4 (Bulk / Wholesale)', code: 'POS-04', cashierId: null, cashierName: null, status: 'CLOSED' },
  ];

  for (const cnt of counters) {
    db.run(
      `INSERT INTO cash_counters (id, name, code, current_cashier_id, current_cashier_name, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [cnt.id, cnt.name, cnt.code, cnt.cashierId, cnt.cashierName, cnt.status]
    );
  }

  // Active cashier session for Counter 1
  db.run(
    `INSERT INTO cashier_sessions (id, counter_id, counter_name, cashier_id, cashier_name, opened_at, opening_cash, cash_sales, upi_sales, card_sales, credit_sales, total_sales, cash_refunds, expected_cash, status)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-3 hours'), 2000, 4850, 6200, 3100, 0, 14150, 0, 6850, 'OPEN')`,
    ['ses-1', 'cnt-1', 'Counter 1 (Main Entrance)', 'usr-3', 'Priya Verma']
  );
  db.run(`UPDATE cash_counters SET active_session_id = 'ses-1' WHERE id = 'cnt-1'`);

  // Seed Suppliers
  const suppliers = [
    { id: 'sup-1', name: 'Adani Wilmar Dist.', company: 'Fortune Agro Ltd', contactPerson: 'Manish Tyagi', phone: '9811002233', gstin: '07AAACF1234F1Z8', terms: 'Net 15', creditDays: 15, outstanding: 45000, opening: 10000 },
    { id: 'sup-2', name: 'ITC FMCG Supply', company: 'ITC Limited', contactPerson: 'Sunil Kothari', phone: '9822003344', gstin: '07AAACI1960F1ZM', terms: 'Net 30', creditDays: 30, outstanding: 82000, opening: 25000 },
    { id: 'sup-3', name: 'Hindustan Unilever', company: 'HUL India Pvt Ltd', contactPerson: 'Arun Bhatia', phone: '9833004455', gstin: '07AAACH2702H1ZQ', terms: 'Net 21', creditDays: 21, outstanding: 61500, opening: 15000 },
    { id: 'sup-4', name: 'Amul Dairy Federation', company: 'GCMMF Ltd', contactPerson: 'Bhavin Shah', phone: '9844005566', gstin: '07AAACG0439F1Z0', terms: 'Weekly', creditDays: 7, outstanding: 18400, opening: 0 },
    { id: 'sup-5', name: 'Tata Consumer Wholesale', company: 'Tata Consumer Products', contactPerson: 'Rajiv Sen', phone: '9855006677', gstin: '07AAACT0022A1ZW', terms: 'Net 30', creditDays: 30, outstanding: 34000, opening: 5000 },
    { id: 'sup-6', name: 'Haldiram Snacks Depot', company: 'Haldiram Snacks Pvt Ltd', contactPerson: 'Dinesh Agarwal', phone: '9866007788', gstin: '07AAACH5544K1ZS', terms: 'Net 15', creditDays: 15, outstanding: 22800, opening: 0 },
    { id: 'sup-7', name: 'MDH & Everest Spices', company: 'Mahashian Di Hatti Ltd', contactPerson: 'Harish Gulati', phone: '9877008899', gstin: '07AAACM1122C1ZR', terms: 'Net 20', creditDays: 20, outstanding: 14500, opening: 2000 },
    { id: 'sup-8', name: 'Local Grain Mandi Arhtiya', company: 'Kishan Lal & Sons Mandi', contactPerson: 'Kishan Lal', phone: '9888009900', gstin: '07AAAPK9988D1Z4', terms: 'Cash / 7 Days', creditDays: 7, outstanding: 52000, opening: 12000 },
  ];

  for (const s of suppliers) {
    db.run(
      `INSERT INTO suppliers (id, name, company, contact_person, phone, email, address, gstin, payment_terms, credit_period_days, outstanding_balance, opening_balance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-60 days'))`,
      [s.id, s.name, s.company, s.contactPerson, s.phone, `${s.id}@supplier.com`, 'Industrial Area Phase 2, New Delhi', s.gstin, s.terms, s.creditDays, s.outstanding, s.opening]
    );
  }

  // Seed Customers (with Digital Khata balances)
  const customers = [
    { id: 'cust-1', name: 'Walk-in Customer', phone: '9999999999', type: 'WALK_IN', creditLimit: 0, balance: 0, loyalty: 0 },
    { id: 'cust-2', name: 'Sunita Sharma (Flat 402)', phone: '9810123456', type: 'RETAIL', creditLimit: 8000, balance: 2450, loyalty: 320 },
    { id: 'cust-3', name: 'Rajesh Khanna (B-12)', phone: '9810234567', type: 'RETAIL', creditLimit: 10000, balance: 4120, loyalty: 580 },
    { id: 'cust-4', name: 'Gupta Sweets & Caterers', phone: '9810345678', type: 'BUSINESS', creditLimit: 35000, balance: 14800, loyalty: 1450 },
    { id: 'cust-5', name: 'Anita Mukherjee', phone: '9810456789', type: 'RETAIL', creditLimit: 5000, balance: 0, loyalty: 210 },
    { id: 'cust-6', name: 'Mohammed Farooq', phone: '9810567890', type: 'RETAIL', creditLimit: 6000, balance: 1250, loyalty: 190 },
    { id: 'cust-7', name: 'Balaji Tea Stall', phone: '9810678901', type: 'BUSINESS', creditLimit: 15000, balance: 6700, loyalty: 890 },
    { id: 'cust-8', name: 'Pooja Aggarwal (House 7)', phone: '9810789012', type: 'RETAIL', creditLimit: 7500, balance: 850, loyalty: 410 },
    { id: 'cust-9', name: 'Dr. Vivek Mehra', phone: '9810890123', type: 'RETAIL', creditLimit: 12000, balance: 0, loyalty: 740 },
    { id: 'cust-10', name: 'Kavita Joshi', phone: '9810901234', type: 'RETAIL', creditLimit: 5000, balance: 1800, loyalty: 150 },
  ];

  for (const c of customers) {
    db.run(
      `INSERT INTO customers (id, name, phone, email, address, customer_type, credit_limit, outstanding_balance, opening_balance, loyalty_points, total_purchases, last_purchase_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-10 days'), datetime('now', '-90 days'))`,
      [c.id, c.name, c.phone, `${c.id}@gmail.com`, 'Sector 14, Main Market', c.type, c.creditLimit, c.balance, 0, c.loyalty, c.balance * 3 + 2500]
    );

    if (c.balance > 0) {
      db.run(
        `INSERT INTO customer_khata (id, customer_id, date, type, amount, balance_after, reference_no, notes, recorded_by)
         VALUES (?, ?, datetime('now', '-5 days'), 'CREDIT_SALE', ?, ?, 'INV-KHT-001', 'Monthly provisions on Khata credit', 'Priya Verma')`,
        [crypto.randomUUID(), c.id, c.balance, c.balance]
      );
    }
  }

  // Seed Staff
  const staffMembers = [
    { id: 'stf-1', code: 'EMP-101', name: 'Ramesh Sharma', phone: '9876543210', desig: 'Super Administrator / Owner', dept: 'Executive', salary: 75000, role: 'SUPER_ADMIN' },
    { id: 'stf-2', code: 'EMP-102', name: 'Vikram Patel', phone: '9876543211', desig: 'Store Manager', dept: 'Operations', salary: 45000, role: 'STORE_MANAGER' },
    { id: 'stf-3', code: 'EMP-103', name: 'Priya Verma', phone: '9876543212', desig: 'Head Cashier', dept: 'POS Billing', salary: 24000, role: 'CASHIER' },
    { id: 'stf-4', code: 'EMP-104', name: 'Deepak Rao', phone: '9876543213', desig: 'Billing Cashier', dept: 'POS Billing', salary: 20000, role: 'CASHIER' },
    { id: 'stf-5', code: 'EMP-105', name: 'Sanjay Gupta', phone: '9876543214', desig: 'Inventory Supervisor', dept: 'Warehouse & Stock', salary: 28000, role: 'INVENTORY_MANAGER' },
    { id: 'stf-6', code: 'EMP-106', name: 'Anjali Nair', phone: '9876543215', desig: 'Senior Accountant', dept: 'Finance & GST', salary: 38000, role: 'ACCOUNTANT' },
    { id: 'stf-7', code: 'EMP-107', name: 'Sneha Kulkarni', phone: '9876543216', desig: 'HR Manager', dept: 'Human Resources', salary: 32000, role: 'HR_MANAGER' },
    { id: 'stf-8', code: 'EMP-108', name: 'Manoj Kumar', phone: '9876543218', desig: 'Storekeeper & Weighing Operator', dept: 'Stockroom', salary: 18000, role: 'INVENTORY_MANAGER' },
    { id: 'stf-9', code: 'EMP-109', name: 'Ravi Teja', phone: '9876543219', desig: 'Shelf Stacker & Helper', dept: 'Operations', salary: 15000, role: null },
    { id: 'stf-10', code: 'EMP-110', name: 'Santosh Yadav', phone: '9876543220', desig: 'Home Delivery Executive', dept: 'Logistics', salary: 16500, role: null },
  ];

  for (const s of staffMembers) {
    db.run(
      `INSERT INTO staff (id, employee_code, name, phone, email, designation, department, joining_date, salary, status, user_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, '2023-01-15', ?, 'ACTIVE', ?)`,
      [s.id, s.code, s.name, s.phone, `${s.code.toLowerCase()}@bharatmart.in`, s.desig, s.dept, s.salary, s.role]
    );

    // Attendance for today
    db.run(
      `INSERT INTO staff_attendance (id, staff_id, staff_name, date, in_time, status, working_hours)
       VALUES (?, ?, ?, date('now'), '09:00', 'PRESENT', 8.5)`,
      [crypto.randomUUID(), s.id, s.name]
    );

    // Duty roster for today
    db.run(
      `INSERT INTO duty_rosters (id, staff_id, staff_name, counter_id, counter_name, date, shift_name, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, date('now'), 'General', '09:00', '18:00')`,
      [crypto.randomUUID(), s.id, s.name, s.role === 'CASHIER' ? 'cnt-1' : null, s.role === 'CASHIER' ? 'Counter 1' : null]
    );
  }

  // Seed Store Settings
  const settings = {
    storeName: 'BharatMart Supermarket & Kirana',
    tagline: 'Fresh Provisions, Daily Essentials & Wholesale Kirana',
    addressLine1: 'Plot No. 42-45, Central Commercial Complex',
    addressLine2: 'Near Metro Station, Sector 14',
    city: 'New Delhi',
    state: 'Delhi (07)',
    pincode: '110078',
    phone: '+91 98765 43210',
    email: 'contact@bharatmart.in',
    gstin: '07AAAAA0000A1Z5',
    fssaiNumber: '10019011006542',
    panNumber: 'AAAAA0000A',
    upiId: 'bharatmart@upi',
    upiPayeeName: 'BharatMart Supermarket',
    currencySymbol: '₹',
    receiptFooterMessage: 'Thank you for shopping at BharatMart! Returns accepted within 7 days with original invoice.',
    enableLoyalty: 'true',
    loyaltyEarnRate: '100', // 1 point per 100 spent
    loyaltyRedeemValue: '1', // 1 point = Rs 1
    autoBackupDaily: 'true',
  };

  for (const [k, v] of Object.entries(settings)) {
    db.run(`INSERT INTO store_settings (key, value) VALUES (?, ?)`, [k, v]);
  }

  // Seed realistic Supermarket & Kirana Products (100+ items across Indian retail catalog)
  seedProductCatalog(db);

  // Seed sample sales invoices for dashboard analytics
  seedSalesHistory(db);

  // Seed sample expenses
  const expenses = [
    { cat: 'Store Electricity Bill', amt: 14500, mode: 'BANK_TRANSFER', desc: 'BSES monthly store air-conditioning & chiller load', by: 'Ramesh Sharma' },
    { cat: 'Commercial Rent', amt: 65000, mode: 'BANK_TRANSFER', desc: 'Ground floor shop monthly lease', by: 'Ramesh Sharma' },
    { cat: 'Packaging Material', amt: 3400, mode: 'CASH', desc: 'Carry bags, paper bags, sealing rolls', by: 'Vikram Patel' },
    { cat: 'Staff Tea & Refreshments', amt: 950, mode: 'CASH', desc: 'Daily evening chai & snacks', by: 'Vikram Patel' },
    { cat: 'Weighing Machine Calibration', amt: 1200, mode: 'UPI', desc: 'Annual legal metrology seal verification', by: 'Vikram Patel' },
  ];

  for (const ex of expenses) {
    db.run(
      `INSERT INTO expenses (id, category, amount, date, payment_method, description, authorized_by, receipt_number)
       VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)`,
      [crypto.randomUUID(), ex.cat, ex.amt, ex.mode, ex.desc, ex.by, 'EXP-' + Math.floor(1000 + Math.random() * 9000)]
    );
  }

  // Seed Initial Audit Log
  db.run(
    `INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, entity_type, entity_id, new_value, reason)
     VALUES (?, datetime('now'), 'usr-1', 'Ramesh Sharma', 'SUPER_ADMIN', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'SYS-001', 'BharatMart Supermarket initial deployment', 'Initial store bootstrap')`,
    [crypto.randomUUID()]
  );
}

function seedProductCatalog(db: Database) {
  // Comprehensive list of 105 Indian supermarket / Kirana essentials
  const catalog = [
    // Grains & Pulses (Weighing and Prepacked) - cat-1 (GST 0% or 5%)
    { barcode: '890103001001', sku: 'GRN-RCE-01', name: 'Basmati Rice Premium (Loose)', cat: 'cat-1', sub: 'Rice', brand: 'India Gate / Mandi', unit: 'kg', isScale: 1, cost: 85, price: 110, mrp: 130, stock: 450, hsn: '10063020', gst: 0, sup: 'sup-8' },
    { barcode: '890103001002', sku: 'GRN-RCE-02', name: 'Kolam Rice / Sona Masoori (Loose)', cat: 'cat-1', sub: 'Rice', brand: 'Local Mandi', unit: 'kg', isScale: 1, cost: 42, price: 56, mrp: 65, stock: 680, hsn: '10063010', gst: 0, sup: 'sup-8' },
    { barcode: '890103001003', sku: 'GRN-DAL-01', name: 'Toor Dal Desi Unpolished (Loose)', cat: 'cat-1', sub: 'Dal', brand: 'Tata Sampann', unit: 'kg', isScale: 1, cost: 130, price: 165, mrp: 185, stock: 320, hsn: '07136000', gst: 0, sup: 'sup-8' },
    { barcode: '890103001004', sku: 'GRN-DAL-02', name: 'Moong Dal Dhuli (Loose)', cat: 'cat-1', sub: 'Dal', brand: 'Mandi Cleaned', unit: 'kg', isScale: 1, cost: 95, price: 120, mrp: 140, stock: 240, hsn: '07133100', gst: 0, sup: 'sup-8' },
    { barcode: '890103001005', sku: 'GRN-DAL-03', name: 'Chana Dal Super (Loose)', cat: 'cat-1', sub: 'Dal', brand: 'Desi Mandi', unit: 'kg', isScale: 1, cost: 68, price: 88, mrp: 100, stock: 380, hsn: '07132000', gst: 0, sup: 'sup-8' },
    { barcode: '890103001006', sku: 'GRN-DAL-04', name: 'Urad Dal Gota White (Loose)', cat: 'cat-1', sub: 'Dal', brand: 'South Special', unit: 'kg', isScale: 1, cost: 115, price: 145, mrp: 165, stock: 190, hsn: '07133190', gst: 0, sup: 'sup-8' },
    { barcode: '890103001007', sku: 'GRN-PUL-01', name: 'Kabuli Chana Big 12mm (Loose)', cat: 'cat-1', sub: 'Pulses', brand: 'Indore Mandi', unit: 'kg', isScale: 1, cost: 110, price: 140, mrp: 160, stock: 210, hsn: '07132000', gst: 0, sup: 'sup-8' },
    { barcode: '890103001008', sku: 'GRN-PUL-02', name: 'Rajma Chitra Kashmiri (Loose)', cat: 'cat-1', sub: 'Pulses', brand: 'Himalayan Desi', unit: 'kg', isScale: 1, cost: 125, price: 160, mrp: 180, stock: 180, hsn: '07133300', gst: 0, sup: 'sup-8' },
    { barcode: '890103001009', sku: 'GRN-RCE-03', name: 'Daawat Rozana Super Basmati 5kg', cat: 'cat-1', sub: 'Rice', brand: 'Daawat', unit: 'pkt', isScale: 0, cost: 320, price: 399, mrp: 460, stock: 45, hsn: '10063020', gst: 5, sup: 'sup-2' },
    { barcode: '890103001010', sku: 'GRN-RCE-04', name: 'India Gate Classic Basmati 5kg', cat: 'cat-1', sub: 'Rice', brand: 'India Gate', unit: 'pkt', isScale: 0, cost: 890, price: 1050, mrp: 1225, stock: 28, hsn: '10063020', gst: 5, sup: 'sup-2' },

    // Flour & Atta - cat-2 (GST 0% or 5%)
    { barcode: '890103002001', sku: 'FLR-ATT-01', name: 'Aashirvaad Shudh Chakki Atta 10kg', cat: 'cat-2', sub: 'Atta', brand: 'Aashirvaad', unit: 'pkt', isScale: 0, cost: 385, price: 445, mrp: 495, stock: 120, hsn: '11010000', gst: 5, sup: 'sup-2' },
    { barcode: '890103002002', sku: 'FLR-ATT-02', name: 'Aashirvaad Select Sharbati Atta 5kg', cat: 'cat-2', sub: 'Atta', brand: 'Aashirvaad', unit: 'pkt', isScale: 0, cost: 260, price: 299, mrp: 340, stock: 65, hsn: '11010000', gst: 5, sup: 'sup-2' },
    { barcode: '890103002003', sku: 'FLR-ATT-03', name: 'Fortune Chakki Fresh Atta 5kg', cat: 'cat-2', sub: 'Atta', brand: 'Fortune', unit: 'pkt', isScale: 0, cost: 195, price: 229, mrp: 260, stock: 80, hsn: '11010000', gst: 5, sup: 'sup-1' },
    { barcode: '890103002004', sku: 'FLR-BSN-01', name: 'Rajdhani Besan 500g', cat: 'cat-2', sub: 'Besan', brand: 'Rajdhani', unit: 'pkt', isScale: 0, cost: 44, price: 55, mrp: 62, stock: 140, hsn: '11061000', gst: 5, sup: 'sup-8' },
    { barcode: '890103002005', sku: 'FLR-MDA-01', name: 'Rajdhani Maida Fine 500g', cat: 'cat-2', sub: 'Maida', brand: 'Rajdhani', unit: 'pkt', isScale: 0, cost: 26, price: 34, mrp: 38, stock: 95, hsn: '11010000', gst: 5, sup: 'sup-8' },
    { barcode: '890103002006', sku: 'FLR-SOJ-01', name: 'Rajdhani Sooji / Rava 500g', cat: 'cat-2', sub: 'Sooji', brand: 'Rajdhani', unit: 'pkt', isScale: 0, cost: 28, price: 36, mrp: 40, stock: 110, hsn: '11031120', gst: 5, sup: 'sup-8' },

    // Spices & Masalas - cat-3 (GST 5%)
    { barcode: '890103003001', sku: 'SPC-MDH-01', name: 'MDH Deggi Mirch Powder 100g', cat: 'cat-3', sub: 'Powder Spices', brand: 'MDH', unit: 'box', isScale: 0, cost: 72, price: 86, mrp: 95, stock: 75, hsn: '09042211', gst: 5, sup: 'sup-7' },
    { barcode: '890103003002', sku: 'SPC-MDH-02', name: 'MDH Haldi (Turmeric) 200g', cat: 'cat-3', sub: 'Powder Spices', brand: 'MDH', unit: 'box', isScale: 0, cost: 58, price: 68, mrp: 78, stock: 90, hsn: '09103020', gst: 5, sup: 'sup-7' },
    { barcode: '890103003003', sku: 'SPC-MDH-03', name: 'MDH Garam Masala 100g', cat: 'cat-3', sub: 'Blended Masala', brand: 'MDH', unit: 'box', isScale: 0, cost: 84, price: 98, mrp: 110, stock: 85, hsn: '09109100', gst: 5, sup: 'sup-7' },
    { barcode: '890103003004', sku: 'SPC-MDH-04', name: 'MDH Chana Masala 100g', cat: 'cat-3', sub: 'Blended Masala', brand: 'MDH', unit: 'box', isScale: 0, cost: 68, price: 80, mrp: 88, stock: 60, hsn: '09109100', gst: 5, sup: 'sup-7' },
    { barcode: '890103003005', sku: 'SPC-EVR-01', name: 'Everest Meat Masala 100g', cat: 'cat-3', sub: 'Blended Masala', brand: 'Everest', unit: 'box', isScale: 0, cost: 74, price: 88, mrp: 96, stock: 55, hsn: '09109100', gst: 5, sup: 'sup-7' },
    { barcode: '890103003006', sku: 'SPC-EVR-02', name: 'Everest Sabji Masala 100g', cat: 'cat-3', sub: 'Blended Masala', brand: 'Everest', unit: 'box', isScale: 0, cost: 56, price: 65, mrp: 72, stock: 70, hsn: '09109100', gst: 5, sup: 'sup-7' },
    { barcode: '890103003007', sku: 'SPC-JEER-01', name: 'Jeera Cumin Seeds Desi (Loose)', cat: 'cat-3', sub: 'Whole Spices', brand: 'Unjha Premium', unit: 'kg', isScale: 1, cost: 310, price: 390, mrp: 450, stock: 85, hsn: '09093129', gst: 5, sup: 'sup-8' },
    { barcode: '890103003008', sku: 'SPC-CLOV-01', name: 'Cloves / Laung Kerala 100g', cat: 'cat-3', sub: 'Whole Spices', brand: 'Spice Craft', unit: 'pkt', isScale: 0, cost: 110, price: 135, mrp: 160, stock: 40, hsn: '09071000', gst: 5, sup: 'sup-7' },

    // Edible Oils & Ghee - cat-4 (GST 5% for oils, 12% for Ghee)
    { barcode: '890103004001', sku: 'OIL-FRT-01', name: 'Fortune Sunlite Sunflower Oil 1L Pouch', cat: 'cat-4', sub: 'Refined Oil', brand: 'Fortune', unit: 'pkt', isScale: 0, cost: 118, price: 135, mrp: 155, stock: 150, hsn: '15121910', gst: 5, sup: 'sup-1' },
    { barcode: '890103004002', sku: 'OIL-FRT-02', name: 'Fortune Kachi Ghani Mustard Oil 1L Bottle', cat: 'cat-4', sub: 'Mustard Oil', brand: 'Fortune', unit: 'btl', isScale: 0, cost: 132, price: 149, mrp: 170, stock: 130, hsn: '15149110', gst: 5, sup: 'sup-1' },
    { barcode: '890103004003', sku: 'OIL-SF-01', name: 'Saffola Gold Pro Healthy Heart 1L', cat: 'cat-4', sub: 'Blended Oil', brand: 'Saffola', unit: 'pkt', isScale: 0, cost: 168, price: 195, mrp: 225, stock: 95, hsn: '15179010', gst: 5, sup: 'sup-1' },
    { barcode: '890103004004', sku: 'GHE-AML-01', name: 'Amul Pure Cow Ghee 1L Tin', cat: 'cat-4', sub: 'Ghee', brand: 'Amul', unit: 'box', isScale: 0, cost: 580, price: 645, mrp: 680, stock: 60, hsn: '04059020', gst: 12, sup: 'sup-4' },
    { barcode: '890103004005', sku: 'GHE-AML-02', name: 'Amul Pure Ghee 500ml Pouch', cat: 'cat-4', sub: 'Ghee', brand: 'Amul', unit: 'pkt', isScale: 0, cost: 285, price: 315, mrp: 335, stock: 75, hsn: '04059020', gst: 12, sup: 'sup-4' },

    // Sugar, Salt & Jaggery - cat-5 (GST 0% or 5%)
    { barcode: '890103005001', sku: 'SUG-SGR-01', name: 'Madhur Pure & Hygienic Sugar 1kg', cat: 'cat-5', sub: 'Sugar', brand: 'Madhur', unit: 'pkt', isScale: 0, cost: 44, price: 52, mrp: 58, stock: 210, hsn: '17019990', gst: 5, sup: 'sup-8' },
    { barcode: '890103005002', sku: 'SUG-JAG-01', name: 'Desi Kolhapuri Jaggery / Gud (Loose)', cat: 'cat-5', sub: 'Jaggery', brand: 'Desi Farm', unit: 'kg', isScale: 1, cost: 52, price: 68, mrp: 80, stock: 160, hsn: '17011490', gst: 0, sup: 'sup-8' },
    { barcode: '890103005003', sku: 'SLT-TAT-01', name: 'Tata Salt Vacuum Evaporated 1kg', cat: 'cat-5', sub: 'Salt', brand: 'Tata', unit: 'pkt', isScale: 0, cost: 22, price: 28, mrp: 30, stock: 350, hsn: '25010010', gst: 0, sup: 'sup-5' },
    { barcode: '890103005004', sku: 'SLT-TAT-02', name: 'Tata Salt Lite Low Sodium 1kg', cat: 'cat-5', sub: 'Salt', brand: 'Tata', unit: 'pkt', isScale: 0, cost: 42, price: 52, mrp: 58, stock: 80, hsn: '25010010', gst: 0, sup: 'sup-5' },

    // Dry Fruits & Nuts - cat-6 (GST 12%)
    { barcode: '890103006001', sku: 'DRY-ALM-01', name: 'California Almonds Badam Giri (Loose)', cat: 'cat-6', sub: 'Almonds', brand: 'California Special', unit: 'kg', isScale: 1, cost: 680, price: 850, mrp: 950, stock: 75, hsn: '08021200', gst: 12, sup: 'sup-8' },
    { barcode: '890103006002', sku: 'DRY-CSH-01', name: 'Cashew Whole Kaju W320 (Loose)', cat: 'cat-6', sub: 'Cashews', brand: 'Goa Select', unit: 'kg', isScale: 1, cost: 720, price: 920, mrp: 1050, stock: 65, hsn: '08013210', gst: 12, sup: 'sup-8' },
    { barcode: '890103006003', sku: 'DRY-KIS-01', name: 'Green Raisins Kishmish Indian (Loose)', cat: 'cat-6', sub: 'Raisins', brand: 'Sangli Farms', unit: 'kg', isScale: 1, cost: 220, price: 290, mrp: 350, stock: 90, hsn: '08062010', gst: 12, sup: 'sup-8' },

    // Dairy & Eggs - cat-7 (GST 0% or 5% or 12%)
    { barcode: '890103007001', sku: 'DRY-MLK-01', name: 'Amul Taaza Homogenised Toned Milk 1L', cat: 'cat-7', sub: 'Milk', brand: 'Amul', unit: 'pkt', isScale: 0, cost: 66, price: 74, mrp: 75, stock: 120, hsn: '04012000', gst: 0, sup: 'sup-4' },
    { barcode: '890103007002', sku: 'DRY-BUT-01', name: 'Amul Pasteurized Butter 500g', cat: 'cat-7', sub: 'Butter', brand: 'Amul', unit: 'box', isScale: 0, cost: 250, price: 275, mrp: 285, stock: 85, hsn: '04051000', gst: 12, sup: 'sup-4' },
    { barcode: '890103007003', sku: 'DRY-PAN-01', name: 'Amul Fresh Malai Paneer 200g', cat: 'cat-7', sub: 'Paneer', brand: 'Amul', unit: 'pkt', isScale: 0, cost: 82, price: 92, mrp: 95, stock: 45, hsn: '04061000', gst: 5, sup: 'sup-4' },
    { barcode: '890103007004', sku: 'DRY-CRD-01', name: 'Amul Masti Dahi Curd 400g Cup', cat: 'cat-7', sub: 'Curd', brand: 'Amul', unit: 'pkt', isScale: 0, cost: 36, price: 42, mrp: 45, stock: 60, hsn: '04031000', gst: 5, sup: 'sup-4' },
    { barcode: '890103007005', sku: 'DRY-CHS-01', name: 'Amul Cheese Slices 200g (10 Slices)', cat: 'cat-7', sub: 'Cheese', brand: 'Amul', unit: 'box', isScale: 0, cost: 130, price: 145, mrp: 155, stock: 40, hsn: '04069000', gst: 12, sup: 'sup-4' },

    // Packaged Food & Breakfast - cat-8 (GST 12% or 18%)
    { barcode: '890103008001', sku: 'PKG-MAG-01', name: 'Maggi 2-Minute Masala Noodles 280g (Pack of 4)', cat: 'cat-8', sub: 'Noodles', brand: 'Maggi', unit: 'pkt', isScale: 0, cost: 52, price: 60, mrp: 64, stock: 180, hsn: '19023010', gst: 18, sup: 'sup-2' },
    { barcode: '890103008002', sku: 'PKG-MAG-02', name: 'Maggi Masala-Ae-Magic Seasoning (Pack of 10)', cat: 'cat-8', sub: 'Seasoning', brand: 'Maggi', unit: 'pkt', isScale: 0, cost: 48, price: 56, mrp: 60, stock: 90, hsn: '21039040', gst: 18, sup: 'sup-2' },
    { barcode: '890103008003', sku: 'PKG-KLL-01', name: 'Kelloggs Corn Flakes Original 500g', cat: 'cat-8', sub: 'Breakfast', brand: 'Kelloggs', unit: 'box', isScale: 0, cost: 175, price: 205, mrp: 230, stock: 50, hsn: '19041010', gst: 18, sup: 'sup-2' },
    { barcode: '890103008004', sku: 'PKG-QKR-01', name: 'Quaker Rolled Oats 1kg Pouch', cat: 'cat-8', sub: 'Breakfast', brand: 'Quaker', unit: 'pkt', isScale: 0, cost: 160, price: 189, mrp: 210, stock: 65, hsn: '19041090', gst: 18, sup: 'sup-2' },
    { barcode: '890103008005', sku: 'PKG-KIS-01', name: 'Kissan Fresh Tomato Ketchup 950g Squeezo', cat: 'cat-8', sub: 'Sauces', brand: 'Kissan', unit: 'btl', isScale: 0, cost: 110, price: 130, mrp: 145, stock: 70, hsn: '21032000', gst: 12, sup: 'sup-3' },

    // Snacks & Namkeen - cat-9 (GST 12%)
    { barcode: '890103009001', sku: 'SNK-HAL-01', name: 'Haldiram Aloo Bhujia 400g Family Pack', cat: 'cat-9', sub: 'Namkeen', brand: 'Haldiram', unit: 'pkt', isScale: 0, cost: 95, price: 115, mrp: 125, stock: 140, hsn: '21069099', gst: 12, sup: 'sup-6' },
    { barcode: '890103009002', sku: 'SNK-HAL-02', name: 'Haldiram Bhujia Sev 400g', cat: 'cat-9', sub: 'Namkeen', brand: 'Haldiram', unit: 'pkt', isScale: 0, cost: 95, price: 115, mrp: 125, stock: 120, hsn: '21069099', gst: 12, sup: 'sup-6' },
    { barcode: '890103009003', sku: 'SNK-HAL-03', name: 'Haldiram Moong Dal Fried 200g', cat: 'cat-9', sub: 'Namkeen', brand: 'Haldiram', unit: 'pkt', isScale: 0, cost: 50, price: 62, mrp: 68, stock: 110, hsn: '21069099', gst: 12, sup: 'sup-6' },
    { barcode: '890103009004', sku: 'SNK-LAY-01', name: 'Lays Magic Masala Potato Chips 50g', cat: 'cat-9', sub: 'Chips', brand: 'Lays', unit: 'pkt', isScale: 0, cost: 16, price: 20, mrp: 20, stock: 200, hsn: '20052000', gst: 12, sup: 'sup-2' },
    { barcode: '890103009005', sku: 'SNK-KUR-01', name: 'Kurkure Masala Munch 80g', cat: 'cat-9', sub: 'Chips', brand: 'Kurkure', unit: 'pkt', isScale: 0, cost: 16, price: 20, mrp: 20, stock: 180, hsn: '21069099', gst: 12, sup: 'sup-2' },

    // Biscuits & Bakery - cat-10 (GST 18%)
    { barcode: '890103010001', sku: 'BIS-PAR-01', name: 'Parle-G Gold Glucose Biscuits 1kg', cat: 'cat-10', sub: 'Biscuits', brand: 'Parle', unit: 'pkt', isScale: 0, cost: 95, price: 110, mrp: 120, stock: 160, hsn: '19053100', gst: 18, sup: 'sup-2' },
    { barcode: '890103010002', sku: 'BIS-BRT-01', name: 'Britannia Good Day Butter 200g', cat: 'cat-10', sub: 'Cookies', brand: 'Britannia', unit: 'pkt', isScale: 0, cost: 38, price: 45, mrp: 50, stock: 130, hsn: '19053100', gst: 18, sup: 'sup-2' },
    { barcode: '890103010003', sku: 'BIS-BRT-02', name: 'Britannia Marie Gold 300g Super Saver', cat: 'cat-10', sub: 'Biscuits', brand: 'Britannia', unit: 'pkt', isScale: 0, cost: 42, price: 50, mrp: 55, stock: 150, hsn: '19053100', gst: 18, sup: 'sup-2' },
    { barcode: '890103010004', sku: 'BIS-BRT-03', name: 'Britannia Toastea Premium Rusk 400g', cat: 'cat-10', sub: 'Rusk', brand: 'Britannia', unit: 'pkt', isScale: 0, cost: 54, price: 65, mrp: 70, stock: 95, hsn: '19054000', gst: 18, sup: 'sup-2' },

    // Beverages & Tea - cat-11 (GST 5% for tea, 28% for soft drinks)
    { barcode: '890103011001', sku: 'BEV-TAT-01', name: 'Tata Tea Premium Desh Ki Chai 500g', cat: 'cat-11', sub: 'Tea', brand: 'Tata Tea', unit: 'pkt', isScale: 0, cost: 230, price: 275, mrp: 310, stock: 110, hsn: '09024020', gst: 5, sup: 'sup-5' },
    { barcode: '890103011002', sku: 'BEV-WAG-01', name: 'Wagh Bakri Premium Leaf Tea 500g', cat: 'cat-11', sub: 'Tea', brand: 'Wagh Bakri', unit: 'pkt', isScale: 0, cost: 240, price: 285, mrp: 320, stock: 85, hsn: '09024020', gst: 5, sup: 'sup-5' },
    { barcode: '890103011003', sku: 'BEV-BRU-01', name: 'Bru Instant Coffee Jar 100g', cat: 'cat-11', sub: 'Coffee', brand: 'Bru', unit: 'btl', isScale: 0, cost: 180, price: 215, mrp: 245, stock: 65, hsn: '21011110', gst: 18, sup: 'sup-3' },
    { barcode: '890103011004', sku: 'BEV-COK-01', name: 'Coca Cola Pet Bottle 750ml', cat: 'cat-11', sub: 'Cold Drinks', brand: 'Coca Cola', unit: 'btl', isScale: 0, cost: 32, price: 40, mrp: 40, stock: 140, hsn: '22021010', gst: 28, sup: 'sup-2' },
    { barcode: '890103011005', sku: 'BEV-THR-01', name: 'Thums Up Charged 750ml Bottle', cat: 'cat-11', sub: 'Cold Drinks', brand: 'Thums Up', unit: 'btl', isScale: 0, cost: 32, price: 40, mrp: 40, stock: 160, hsn: '22021010', gst: 28, sup: 'sup-2' },

    // Household & Cleaning - cat-12 (GST 18%)
    { barcode: '890103012001', sku: 'HSE-SRF-01', name: 'Surf Excel Easy Wash Detergent Powder 1kg', cat: 'cat-12', sub: 'Detergent', brand: 'Surf Excel', unit: 'pkt', isScale: 0, cost: 128, price: 148, mrp: 160, stock: 120, hsn: '34022010', gst: 18, sup: 'sup-3' },
    { barcode: '890103012002', sku: 'HSE-VIM-01', name: 'Vim Dishwash Gel Lemon 750ml Bottle', cat: 'cat-12', sub: 'Dishwash', brand: 'Vim', unit: 'btl', isScale: 0, cost: 142, price: 165, mrp: 180, stock: 90, hsn: '34022090', gst: 18, sup: 'sup-3' },
    { barcode: '890103012003', sku: 'HSE-LYS-01', name: 'Lizol Floral Surface Cleaner 1L', cat: 'cat-12', sub: 'Floor Cleaner', brand: 'Lizol', unit: 'btl', isScale: 0, cost: 175, price: 205, mrp: 220, stock: 80, hsn: '38089400', gst: 18, sup: 'sup-3' },
    { barcode: '890103012004', sku: 'HSE-HRB-01', name: 'Harpic Power Plus Toilet Cleaner 1L', cat: 'cat-12', sub: 'Toilet Cleaner', brand: 'Harpic', unit: 'btl', isScale: 0, cost: 168, price: 198, mrp: 215, stock: 75, hsn: '34022020', gst: 18, sup: 'sup-3' },

    // Personal Care & Hygiene - cat-13 (GST 18%)
    { barcode: '890103013001', sku: 'PER-DOV-01', name: 'Dove Cream Beauty Bathing Bar 100g (Buy 3 Get 1)', cat: 'cat-13', sub: 'Soap', brand: 'Dove', unit: 'pkt', isScale: 0, cost: 190, price: 225, mrp: 250, stock: 65, hsn: '34011110', gst: 18, sup: 'sup-3' },
    { barcode: '890103013002', sku: 'PER-DET-01', name: 'Dettol Original Germ Protection Soap 125g', cat: 'cat-13', sub: 'Soap', brand: 'Dettol', unit: 'pc', isScale: 0, cost: 48, price: 58, mrp: 62, stock: 140, hsn: '34011110', gst: 18, sup: 'sup-3' },
    { barcode: '890103013003', sku: 'PER-COL-01', name: 'Colgate Strong Teeth Dental Cream 200g', cat: 'cat-13', sub: 'Toothpaste', brand: 'Colgate', unit: 'box', isScale: 0, cost: 105, price: 124, mrp: 135, stock: 110, hsn: '33061020', gst: 18, sup: 'sup-3' },
    { barcode: '890103013004', sku: 'PER-CLG-01', name: 'Clinic Plus Strong & Long Shampoo 340ml', cat: 'cat-13', sub: 'Shampoo', brand: 'Clinic Plus', unit: 'btl', isScale: 0, cost: 185, price: 215, mrp: 235, stock: 70, hsn: '33051090', gst: 18, sup: 'sup-3' },
  ];

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const id = `prd-${i + 1}`;
    db.run(
      `INSERT INTO products (
        id, barcode, sku, name, description, category_id, subcategory, brand, unit,
        is_weighing_scale, purchase_price, selling_price, mrp, wholesale_price, min_selling_price,
        current_stock, min_stock_level, max_stock_level, reorder_level, hsn_code, gst_rate,
        tax_type, cess_rate, supplier_id, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, 500, 20, ?, ?, 'INCLUSIVE', 0, ?, 1, datetime('now', '-30 days'), datetime('now'))`,
      [
        id,
        item.barcode,
        item.sku,
        item.name,
        `Premium supermarket grade ${item.name}`,
        item.cat,
        item.sub,
        item.brand,
        item.unit,
        item.isScale,
        item.cost,
        item.price,
        item.mrp,
        Math.round(item.price * 0.94),
        Math.round(item.cost * 1.05),
        item.stock,
        item.hsn,
        item.gst,
        item.sup,
      ]
    );

    // Add batch with expiry date (some 6 months out, some 30 days out for expiry alerts)
    const expiryDays = (i % 7 === 0) ? 22 : (i % 5 === 0) ? 55 : 240;
    db.run(
      `INSERT INTO product_batches (id, product_id, batch_number, mfg_date, expiry_date, purchase_price, mrp, selling_price, quantity)
       VALUES (?, ?, ?, date('now', '-60 days'), date('now', '+${expiryDays} days'), ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        id,
        `BAT-${202400 + i}`,
        item.cost,
        item.mrp,
        item.price,
        item.stock,
      ]
    );
  }
}

function seedSalesHistory(db: Database) {
  // Insert 15 realistic historical invoices from past 3 days for analytics
  const sampleInvoices = [
    { no: 'INV-2024-001', cust: 'cust-2', cashier: 'Priya Verma', counter: 'POS-01', total: 1450, tax: 85, mode: 'UPI', daysAgo: 2 },
    { no: 'INV-2024-002', cust: 'cust-3', cashier: 'Priya Verma', counter: 'POS-01', total: 2890, tax: 180, mode: 'CASH', daysAgo: 2 },
    { no: 'INV-2024-003', cust: 'cust-4', cashier: 'Deepak Rao', counter: 'POS-02', total: 6420, tax: 410, mode: 'CARD', daysAgo: 1 },
    { no: 'INV-2024-004', cust: 'cust-1', cashier: 'Deepak Rao', counter: 'POS-02', total: 780, tax: 42, mode: 'CASH', daysAgo: 1 },
    { no: 'INV-2024-005', cust: 'cust-5', cashier: 'Priya Verma', counter: 'POS-01', total: 1980, tax: 120, mode: 'UPI', daysAgo: 1 },
    { no: 'INV-2024-006', cust: 'cust-6', cashier: 'Priya Verma', counter: 'POS-01', total: 3200, tax: 195, mode: 'CREDIT', daysAgo: 0 },
    { no: 'INV-2024-007', cust: 'cust-7', cashier: 'Deepak Rao', counter: 'POS-02', total: 5450, tax: 310, mode: 'UPI', daysAgo: 0 },
    { no: 'INV-2024-008', cust: 'cust-1', cashier: 'Priya Verma', counter: 'POS-01', total: 490, tax: 28, mode: 'CASH', daysAgo: 0 },
    { no: 'INV-2024-009', cust: 'cust-8', cashier: 'Priya Verma', counter: 'POS-01', total: 2150, tax: 135, mode: 'CARD', daysAgo: 0 },
    { no: 'INV-2024-010', cust: 'cust-9', cashier: 'Deepak Rao', counter: 'POS-02', total: 4100, tax: 260, mode: 'UPI', daysAgo: 0 },
  ];

  for (const inv of sampleInvoices) {
    const invId = crypto.randomUUID();
    const subtotal = inv.total - inv.tax;
    const cgst = Number((inv.tax / 2).toFixed(2));
    const sgst = Number((inv.tax / 2).toFixed(2));

    db.run(
      `INSERT INTO sales_invoices (
        id, invoice_no, invoice_date, cashier_id, cashier_name, counter_id,
        customer_id, customer_name, subtotal, discount_total, cgst_total, sgst_total,
        tax_total, grand_total, payment_status, status, loyalty_points_earned
      ) VALUES (?, ?, datetime('now', '-${inv.daysAgo} days'), 'usr-3', ?, ?, ?, 'Registered Customer', ?, 50, ?, ?, ?, ?, 'PAID', 'COMPLETED', ?)`,
      [
        invId,
        inv.no,
        inv.cashier,
        inv.counter,
        inv.cust,
        subtotal,
        cgst,
        sgst,
        inv.tax,
        inv.total,
        Math.floor(inv.total / 100),
      ]
    );

    // Add payment record
    db.run(
      `INSERT INTO invoice_payments (id, invoice_id, mode, amount, created_at)
       VALUES (?, ?, ?, ?, datetime('now', '-${inv.daysAgo} days'))`,
      [crypto.randomUUID(), invId, inv.mode, inv.total]
    );

    // Add a couple sample items
    db.run(
      `INSERT INTO sales_items (
        id, invoice_id, product_id, product_name, barcode, hsn_code, unit,
        quantity, mrp, unit_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total
      ) VALUES (?, ?, 'prd-11', 'Aashirvaad Shudh Chakki Atta 10kg', '890103002001', '11010000', 'pkt', 1, 495, 445, 423.8, 5, 10.6, 10.6, 445)`,
      [crypto.randomUUID(), invId]
    );
  }
}
