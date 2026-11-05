import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import {
  queryAll,
  queryOne,
  runExec,
  runTransaction,
  addAuditLog,
  getDatabaseExport,
  restoreDatabase,
} from './db.js';

export const apiRouter = Router();

// Universal camelCase transformer that preserves both camelCase and snake_case properties
export function toCamelCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as unknown as T;
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = toCamelCase(obj[key]);
      if (camelKey !== key) {
        newObj[key] = newObj[camelKey];
      }
    }
    if ('is_weighing_scale' in obj || 'isWeighingScale' in obj) {
      newObj.isWeighingScale = Boolean(obj.is_weighing_scale ?? obj.isWeighingScale);
    }
    if ('active' in obj) {
      newObj.active = Boolean(obj.active);
    }
    return newObj as T;
  }
  return obj;
}

// Multi-counter SSE client pool
const sseClients: Response[] = [];

export function broadcastEvent(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// SSE endpoint for live multi-counter sync
apiRouter.get('/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('data: {"connected": true}\n\n');
  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Password verification helper
function hashPassword(pwd: string) {
  return crypto.createHash('sha256').update(pwd + 'bharatmart_salt').digest('hex');
}

// --- AUTHENTICATION ---
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = queryOne(
    `SELECT id, username, name, email, phone, role, active, assigned_counter_id, password_hash
     FROM users WHERE username = ? AND active = 1`,
    [username]
  );

  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const { password_hash, ...safeUser } = user;
  // Return token and safe user
  const token = `token-${safeUser.id}-${Date.now()}`;
  addAuditLog(safeUser.id, safeUser.name, safeUser.role, 'USER_LOGIN', 'USER', safeUser.id, null, 'Logged in');
  res.json({ token, user: safeUser });
});

apiRouter.get('/auth/users', (req: Request, res: Response) => {
  const users = queryAll(
    `SELECT id, username, name, email, phone, role, active, assigned_counter_id, created_at
     FROM users ORDER BY name ASC`
  );
  res.json(users);
});

// --- DASHBOARD ANALYTICS ---
apiRouter.get('/reports/dashboard', (req: Request, res: Response) => {
  const todaySales = queryOne<{ count: number; total: number; tax: number; discount: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total,
            COALESCE(SUM(tax_total), 0) as tax, COALESCE(SUM(discount_total), 0) as discount
     FROM sales_invoices
     WHERE date(invoice_date) = date('now') AND status = 'COMPLETED'`
  );

  // Sales by payment mode today
  const modeSales = queryAll<{ mode: string; total: number }>(
    `SELECT p.mode, COALESCE(SUM(p.amount), 0) as total
     FROM invoice_payments p
     JOIN sales_invoices s ON s.id = p.invoice_id
     WHERE date(s.invoice_date) = date('now') AND s.status = 'COMPLETED'
     GROUP BY p.mode`
  );

  // Stock summary
  const stockSummary = queryOne<{ totalValue: number; lowStockCount: number; outOfStockCount: number }>(
    `SELECT
       COALESCE(SUM(current_stock * purchase_price), 0) as totalValue,
       COUNT(CASE WHEN current_stock <= reorder_level AND current_stock > 0 THEN 1 END) as lowStockCount,
       COUNT(CASE WHEN current_stock <= 0 THEN 1 END) as outOfStockCount
     FROM products WHERE active = 1`
  );

  // Expiring items (within 30 days)
  const expiringCount = queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT product_id) as count
     FROM product_batches
     WHERE date(expiry_date) <= date('now', '+30 days')`
  );

  // Outstanding Khata / customer credit
  const customerCredit = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(outstanding_balance), 0) as total FROM customers`
  );

  // Supplier payables
  const supplierPayable = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(outstanding_balance), 0) as total FROM suppliers`
  );

  // Today's expenses
  const todayExpense = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(date) = date('now')`
  );

  // Recent 7 days sales for chart
  const weeklySales = queryAll<{ day: string; sales: number; bills: number }>(
    `SELECT date(invoice_date) as day, COALESCE(SUM(grand_total), 0) as sales, COUNT(*) as bills
     FROM sales_invoices
     WHERE invoice_date >= date('now', '-6 days') AND status = 'COMPLETED'
     GROUP BY date(invoice_date)
     ORDER BY day ASC`
  );

  // Top selling products
  const topProducts = queryAll(
    `SELECT i.product_name, SUM(i.quantity) as qty, SUM(i.total) as revenue
     FROM sales_items i
     JOIN sales_invoices s ON s.id = i.invoice_id
     WHERE s.status = 'COMPLETED'
     GROUP BY i.product_id
     ORDER BY qty DESC LIMIT 6`
  );

  res.json({
    today: {
      sales: todaySales?.total || 0,
      bills: todaySales?.count || 0,
      tax: todaySales?.tax || 0,
      discount: todaySales?.discount || 0,
    },
    paymentModes: modeSales,
    stock: {
      value: Math.round(stockSummary?.totalValue || 0),
      lowStock: stockSummary?.lowStockCount || 0,
      outOfStock: stockSummary?.outOfStockCount || 0,
      expiringSoon: expiringCount?.count || 0,
    },
    customerCredit: customerCredit?.total || 0,
    supplierPayable: supplierPayable?.total || 0,
    todayExpenses: todayExpense?.total || 0,
    weeklySales,
    topProducts,
  });
});

// --- PRODUCTS ---
apiRouter.get('/products', (req: Request, res: Response) => {
  const { search, category, lowStock, expiring } = req.query;

  let sql = `
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.active = 1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (category) {
    sql += ` AND p.category_id = ?`;
    params.push(category);
  }

  if (lowStock === 'true') {
    sql += ` AND p.current_stock <= p.reorder_level`;
  }

  sql += ` ORDER BY p.name ASC`;
  const products = queryAll(sql, params);
  res.json(toCamelCase(products));
});

