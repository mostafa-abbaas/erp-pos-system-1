-- ============================================================
-- ERP/POS System - Full Database Schema
-- PostgreSQL 16
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fast text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'CASHIER', 'WAREHOUSE', 'BRANCH_MANAGER');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT', 'MIXED');
CREATE TYPE sale_status AS ENUM ('DRAFT', 'COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');
CREATE TYPE transfer_status AS ENUM ('PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE movement_type AS ENUM ('PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'DAMAGE', 'RETURN', 'INITIAL');
CREATE TYPE notification_type AS ENUM ('LOW_STOCK', 'TRANSFER_REQUEST', 'TRANSFER_COMPLETED', 'SYNC_ERROR', 'DAILY_REPORT', 'SYSTEM');
CREATE TYPE sync_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');
CREATE TYPE log_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'PRINT');

-- ============================================================
-- BRANCHES
-- ============================================================

CREATE TABLE branches (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    name_ar     VARCHAR(100),
    address     TEXT,
    phone       VARCHAR(20),
    is_warehouse BOOLEAN DEFAULT FALSE,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(100) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    full_name_ar    VARCHAR(100),
    role            user_role NOT NULL DEFAULT 'CASHIER',
    status          user_status NOT NULL DEFAULT 'ACTIVE',
    branch_id       UUID REFERENCES branches(id),
    avatar_url      VARCHAR(500),
    last_login_at   TIMESTAMPTZ,
    failed_attempts INT DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    is_revoked  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      log_action NOT NULL,
    entity      VARCHAR(50) NOT NULL,
    entity_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    user_agent  TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCT CATALOG
-- ============================================================

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    name_ar     VARCHAR(100),
    parent_id   UUID REFERENCES categories(id),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brands (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    name_ar     VARCHAR(100),
    logo_url    VARCHAR(500),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_types (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    name_ar     VARCHAR(100),
    brand_id    UUID REFERENCES brands(id),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    name_ar     VARCHAR(100),
    contact     VARCHAR(100),
    phone       VARCHAR(30),
    email       VARCHAR(100),
    address     TEXT,
    tax_number  VARCHAR(50),
    balance     DECIMAL(15,2) DEFAULT 0,
    notes       TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internal_code       VARCHAR(50) UNIQUE NOT NULL,
    barcode             VARCHAR(100) UNIQUE,
    name                VARCHAR(200) NOT NULL,
    name_ar             VARCHAR(200),
    description         TEXT,
    category_id         UUID REFERENCES categories(id),
    brand_id            UUID REFERENCES brands(id),
    device_type_id      UUID REFERENCES device_types(id),
    compatible_models   TEXT[],
    purchase_price      DECIMAL(15,2) NOT NULL DEFAULT 0,
    selling_price       DECIMAL(15,2) NOT NULL DEFAULT 0,
    min_selling_price   DECIMAL(15,2),
    tax_rate            DECIMAL(5,2) DEFAULT 0,
    supplier_id         UUID REFERENCES suppliers(id),
    image_url           VARCHAR(500),
    min_stock_alert     INT DEFAULT 5,
    is_active           BOOLEAN DEFAULT TRUE,
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    quantity        INT NOT NULL DEFAULT 0,
    reserved_qty    INT NOT NULL DEFAULT 0,  -- reserved for pending orders
    location        VARCHAR(100),             -- shelf/bin location in warehouse
    last_counted_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, branch_id),
    CONSTRAINT qty_non_negative CHECK (quantity >= 0)
);

CREATE TABLE inventory_movements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    type            movement_type NOT NULL,
    quantity        INT NOT NULL,              -- positive = in, negative = out
    quantity_before INT NOT NULL,
    quantity_after  INT NOT NULL,
    unit_cost       DECIMAL(15,2),
    reference_id    UUID,                      -- sale_id, transfer_id, purchase_id
    reference_type  VARCHAR(50),
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE warehouse_locations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    code        VARCHAR(20) NOT NULL,
    aisle       VARCHAR(10),
    shelf       VARCHAR(10),
    bin         VARCHAR(10),
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, code)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(30),
    email       VARCHAR(100),
    address     TEXT,
    tax_number  VARCHAR(50),
    balance     DECIMAL(15,2) DEFAULT 0,      -- credit balance
    total_purchases DECIMAL(15,2) DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES / POS