apiRouter.get('/products/barcode/:barcode', (req: Request, res: Response) => {
  const { barcode } = req.params;
  const product = queryOne(
    `SELECT p.*, c.name as category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE (p.barcode = ? OR p.sku = ?) AND p.active = 1`,
    [barcode, barcode]
  );

  if (!product) {
    return res.status(404).json({ error: 'Product not found with barcode ' + barcode });
  }

  // Get active batches
  const batches = queryAll(
    `SELECT * FROM product_batches WHERE product_id = ? AND quantity > 0 ORDER BY expiry_date ASC`,
    [product.id]
  );
  product.batches = toCamelCase(batches);

  res.json(toCamelCase(product));
});

apiRouter.post('/products', (req: Request, res: Response) => {
  const body = req.body;
  const id = 'prd-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  runExec(
    `INSERT INTO products (
      id, barcode, sku, name, description, category_id, subcategory, brand, unit,
      pack_size, is_weighing_scale, purchase_price, selling_price, mrp, wholesale_price,
      min_selling_price, current_stock, min_stock_level, max_stock_level, reorder_level,
      hsn_code, gst_rate, tax_type, cess_rate, supplier_id, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      body.barcode,
      body.sku || `SKU-${body.barcode.slice(-6)}`,
      body.name,
      body.description || '',
      body.categoryId,
      body.subcategory || '',
      body.brand || '',
      body.unit || 'pc',
      body.packSize || '',
      body.isWeighingScale ? 1 : 0,
      Number(body.purchasePrice) || 0,
      Number(body.sellingPrice) || 0,
      Number(body.mrp) || Number(body.sellingPrice),
      Number(body.wholesalePrice) || Number(body.sellingPrice),
      Number(body.minSellingPrice) || Number(body.purchasePrice),
      Number(body.currentStock) || 0,
      Number(body.minStockLevel) || 10,
      Number(body.maxStockLevel) || 500,
      Number(body.reorderLevel) || 20,
      body.hsnCode || '21069099',
      Number(body.gstRate) || 0,
      body.taxType || 'INCLUSIVE',
      Number(body.cessRate) || 0,
      body.supplierId || null,
      now,
      now,
    ]
  );

  // Add initial batch if stock > 0
  if (body.currentStock > 0) {
    runExec(
      `INSERT INTO product_batches (id, product_id, batch_number, expiry_date, purchase_price, mrp, selling_price, quantity)
       VALUES (?, ?, ?, date('now', '+365 days'), ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        id,
        body.batchNumber || 'BAT-INIT',
        Number(body.purchasePrice) || 0,
        Number(body.mrp) || 0,
        Number(body.sellingPrice) || 0,
        Number(body.currentStock) || 0,
      ]
    );
  }

  addAuditLog(req.body.userId || 'system', req.body.userName || 'Admin', 'ADMIN', 'PRODUCT_CREATE', 'PRODUCT', id, null, body.name);
  broadcastEvent('stock_update', { productId: id, currentStock: body.currentStock });

  res.status(201).json({ id, message: 'Product created successfully' });
});

apiRouter.put('/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;
  const existing = queryOne(`SELECT * FROM products WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  runExec(
    `UPDATE products SET
      name = ?, description = ?, category_id = ?, subcategory = ?, brand = ?,
      unit = ?, is_weighing_scale = ?, purchase_price = ?, selling_price = ?,
      mrp = ?, wholesale_price = ?, min_selling_price = ?, min_stock_level = ?,
      reorder_level = ?, hsn_code = ?, gst_rate = ?, tax_type = ?, supplier_id = ?,
      updated_at = datetime('now')
     WHERE id = ?`,
    [
      body.name,
      body.description,
      body.categoryId,
      body.subcategory,
      body.brand,
      body.unit,
      body.isWeighingScale ? 1 : 0,
      Number(body.purchasePrice),
      Number(body.sellingPrice),
      Number(body.mrp),
      Number(body.wholesalePrice),
      Number(body.minSellingPrice),
      Number(body.minStockLevel),
      Number(body.reorderLevel),
      body.hsnCode,
      Number(body.gstRate),
      body.taxType,
      body.supplierId,
      id,
    ]
  );

  addAuditLog(body.userId || 'system', body.userName || 'Admin', 'ADMIN', 'PRODUCT_UPDATE', 'PRODUCT', id, existing, body);
  res.json({ message: 'Product updated successfully' });
});

apiRouter.post('/products/:id/adjust-stock', (req: Request, res: Response) => {
  const { id } = req.params;
  const { newStock, reason, userId, userName } = req.body;
  const existing = queryOne(`SELECT current_stock, name FROM products WHERE id = ?`, [id]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const oldStock = existing.current_stock;
  runExec(`UPDATE products SET current_stock = ?, updated_at = datetime('now') WHERE id = ?`, [newStock, id]);
  addAuditLog(userId || 'system', userName || 'Admin', 'INVENTORY_MANAGER', 'STOCK_ADJUSTMENT', 'PRODUCT', id, { stock: oldStock }, { stock: newStock }, reason);
  broadcastEvent('stock_update', { productId: id, currentStock: newStock });

  res.json({ message: 'Stock adjusted successfully', oldStock, newStock });
});

// Categories
apiRouter.get('/categories', (req: Request, res: Response) => {
  const cats = queryAll(
    `SELECT c.*, COUNT(p.id) as item_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
     GROUP BY c.id ORDER BY c.name ASC`
  );
  res.json(cats);
});

apiRouter.post('/categories', (req: Request, res: Response) => {
  const { name, description } = req.body;
  const id = 'cat-' + crypto.randomUUID().slice(0, 6);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  runExec(`INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)`, [id, name, slug, description || '']);
  res.status(201).json({ id, name, slug });
});

// --- POS BILLING & CHECKOUT (TRANSACTIONAL) ---
apiRouter.post('/pos/checkout', (req: Request, res: Response) => {
  const {
    cashierId,
    cashierName,
    counterId,
    customerId,
    customerName,
    customerPhone,
    customerGstin,
    items,
    payments,
    subtotal,
    discountTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    cessTotal,
    taxTotal,
    roundOff,
    grandTotal,
    loyaltyPointsRedeemed,
    notes,
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart cannot be empty' });
  }

  try {
    const result = runTransaction(() => {
      // 1. Generate guaranteed unique invoice number
      const now = new Date();
      const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
      const uniqueSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const invoiceNo = `BM-${dateStr}-${uniqueSuffix}`;
      const invoiceId = crypto.randomUUID();
      const nowIso = now.toISOString();

      const validSubtotal = Number(subtotal) || 0;
      const validGrandTotal = Number(grandTotal) || validSubtotal;
      const validTaxTotal = Number(taxTotal) || 0;

      // Check payment status
      const paymentList = Array.isArray(payments) && payments.length > 0 ? payments : [{ mode: 'CASH', amount: validGrandTotal }];
      const totalPaid = paymentList.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const isCredit = paymentList.some((p: any) => p.mode === 'CREDIT');
      const paymentStatus = isCredit ? 'CREDIT' : totalPaid >= validGrandTotal ? 'PAID' : 'PARTIAL';

      // 2. Insert sales invoice
      runExec(
        `INSERT INTO sales_invoices (
          id, invoice_no, invoice_date, cashier_id, cashier_name, counter_id,
          customer_id, customer_name, customer_phone, customer_gstin,
          subtotal, discount_total, cgst_total, sgst_total, igst_total, cess_total,
          tax_total, round_off, grand_total, payment_status, status,
          loyalty_points_earned, loyalty_points_redeemed, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)`,
        [
          invoiceId,
          invoiceNo,
          nowIso,
          cashierId || 'usr-3',
          cashierName || 'Cashier',
          counterId || 'POS-01',
          customerId || null,
          customerName || 'Walk-in Customer',
          customerPhone || null,
          customerGstin || null,
          validSubtotal,
          Number(discountTotal) || 0,
          Number(cgstTotal) || 0,
          Number(sgstTotal) || 0,
          Number(igstTotal) || 0,
          Number(cessTotal) || 0,
          validTaxTotal,
          Number(roundOff) || 0,
          validGrandTotal,
          paymentStatus,
          Math.floor(validGrandTotal / 100),
          Number(loyaltyPointsRedeemed) || 0,
          notes || '',
        ]
      );

      // 3. Insert sales items and deduct product stock
      for (const it of items) {
        const qty = Number(it.quantity) || 1;
        const mrp = Number(it.mrp ?? it.sellingPrice ?? 0);
        const unitPrice = Number(it.unitPrice ?? it.sellingPrice ?? mrp);
        const discountAmount = Number(it.discountAmount) || 0;
        const taxableAmount = Number(it.taxableAmount ?? (qty * unitPrice - discountAmount));
        const gstRate = Number(it.gstRate ?? 5);
        const cgstAmount = Number(it.cgstAmount) || 0;
        const sgstAmount = Number(it.sgstAmount) || 0;
        const igstAmount = Number(it.igstAmount) || 0;
        const cessAmount = Number(it.cessAmount) || 0;
        const total = Number(it.total ?? (taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount));

        runExec(
          `INSERT INTO sales_items (
            id, invoice_id, product_id, product_name, barcode, hsn_code, unit,
            quantity, mrp, unit_price, discount_amount, taxable_amount, gst_rate,
            cgst_amount, sgst_amount, igst_amount, cess_amount, total, batch_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            invoiceId,
            it.productId || 'prd-unknown',
            it.productName || 'Grocery Item',
            it.barcode || 'NO-BARCODE',
            it.hsnCode || '21069099',
            it.unit || 'pc',
            qty,
            mrp,
            unitPrice,
            discountAmount,
            taxableAmount,
            gstRate,
            cgstAmount,
            sgstAmount,
            igstAmount,
            cessAmount,
            total,
            it.batchNumber || null,
          ]
        );

        // Deduct inventory atomically
        if (it.productId) {
          runExec(
            `UPDATE products SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?`,
            [qty, it.productId]
          );
        }
      }

      // 4. Record payment splits
      for (const p of paymentList) {
        runExec(
          `INSERT INTO invoice_payments (id, invoice_id, mode, amount, reference_no, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), invoiceId, p.mode, Number(p.amount) || 0, p.referenceNo || null, nowIso]
        );
      }

      // 5. If customer and credit/khata used, update customer ledger
      const creditPayment = payments.find((p: any) => p.mode === 'CREDIT');
      if (customerId && creditPayment && creditPayment.amount > 0) {
        const cust = queryOne<{ outstanding_balance: number }>(
          `SELECT outstanding_balance FROM customers WHERE id = ?`,
          [customerId]
        );
        const newBal = (cust?.outstanding_balance || 0) + Number(creditPayment.amount);
        runExec(`UPDATE customers SET outstanding_balance = ?, last_purchase_date = ? WHERE id = ?`, [
          newBal,
          now,
          customerId,
        ]);

        runExec(
          `INSERT INTO customer_khata (id, customer_id, date, type, amount, balance_after, reference_no, notes, recorded_by)
           VALUES (?, ?, ?, 'CREDIT_SALE', ?, ?, ?, 'POS Credit Sale', ?)`,
          [
            crypto.randomUUID(),
            customerId,
            now,
            creditPayment.amount,
            newBal,
            invoiceNo,
            cashierName || 'Cashier',
          ]
        );
      }

      // Update customer total purchases and loyalty
      if (customerId) {
        const pointsEarned = Math.floor(grandTotal / 100);
        runExec(
          `UPDATE customers SET
             total_purchases = total_purchases + ?,
             loyalty_points = loyalty_points + ? - ?,
             last_purchase_date = ?
           WHERE id = ?`,
          [grandTotal, pointsEarned, loyaltyPointsRedeemed || 0, now, customerId]
        );
      }

      // 6. Update active cashier session if available
      const activeSession = queryOne<{ id: string }>(
        `SELECT id FROM cashier_sessions WHERE cashier_id = ? AND status = 'OPEN'`,
        [cashierId || 'usr-3']
      );

      if (activeSession) {
        const cashAmount = payments.filter((p: any) => p.mode === 'CASH').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const upiAmount = payments.filter((p: any) => p.mode === 'UPI').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const cardAmount = payments.filter((p: any) => p.mode === 'CARD').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const credAmount = payments.filter((p: any) => p.mode === 'CREDIT').reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        runExec(
          `UPDATE cashier_sessions SET
             total_sales = total_sales + ?,
             cash_sales = cash_sales + ?,
             upi_sales = upi_sales + ?,
             card_sales = card_sales + ?,
             credit_sales = credit_sales + ?,
             expected_cash = expected_cash + ?
           WHERE id = ?`,
          [grandTotal, cashAmount, upiAmount, cardAmount, credAmount, cashAmount, activeSession.id]
        );
      }

      // 7. Audit Log
      addAuditLog(
        cashierId || 'usr-3',
        cashierName || 'Cashier',
        'CASHIER',
        'SALES_INVOICE_CREATE',
        'INVOICE',
        invoiceId,
        null,
        { invoiceNo, grandTotal, itemsCount: items.length }
      );

      return { invoiceId, invoiceNo, invoiceDate: now, grandTotal };
    });

    // Broadcast live event to all connected billing counters
    broadcastEvent('invoice_created', result);

    res.status(201).json(result);
  } catch (err: any) {
    console.error('POS Checkout failed:', err);
    res.status(500).json({ error: 'Transaction failed: ' + (err.message || 'Database error') });
  }
});

// Hold / Recall Bills
apiRouter.post('/pos/hold-bill', (req: Request, res: Response) => {
  const { customer, items, subtotal, discount, taxTotal, grandTotal, note } = req.body;
  const id = 'hold-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  runExec(
    `INSERT INTO held_bills (id, held_at, customer_json, items_json, subtotal, discount, tax_total, grand_total, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      now,
      customer ? JSON.stringify(customer) : null,
      JSON.stringify(items),
      subtotal,
      discount || 0,
      taxTotal || 0,
      grandTotal,
      note || '',
    ]
  );

  res.status(201).json({ id, message: 'Bill held successfully' });
});