-- ============================================================

CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number  VARCHAR(30) UNIQUE NOT NULL,
    branch_id       UUID NOT NULL REFERENCES branches(id),
    cashier_id      UUID NOT NULL REFERENCES users(id),
    customer_id     UUID REFERENCES customers(id),
    status          sale_status NOT NULL DEFAULT 'COMPLETED',
    subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
    total           DECIMAL(15,2) NOT NULL DEFAULT 0,
    payment_method  payment_method NOT NULL DEFAULT 'CASH',
    amount_paid     DECIMAL(15,2) NOT NULL DEFAULT 0,
    change_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    shift_id        UUID,
    printed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INT NOT NULL,
    unit_price      DECIMAL(15,2) NOT NULL,
    discount_pct    DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_rate        DECIMAL(5,2) DEFAULT 0,
    tax_amount      DECIMAL(15,2) DEFAULT 0,
    total           DECIMAL(15,2) NOT NULL,
    cost_price      DECIMAL(15,2),             -- for profit calculation
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refunds (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id         UUID NOT NULL REFERENCES sales(id),
    processed_by    UUID NOT NULL REFERENCES users(id),
    reason          TEXT NOT NULL,
    total           DECIMAL(15,2) NOT NULL,
    payment_method  payment_method NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refund_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_id   UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id),
    quantity    INT NOT NULL,
    total       DECIMAL(15,2) NOT NULL
);

CREATE TABLE shifts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    cashier_id      UUID NOT NULL REFERENCES users(id),
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(15,2),
    total_sales     DECIMAL(15,2),
    total_cash      DECIMAL(15,2),
    notes           TEXT,
    opened_at       TIMESTAMPTZ DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

-- ============================================================
-- PURCHASES
-- ============================================================

CREATE TABLE purchases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number     VARCHAR(30) UNIQUE NOT NULL,
    branch_id           UUID NOT NULL REFERENCES branches(id),
    supplier_id         UUID NOT NULL REFERENCES suppliers(id),
    received_by         UUID REFERENCES users(id),
    subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount     DECIMAL(15,2) DEFAULT 0,
    tax_amount          DECIMAL(15,2) DEFAULT 0,
    total               DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid         DECIMAL(15,2) DEFAULT 0,
    notes               TEXT,
    invoice_ref         VARCHAR(100),           -- supplier invoice number
    received_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id     UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INT NOT NULL,
    unit_cost       DECIMAL(15,2) NOT NULL,
    total           DECIMAL(15,2) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK TRANSFERS
-- ============================================================

CREATE TABLE transfers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(30) UNIQUE NOT NULL,
    from_branch_id  UUID NOT NULL REFERENCES branches(id),
    to_branch_id    UUID NOT NULL REFERENCES branches(id),
    status          transfer_status NOT NULL DEFAULT 'PENDING',
    requested_by    UUID NOT NULL REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    dispatched_by   UUID REFERENCES users(id),
    received_by     UUID REFERENCES users(id),
    notes           TEXT,
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    dispatched_at   TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_transfer CHECK (from_branch_id <> to_branch_id)
);

CREATE TABLE transfer_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id     UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    requested_qty   INT NOT NULL,
    approved_qty    INT,
    received_qty    INT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        notification_type NOT NULL,
    title       VARCHAR(200) NOT NULL,
    title_ar    VARCHAR(200),
    message     TEXT NOT NULL,
    message_ar  TEXT,
    user_id     UUID REFERENCES users(id),
    branch_id   UUID REFERENCES branches(id),
    reference_id UUID,
    reference_type VARCHAR(50),
    is_read     BOOLEAN DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYNC LOG
-- ============================================================

CREATE TABLE sync_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity      VARCHAR(50) NOT NULL,
    entity_id   UUID NOT NULL,
    action      VARCHAR(20) NOT NULL,
    payload     JSONB NOT NULL,
    status      sync_status DEFAULT 'PENDING',
    attempts    INT DEFAULT 0,
    last_error  TEXT,
    synced_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Products
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_internal_code ON products(internal_code);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_name_ar_trgm ON products USING gin(name_ar gin_trgm_ops);