apiRouter.get('/pos/held-bills', (req: Request, res: Response) => {
  const rows = queryAll(`SELECT * FROM held_bills ORDER BY held_at DESC`);
  const formatted = rows.map((r: any) => ({
    id: r.id,
    heldAt: r.held_at,
    customer: r.customer_json ? JSON.parse(r.customer_json) : null,
    items: JSON.parse(r.items_json),
    subtotal: r.subtotal,
    discount: r.discount,
    taxTotal: r.tax_total,
    grandTotal: r.grand_total,
    note: r.note,
  }));
  res.json(formatted);
});

apiRouter.delete('/pos/held-bills/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  runExec(`DELETE FROM held_bills WHERE id = ?`, [id]);
  res.json({ message: 'Held bill removed' });
});

// Invoices list & detail
apiRouter.get('/invoices', (req: Request, res: Response) => {
  const { search, date, customerId } = req.query;
  let sql = `SELECT * FROM sales_invoices WHERE 1=1`;
  const params: any[] = [];

  if (search) {
    sql += ` AND (invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (date) {
    sql += ` AND date(invoice_date) = date(?)`;
    params.push(date);
  }
  if (customerId) {
    sql += ` AND customer_id = ?`;
    params.push(customerId);
  }

  sql += ` ORDER BY invoice_date DESC LIMIT 100`;
  const invoices = queryAll(sql, params);
  res.json(toCamelCase(invoices));
});

apiRouter.get('/invoices/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const invoice = queryOne(`SELECT * FROM sales_invoices WHERE id = ? OR invoice_no = ?`, [id, id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const items = queryAll(`SELECT * FROM sales_items WHERE invoice_id = ?`, [invoice.id]);
  const payments = queryAll(`SELECT * FROM invoice_payments WHERE invoice_id = ?`, [invoice.id]);

  res.json(toCamelCase({ ...invoice, items, payments }));
});

// Sales Returns
apiRouter.post('/invoices/:id/return', (req: Request, res: Response) => {
  const { id } = req.params;
  const { productId, quantity, refundAmount, refundMode, reason, authorizedBy } = req.body;

  const invoice = queryOne(`SELECT * FROM sales_invoices WHERE id = ?`, [id]);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  try {
    const result = runTransaction(() => {
      const returnNo = 'RET-' + crypto.randomUUID().slice(0, 8).toUpperCase();
      const product = queryOne(`SELECT name FROM products WHERE id = ?`, [productId]);

      runExec(
        `INSERT INTO sales_returns (
          id, return_no, invoice_id, invoice_no, date, customer_id, customer_name,
          product_id, product_name, quantity, refund_amount, refund_mode, reason, authorized_by
        ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          returnNo,
          invoice.id,
          invoice.invoice_no,
          invoice.customer_id,
          invoice.customer_name,
          productId,
          product?.name || 'Product',
          quantity,
          refundAmount,
          refundMode || 'CASH',
          reason || 'Customer Return',
          authorizedBy || 'Manager',
        ]
      );

      // Re-add stock
      runExec(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`, [quantity, productId]);

      // If store credit / Khata refund for registered customer
      if (refundMode === 'STORE_CREDIT' && invoice.customer_id) {
        runExec(
          `UPDATE customers SET outstanding_balance = outstanding_balance - ? WHERE id = ?`,
          [refundAmount, invoice.customer_id]
        );
      }

      addAuditLog(
        authorizedBy,
        authorizedBy,
        'STORE_MANAGER',
        'SALES_RETURN',
        'INVOICE',
        invoice.id,
        null,
        { returnNo, productId, quantity, refundAmount, reason }
      );

      return { returnNo, refundAmount };
    });

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Return failed' });
  }
});

// --- CUSTOMERS & DIGITAL KHATA ---
apiRouter.get('/customers', (req: Request, res: Response) => {
  const { search } = req.query;
  let sql = `SELECT * FROM customers WHERE 1=1`;
  const params: any[] = [];
  if (search) {
    sql += ` AND (name LIKE ? OR phone LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term);
  }
  sql += ` ORDER BY name ASC`;
  res.json(toCamelCase(queryAll(sql, params)));
});

apiRouter.post('/customers', (req: Request, res: Response) => {
  const { name, phone, email, address, gstin, customerType, creditLimit, openingBalance } = req.body;
  const id = 'cust-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const initBal = Number(openingBalance) || 0;

  runExec(
    `INSERT INTO customers (id, name, phone, email, address, gstin, customer_type, credit_limit, outstanding_balance, opening_balance, loyalty_points, total_purchases, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    [
      id,
      name,
      phone,
      email || null,
      address || null,
      gstin || null,
      customerType || 'RETAIL',
      Number(creditLimit) || 5000,
      initBal,
      initBal,
      now,
    ]
  );

  if (initBal > 0) {
    runExec(
      `INSERT INTO customer_khata (id, customer_id, date, type, amount, balance_after, reference_no, notes, recorded_by)
       VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, 'OPENING_BAL', 'Initial opening balance', 'Admin')`,
      [crypto.randomUUID(), id, now, initBal, initBal]
    );
  }

  res.status(201).json(toCamelCase({ id, name, phone, outstanding_balance: initBal }));
});

apiRouter.get('/customers/:id/khata', (req: Request, res: Response) => {
  const { id } = req.params;
  const customer = queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const ledger = queryAll(`SELECT * FROM customer_khata WHERE customer_id = ? ORDER BY date DESC`, [id]);
  res.json(toCamelCase({ customer, ledger }));
});

apiRouter.post('/customers/:id/payment', (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, paymentMode, referenceNo, notes, recordedBy } = req.body;
  const payAmt = Number(amount);

  if (payAmt <= 0) return res.status(400).json({ error: 'Payment amount must be greater than zero' });

  const customer = queryOne<{ outstanding_balance: number; name: string }>(
    `SELECT outstanding_balance, name FROM customers WHERE id = ?`,
    [id]
  );
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const balanceAfter = customer.outstanding_balance - payAmt;

  try {
    runTransaction(() => {
      runExec(`UPDATE customers SET outstanding_balance = ? WHERE id = ?`, [balanceAfter, id]);
      runExec(
        `INSERT INTO customer_khata (id, customer_id, date, type, amount, balance_after, reference_no, notes, recorded_by)
         VALUES (?, ?, datetime('now'), 'PAYMENT_RECEIVED', ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          id,
          payAmt,
          balanceAfter,
          referenceNo || paymentMode,
          notes || `Khata payment via ${paymentMode}`,
          recordedBy || 'Cashier',
        ]
      );
      addAuditLog(recordedBy || 'staff', recordedBy || 'Staff', 'CASHIER', 'KHATA_PAYMENT', 'CUSTOMER', id, { bal: customer.outstanding_balance }, { bal: balanceAfter });
    });

    res.json({ message: 'Payment recorded', balanceAfter });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Payment recording failed' });
  }
});