-- Inventory
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_branch ON inventory(branch_id);
CREATE INDEX idx_inventory_low_stock ON inventory(product_id, branch_id) WHERE quantity > 0;

-- Movements
CREATE INDEX idx_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_movements_branch ON inventory_movements(branch_id);
CREATE INDEX idx_movements_created ON inventory_movements(created_at DESC);
CREATE INDEX idx_movements_reference ON inventory_movements(reference_id) WHERE reference_id IS NOT NULL;

-- Sales
CREATE INDEX idx_sales_branch ON sales(branch_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_invoice ON sales(invoice_number);

-- Sale items
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- Transfers
CREATE INDEX idx_transfers_from_branch ON transfers(from_branch_id);
CREATE INDEX idx_transfers_to_branch ON transfers(to_branch_id);
CREATE INDEX idx_transfers_status ON transfers(status);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_branch ON notifications(branch_id);

-- Audit logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Sync log
CREATE INDEX idx_sync_log_status ON sync_log(status) WHERE status IN ('PENDING', 'FAILED');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['branches','users','products','categories','suppliers','customers','inventory','sales','purchases','transfers']
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_updated_at_%s
            BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
    END LOOP;
END;
$$;

-- Auto generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(branch_code VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    today_str VARCHAR;
    seq_num   BIGINT;
BEGIN
    today_str := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO seq_num
    FROM sales
    WHERE DATE(created_at) = CURRENT_DATE AND branch_id = (SELECT id FROM branches WHERE code = branch_code LIMIT 1);
    RETURN CONCAT(branch_code, '-', today_str, '-', LPAD(seq_num::TEXT, 4, '0'));
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED: DEFAULT BRANCH & ADMIN
-- ============================================================

INSERT INTO branches (code, name, name_ar, is_warehouse)
VALUES 
    ('MAIN', 'Main Store', 'المتجر الرئيسي', FALSE),
    ('WH01', 'Main Warehouse', 'المستودع الرئيسي', TRUE);

-- Admin user: password = Admin@1234 (will be hashed by the app on first run)
-- We insert a bcrypt hash here directly for initial setup
INSERT INTO users (username, email, password_hash, full_name, full_name_ar, role, branch_id)
VALUES (
    'admin',
    'admin@erp.local',
    '$2b$12$QVBncQZPXnu4p.Tw4SyP1u6VgnyHwD3OG1V9h7lmCnJL.iKKBVYva', -- Admin@1234 (verified: bcrypt 12 rounds)
    'System Administrator',
    'مدير النظام',
    'ADMIN',
    (SELECT id FROM branches WHERE code = 'MAIN')
);

-- Sample categories
INSERT INTO categories (code, name, name_ar) VALUES
    ('ELEC', 'Electrical Parts', 'قطع كهربائية'),
    ('MECH', 'Mechanical Parts', 'قطع ميكانيكية'),
    ('COOL', 'Cooling Parts', 'قطع تبريد'),
    ('HEAT', 'Heating Parts', 'قطع تسخين'),
    ('CTRL', 'Control Boards', 'لوحات تحكم'),
    ('SEAL', 'Seals & Gaskets', 'حلقات وحشوات'),
    ('PUMP', 'Pumps & Motors', 'مضخات ومحركات'),
    ('FILT', 'Filters', 'فلاتر');

-- Sample brands
INSERT INTO brands (name, name_ar) VALUES
    ('Samsung', 'سامسونج'),
    ('LG', 'إل جي'),
    ('Ariston', 'أريستون'),
    ('Beko', 'بيكو'),
    ('Zanussi', 'زانوسي'),
    ('Toshiba', 'توشيبا'),
    ('Sharp', 'شارب'),
    ('Carrier', 'كاريير');

-- ============================================================
-- SEED: SUPPLIERS
-- ============================================================

INSERT INTO suppliers (code, name, name_ar, contact, phone, email, is_active)
VALUES
    ('SUP-001', 'Al-Nile Electronics',    'النيل للإلكترونيات',    'Ahmed Hassan',  '+20-2-12345678', 'supplier@alnile.com',    TRUE),
    ('SUP-002', 'Cairo Spare Parts',      'القاهرة لقطع الغيار',   'Mohamed Ali',   '+20-2-87654321', 'info@cairospares.com',   TRUE),
    ('SUP-003', 'Delta Tech Supplies',    'دلتا تك للمستلزمات',    'Sara Ibrahim',  '+20-2-11223344', 'delta@deltatech.com',    TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED: SAMPLE PRODUCTS (20 spare parts)
-- ============================================================

INSERT INTO products (
    internal_code, barcode, name, name_ar,
    category_id, purchase_price, selling_price, min_selling_price,
    tax_rate, supplier_id, min_stock_alert, is_active
)
SELECT
    p.internal_code, p.barcode, p.name, p.name_ar,
    c.id as category_id,
    p.purchase_price, p.selling_price, p.min_selling_price,
    0 as tax_rate,
    s.id as supplier_id,
    p.min_stock_alert, TRUE
FROM (VALUES
    ('SP-001', '6901234567001', 'Motor Start Capacitor 25uF',     'مكثف تشغيل موتور 25 ميكروفاراد',     'ELEC', 25.50,  45.00,  40.00,  5,  'SUP-001'),
    ('SP-002', '6901234567002', 'Washing Machine Pump 250W',      'مضخة غسالة 250 واط',                  'PUMP', 85.00,  150.00, 130.00, 3,  'SUP-001'),
    ('SP-003', '6901234567003', 'AC Capacitor 35uF',              'مكثف تكييف 35 ميكروفاراد',            'ELEC', 35.00,  65.00,  55.00,  5,  'SUP-001'),
    ('SP-004', '6901234567004', 'Refrigerator Door Gasket',       'حلقة باب ثلاجة',                      'SEAL', 45.00,  85.00,  75.00,  4,  'SUP-002'),
    ('SP-005', '6901234567005', 'Dishwasher Spray Arm',           'ذراع رش غسالة أطباق',                 'MECH', 55.00,  100.00, 90.00,  2,  'SUP-002'),
    ('SP-006', '6901234567006', 'Dryer Heating Element 1800W',    'عنصر تسخين مجفف 1800 واط',            'HEAT', 120.00, 220.00, 190.00, 3,  'SUP-001'),
    ('SP-007', '6901234567007', 'Microwave Magnetron 900W',       'مغناطرون ميكروويف 900 واط',           'ELEC', 200.00, 380.00, 340.00, 2,  'SUP-003'),
    ('SP-008', '6901234567008', 'Fridge Compressor 1/3 HP',       'ضاغط ثلاجة 3/1 حصان',                'COOL', 450.00, 800.00, 720.00, 2,  'SUP-003'),
    ('SP-009', '6901234567009', 'Washing Machine Belt',           'حزام غسالة',                          'MECH', 15.00,  30.00,  25.00,  10, 'SUP-002'),
    ('SP-010', '6901234567010', 'Oven Thermostat 300C',           'ترموستات فرن 300 درجة',               'CTRL', 65.00,  120.00, 105.00, 4,  'SUP-001'),
    ('SP-011', '6901234567011', 'AC Fan Motor 1/5 HP',            'موتور مروحة تكييف 5/1 حصان',          'PUMP', 180.00, 320.00, 290.00, 3,  'SUP-003'),
    ('SP-012', '6901234567012', 'Water Inlet Valve 220V',         'صمام دخول ماء 220 فولت',              'MECH', 40.00,  75.00,  65.00,  5,  'SUP-001'),
    ('SP-013', '6901234567013', 'Drain Pump Filter',              'فلتر مضخة تصريف',                     'FILT', 20.00,  40.00,  35.00,  8,  'SUP-002'),
    ('SP-014', '6901234567014', 'PCB Control Board - WM',         'لوحة تحكم الغسالة',                   'CTRL', 350.00, 650.00, 580.00, 2,  'SUP-003'),
    ('SP-015', '6901234567015', 'Refrigerator Thermostat',        'ترموستات ثلاجة',                      'CTRL', 55.00,  100.00, 90.00,  4,  'SUP-001'),
    ('SP-016', '6901234567016', 'AC Filter Coarse Mesh',          'فلتر هواء تكييف خشن',                 'FILT', 12.00,  25.00,  20.00,  15, 'SUP-002'),
    ('SP-017', '6901234567017', 'Drum Bearing 6205-2Z',           'بلية درام غسالة 6205',                'MECH', 18.00,  35.00,  30.00,  10, 'SUP-002'),
    ('SP-018', '6901234567018', 'Carbon Brush Set (2pcs)',        'طقم فراشي كربون (2 قطعة)',            'ELEC', 22.00,  45.00,  38.00,  8,  'SUP-001'),
    ('SP-019', '6901234567019', 'Door Latch Assembly',            'مجموعة قفل باب غسالة',                'MECH', 35.00,  68.00,  58.00,  5,  'SUP-002'),
    ('SP-020', '6901234567020', 'Temperature Sensor NTC',         'مستشعر حرارة NTC',                    'ELEC', 28.00,  55.00,  48.00,  6,  'SUP-003')
) AS p(internal_code, barcode, name, name_ar, cat_code, purchase_price, selling_price, min_selling_price, min_stock_alert, sup_code)
JOIN categories c ON c.code = p.cat_code
JOIN suppliers  s ON s.code = p.sup_code
ON CONFLICT (internal_code) DO UPDATE
    SET name             = EXCLUDED.name,
        name_ar          = EXCLUDED.name_ar,
        purchase_price   = EXCLUDED.purchase_price,
        selling_price    = EXCLUDED.selling_price,
        min_selling_price= EXCLUDED.min_selling_price,
        supplier_id      = EXCLUDED.supplier_id,
        min_stock_alert  = EXCLUDED.min_stock_alert,
        updated_at       = NOW();

-- ============================================================
-- SEED: INVENTORY (both branches)
-- ============================================================

-- Main Store inventory
INSERT INTO inventory (product_id, branch_id, quantity, location)
SELECT
    p.id,
    b.id,
    v.qty,
    'A-' || LPAD(ROW_NUMBER() OVER (ORDER BY p.internal_code)::text, 2, '0') || '-01'
FROM (VALUES
    ('SP-001', 15), ('SP-002', 4),  ('SP-003', 8),  ('SP-004', 3),
    ('SP-005', 12), ('SP-006', 5),  ('SP-007', 2),  ('SP-008', 4),
    ('SP-009', 20), ('SP-010', 7),  ('SP-011', 3),  ('SP-012', 10),
    ('SP-013', 18), ('SP-014', 2),  ('SP-015', 9),  ('SP-016', 25),
    ('SP-017', 14), ('SP-018', 16), ('SP-019', 8),  ('SP-020', 11)
) AS v(code, qty)
JOIN products p ON p.internal_code = v.code
JOIN branches b ON b.code = 'MAIN'
ON CONFLICT (product_id, branch_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        location   = EXCLUDED.location,
        updated_at = NOW();

-- Warehouse inventory
INSERT INTO inventory (product_id, branch_id, quantity, location)
SELECT
    p.id,
    b.id,
    v.qty,
    'W-' || LPAD(ROW_NUMBER() OVER (ORDER BY p.internal_code)::text, 2, '0') || '-01'
FROM (VALUES
    ('SP-001', 50), ('SP-002', 15), ('SP-003', 30), ('SP-004', 10),
    ('SP-005', 25), ('SP-006', 20), ('SP-007', 8),  ('SP-008', 12),
    ('SP-009', 100),('SP-010', 18), ('SP-011', 15), ('SP-012', 35),
    ('SP-013', 60), ('SP-014', 6),  ('SP-015', 22), ('SP-016', 80),
    ('SP-017', 40), ('SP-018', 45), ('SP-019', 20), ('SP-020', 30)
) AS v(code, qty)
JOIN products p ON p.internal_code = v.code
JOIN branches b ON b.code = 'WH01'
ON CONFLICT (product_id, branch_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        location   = EXCLUDED.location,
        updated_at = NOW();