// --- SUPPLIERS & PURCHASES ---
apiRouter.get('/suppliers', (req: Request, res: Response) => {
  res.json(toCamelCase(queryAll(`SELECT * FROM suppliers ORDER BY name ASC`)));
});

apiRouter.post('/suppliers', (req: Request, res: Response) => {
  const body = req.body;
  const id = 'sup-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  runExec(
    `INSERT INTO suppliers (id, name, company, contact_person, phone, email, address, gstin, pan, payment_terms, credit_period_days, outstanding_balance, opening_balance, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      body.name,
      body.company,
      body.contactPerson || '',
      body.phone,
      body.email || '',
      body.address || '',
      body.gstin || '',
      body.pan || '',
      body.paymentTerms || 'Net 30',
      Number(body.creditPeriodDays) || 30,
      Number(body.openingBalance) || 0,
      Number(body.openingBalance) || 0,
      now,
    ]
  );
  res.status(201).json({ id, message: 'Supplier added successfully' });
});

apiRouter.get('/purchases', (req: Request, res: Response) => {
  const purchases = queryAll(`SELECT * FROM purchase_invoices ORDER BY invoice_date DESC LIMIT 50`);
  res.json(toCamelCase(purchases));
});

apiRouter.post('/purchases', (req: Request, res: Response) => {
  const { supplierId, supplierName, invoiceNo, items, subtotal, taxTotal, grandTotal, paidAmount, notes } = req.body;

  try {
    runTransaction(() => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const status = Number(paidAmount) >= grandTotal ? 'PAID' : Number(paidAmount) > 0 ? 'PARTIAL' : 'PENDING';

      runExec(
        `INSERT INTO purchase_invoices (
          id, invoice_no, invoice_date, supplier_id, supplier_name, subtotal, tax_total, grand_total, paid_amount, payment_status, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?)`,
        [id, invoiceNo, now, supplierId, supplierName, subtotal, taxTotal, grandTotal, paidAmount || 0, status, notes || '', now]
      );

      // Add stock and update supplier payable
      const unpaid = grandTotal - (Number(paidAmount) || 0);
      if (unpaid > 0) {
        runExec(`UPDATE suppliers SET outstanding_balance = outstanding_balance + ? WHERE id = ?`, [unpaid, supplierId]);
      }

      for (const it of items) {
        runExec(
          `INSERT INTO purchase_items (
            id, purchase_invoice_id, product_id, product_name, barcode, hsn_code, batch_number, expiry_date, quantity, free_quantity, unit_price, mrp, selling_price, gst_rate, tax_amount, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            id,
            it.productId,
            it.productName,
            it.barcode,
            it.hsnCode,
            it.batchNumber,
            it.expiryDate,
            it.quantity,
            it.freeQuantity || 0,
            it.unitPrice,
            it.mrp,
            it.sellingPrice,
            it.gstRate,
            it.taxAmount,
            it.total,
          ]
        );

        // Update product stock and batch
        const totalQty = Number(it.quantity) + (Number(it.freeQuantity) || 0);
        runExec(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`, [totalQty, it.productId]);

        runExec(
          `INSERT INTO product_batches (id, product_id, batch_number, expiry_date, purchase_price, mrp, selling_price, quantity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), it.productId, it.batchNumber, it.expiryDate, it.unitPrice, it.mrp, it.sellingPrice, totalQty]
        );
      }

      addAuditLog(req.body.userId || 'admin', req.body.userName || 'Admin', 'STORE_MANAGER', 'PURCHASE_RECEIVE', 'PURCHASE', id, null, { invoiceNo, grandTotal });
    });

    res.status(201).json({ message: 'Purchase invoice recorded and stock updated' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Purchase recording failed' });
  }
});

// --- GST MANAGEMENT & COMPLIANCE ---
apiRouter.get('/gst/rates-summary', (req: Request, res: Response) => {
  // Aggregate sales by GST rate
  const rateSummary = queryAll<{ gst_rate: number; taxable_amount: number; tax_amount: number }>(
    `SELECT i.gst_rate,
            SUM(i.taxable_amount) as taxable_amount,
            SUM(i.cgst_amount + i.sgst_amount + i.igst_amount) as tax_amount
     FROM sales_items i
     JOIN sales_invoices s ON s.id = i.invoice_id
     WHERE s.status = 'COMPLETED'
     GROUP BY i.gst_rate
     ORDER BY i.gst_rate ASC`
  );

  // HSN-wise sales summary for GSTR-1
  const hsnSummary = queryAll(
    `SELECT i.hsn_code, i.product_name, i.unit,
            SUM(i.quantity) as total_qty,
            SUM(i.taxable_amount) as taxable_amount,
            i.gst_rate,
            SUM(i.cgst_amount) as cgst,
            SUM(i.sgst_amount) as sgst,
            SUM(i.total) as total_value
     FROM sales_items i
     JOIN sales_invoices s ON s.id = i.invoice_id
     WHERE s.status = 'COMPLETED'
     GROUP BY i.hsn_code, i.gst_rate
     ORDER BY total_value DESC`
  );

  res.json({ rateSummary, hsnSummary });
});

apiRouter.get('/gst/history', (req: Request, res: Response) => {
  const history = queryAll(`SELECT * FROM gst_rate_history ORDER BY created_at DESC`);
  res.json(toCamelCase(history));
});

apiRouter.post('/gst/update-product-tax', (req: Request, res: Response) => {
  const { productId, newHsn, newRate, effectiveDate, reason, referenceNote, changedBy } = req.body;
  const product = queryOne(`SELECT name, hsn_code, gst_rate FROM products WHERE id = ?`, [productId]);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    runTransaction(() => {
      // 1. Update product
      runExec(`UPDATE products SET hsn_code = ?, gst_rate = ?, updated_at = datetime('now') WHERE id = ?`, [
        newHsn,
        newRate,
        productId,
      ]);

      // 2. Insert immutable GST history record
      runExec(
        `INSERT INTO gst_rate_history (id, product_id, product_name, old_hsn, new_hsn, old_rate, new_rate, effective_date, changed_by, created_at, reason, reference_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
        [
          crypto.randomUUID(),
          productId,
          product.name,
          product.hsn_code,
          newHsn,
          product.gst_rate,
          newRate,
          effectiveDate || new Date().toISOString().split('T')[0],
          changedBy || 'Administrator',
          reason || 'Statutory GST revision',
          referenceNote || '',
        ]
      );

      addAuditLog(
        changedBy || 'admin',
        changedBy || 'Admin',
        'ACCOUNTANT',
        'GST_RATE_CHANGE',
        'PRODUCT',
        productId,
        { hsn: product.hsn_code, rate: product.gst_rate },
        { hsn: newHsn, rate: newRate },
        reason
      );
    });

    res.json({ message: 'GST configuration updated and historical log generated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'GST update failed' });
  }
});

// --- CASH COUNTERS & SESSIONS ---
apiRouter.get('/counters', (req: Request, res: Response) => {
  const counters = queryAll(`SELECT * FROM cash_counters ORDER BY code ASC`);
  res.json(toCamelCase(counters));
});

apiRouter.get('/counters/session/:cashierId', (req: Request, res: Response) => {
  const { cashierId } = req.params;
  const session = queryOne(`SELECT * FROM cashier_sessions WHERE cashier_id = ? AND status = 'OPEN'`, [cashierId]);
  res.json(session ? toCamelCase(session) : null);
});

apiRouter.post('/counters/session/open', (req: Request, res: Response) => {
  const { counterId, counterName, cashierId, cashierName, openingCash } = req.body;
  const sessionId = 'ses-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  try {
    runTransaction(() => {
      runExec(
        `INSERT INTO cashier_sessions (id, counter_id, counter_name, cashier_id, cashier_name, opened_at, opening_cash, expected_cash, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
        [sessionId, counterId, counterName, cashierId, cashierName, now, Number(openingCash) || 0, Number(openingCash) || 0]
      );

      runExec(
        `UPDATE cash_counters SET current_cashier_id = ?, current_cashier_name = ?, active_session_id = ?, status = 'OPEN' WHERE id = ?`,
        [cashierId, cashierName, sessionId, counterId]
      );

      addAuditLog(cashierId, cashierName, 'CASHIER', 'SESSION_OPEN', 'COUNTER', counterId, null, { openingCash });
    });

    res.status(201).json({ sessionId, message: 'Shift opened successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Opening shift failed' });
  }
});

apiRouter.post('/counters/session/close', (req: Request, res: Response) => {
  const { sessionId, actualCash, notes, cashierId, cashierName } = req.body;
  const session = queryOne(`SELECT * FROM cashier_sessions WHERE id = ?`, [sessionId]);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const actual = Number(actualCash);
  const difference = actual - session.expected_cash;

  try {
    runTransaction(() => {
      runExec(
        `UPDATE cashier_sessions SET closed_at = datetime('now'), actual_cash = ?, difference = ?, status = 'CLOSED', notes = ? WHERE id = ?`,
        [actual, difference, notes || '', sessionId]
      );

      runExec(
        `UPDATE cash_counters SET current_cashier_id = NULL, current_cashier_name = NULL, active_session_id = NULL, status = 'CLOSED' WHERE id = ?`,
        [session.counter_id]
      );

      addAuditLog(cashierId || session.cashier_id, cashierName || session.cashier_name, 'CASHIER', 'SESSION_CLOSE', 'COUNTER', session.counter_id, session, {
        actualCash: actual,
        difference,
      });
    });

    res.json({ message: 'Shift closed', expectedCash: session.expected_cash, actualCash: actual, difference });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Closing shift failed' });
  }
});

// --- STAFF & ATTENDANCE ---
apiRouter.get('/staff', (req: Request, res: Response) => {
  res.json(toCamelCase(queryAll(`SELECT * FROM staff ORDER BY employee_code ASC`)));
});

apiRouter.get('/staff/attendance/today', (req: Request, res: Response) => {
  res.json(toCamelCase(queryAll(`SELECT * FROM staff_attendance WHERE date = date('now')`)));
});

apiRouter.post('/staff/attendance', (req: Request, res: Response) => {
  const { staffId, staffName, status, inTime, outTime, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  const existing = queryOne(`SELECT id FROM staff_attendance WHERE staff_id = ? AND date = ?`, [staffId, today]);
  if (existing) {
    runExec(
      `UPDATE staff_attendance SET status = ?, in_time = ?, out_time = ?, notes = ? WHERE id = ?`,
      [status, inTime, outTime, notes || '', existing.id]
    );
  } else {
    runExec(
      `INSERT INTO staff_attendance (id, staff_id, staff_name, date, in_time, out_time, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), staffId, staffName, today, inTime || '09:00', outTime || null, status || 'PRESENT', notes || '']
    );
  }
  res.json({ message: 'Attendance recorded' });
});

// --- EXPENSES ---
apiRouter.get('/expenses', (req: Request, res: Response) => {
  res.json(toCamelCase(queryAll(`SELECT * FROM expenses ORDER BY date DESC LIMIT 100`)));
});

apiRouter.post('/expenses', (req: Request, res: Response) => {
  const { category, amount, paymentMethod, description, authorizedBy } = req.body;
  const id = crypto.randomUUID();
  const rcpt = 'EXP-' + Math.floor(1000 + Math.random() * 9000);

  runExec(
    `INSERT INTO expenses (id, category, amount, date, payment_method, description, authorized_by, receipt_number)
     VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)`,
    [id, category, Number(amount), paymentMethod || 'CASH', description, authorizedBy || 'Store Manager', rcpt]
  );

  addAuditLog(req.body.userId || 'admin', authorizedBy, 'ACCOUNTANT', 'EXPENSE_RECORD', 'EXPENSE', id, null, { category, amount });
  res.status(201).json({ id, receiptNumber: rcpt });
});

// --- AUDIT LOGS ---
apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  res.json(queryAll(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 150`));
});

// --- SETTINGS ---
apiRouter.get('/settings', (req: Request, res: Response) => {
  const rows = queryAll<{ key: string; value: string }>(`SELECT key, value FROM store_settings`);
  const settings: Record<string, any> = {};
  for (const r of rows) {
    settings[r.key] = r.value === 'true' ? true : r.value === 'false' ? false : r.value;
  }
  res.json(settings);
});

apiRouter.post('/settings', (req: Request, res: Response) => {
  const settings = req.body;
  for (const [k, v] of Object.entries(settings)) {
    runExec(`INSERT OR REPLACE INTO store_settings (key, value) VALUES (?, ?)`, [k, String(v)]);
  }
  addAuditLog(req.body.userId || 'admin', req.body.userName || 'Admin', 'SUPER_ADMIN', 'SETTINGS_UPDATE', 'SETTINGS', 'STORE', null, settings);
  res.json({ message: 'Settings saved successfully' });
});

// --- BACKUP & RESTORE ---
apiRouter.get('/backup/export', (req: Request, res: Response) => {
  const buffer = getDatabaseExport();
  res.setHeader('Content-Disposition', `attachment; filename=bharatmart_backup_${Date.now()}.sqlite`);
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.send(buffer);
});
