-- ============================================================
-- ERP/POS System - Standalone Seed Data
-- PostgreSQL 16
-- Run AFTER scripts/init.sql against the same database.
-- Safe to re-run: every INSERT uses ON CONFLICT DO NOTHING/UPDATE.
--
-- Encoding: pure ASCII source file. All non-ASCII (Arabic) text
-- is written using PostgreSQL Unicode escape string syntax
-- (U&'...') so this file cannot be corrupted by being saved in
-- a non-UTF8 encoding (e.g. Windows-1252 / ANSI) by any editor.
-- ============================================================

SET client_encoding = 'UTF8';

-- ============================================================
-- SUPPLIERS (3)
-- ============================================================

INSERT INTO suppliers (code, name, name_ar, contact, phone, email, is_active)
VALUES
    ('SUP-001', 'Al-Nile Electronics', U&'\0627\0644\0646\064a\0644 \0644\0644\0625\0644\0643\062a\0631\0648\0646\064a\0627\062a', 'Ahmed Hassan', '+20-2-12345678', 'supplier@alnile.com',  TRUE),
    ('SUP-002', 'Cairo Spare Parts',   U&'\0627\0644\0642\0627\0647\0631\0629 \0644\0642\0637\0639 \0627\0644\063a\064a\0627\0631', 'Mohamed Ali',  '+20-2-87654321', 'info@cairospares.com', TRUE),
    ('SUP-003', 'Delta Tech Supplies', U&'\062f\0644\062a\0627 \062a\0643 \0644\0644\0645\0633\062a\0644\0632\0645\0627\062a', 'Sara Ibrahim', '+20-2-11223344', 'delta@deltatech.com',  TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- PRODUCTS (20 spare parts)
-- ============================================================

INSERT INTO products (
    internal_code, barcode, name, name_ar,
    category_id, purchase_price, selling_price, min_selling_price,
    tax_rate, supplier_id, min_stock_alert, is_active
)
SELECT
    p.internal_code, p.barcode, p.name, p.name_ar,
    c.id AS category_id,
    p.purchase_price, p.selling_price, p.min_selling_price,
    0 AS tax_rate,
    s.id AS supplier_id,
    p.min_stock_alert, TRUE
FROM (VALUES
    ('SP-001', '6901234567001', 'Motor Start Capacitor 25uF',  U&'\0645\0643\062b\0641 \062a\0634\063a\064a\0644 \0645\0648\062a\0648\0631 25 \0645\064a\0643\0631\0648\0641\0627\0631\0627\062f', 'ELEC', 25.50,  45.00,  40.00,  5,  'SUP-001'),
    ('SP-002', '6901234567002', 'Washing Machine Pump 250W',   U&'\0645\0636\062e\0629 \063a\0633\0627\0644\0629 250 \0648\0627\0637', 'PUMP', 85.00,  150.00, 130.00, 3,  'SUP-001'),
    ('SP-003', '6901234567003', 'AC Capacitor 35uF',           U&'\0645\0643\062b\0641 \062a\0643\064a\064a\0641 35 \0645\064a\0643\0631\0648\0641\0627\0631\0627\062f', 'ELEC', 35.00,  65.00,  55.00,  5,  'SUP-001'),
    ('SP-004', '6901234567004', 'Refrigerator Door Gasket',    U&'\062d\0644\0642\0629 \0628\0627\0628 \062b\0644\0627\062c\0629', 'SEAL', 45.00,  85.00,  75.00,  4,  'SUP-002'),
    ('SP-005', '6901234567005', 'Dishwasher Spray Arm',        U&'\0630\0631\0627\0639 \0631\0634 \063a\0633\0627\0644\0629 \0623\0637\0628\0627\0642', 'MECH', 55.00,  100.00, 90.00,  2,  'SUP-002'),
    ('SP-006', '6901234567006', 'Dryer Heating Element 1800W', U&'\0639\0646\0635\0631 \062a\0633\062e\064a\0646 \0645\062c\0641\0641 1800 \0648\0627\0637', 'HEAT', 120.00, 220.00, 190.00, 3,  'SUP-001'),
    ('SP-007', '6901234567007', 'Microwave Magnetron 900W',    U&'\0645\063a\0646\0627\0637\0631\0648\0646 \0645\064a\0643\0631\0648\0648\064a\0641 900 \0648\0627\0637', 'ELEC', 200.00, 380.00, 340.00, 2,  'SUP-003'),
    ('SP-008', '6901234567008', 'Fridge Compressor 1/3 HP',    U&'\0636\0627\063a\0637 \062b\0644\0627\062c\0629 1/3 \062d\0635\0627\0646', 'COOL', 450.00, 800.00, 720.00, 2,  'SUP-003'),
    ('SP-009', '6901234567009', 'Washing Machine Belt',        U&'\062d\0632\0627\0645 \063a\0633\0627\0644\0629', 'MECH', 15.00,  30.00,  25.00,  10, 'SUP-002'),
    ('SP-010', '6901234567010', 'Oven Thermostat 300C',        U&'\062a\0631\0645\0648\0633\062a\0627\062a \0641\0631\0646 300 \062f\0631\062c\0629', 'CTRL', 65.00,  120.00, 105.00, 4,  'SUP-001'),
    ('SP-011', '6901234567011', 'AC Fan Motor 1/5 HP',         U&'\0645\0648\062a\0648\0631 \0645\0631\0648\062d\0629 \062a\0643\064a\064a\0641 1/5 \062d\0635\0627\0646', 'PUMP', 180.00, 320.00, 290.00, 3,  'SUP-003'),
    ('SP-012', '6901234567012', 'Water Inlet Valve 220V',      U&'\0635\0645\0627\0645 \062f\062e\0648\0644 \0645\0627\0621 220 \0641\0648\0644\062a', 'MECH', 40.00,  75.00,  65.00,  5,  'SUP-001'),
    ('SP-013', '6901234567013', 'Drain Pump Filter',           U&'\0641\0644\062a\0631 \0645\0636\062e\0629 \062a\0635\0631\064a\0641', 'FILT', 20.00,  40.00,  35.00,  8,  'SUP-002'),
    ('SP-014', '6901234567014', 'PCB Control Board - WM',      U&'\0644\0648\062d\0629 \062a\062d\0643\0645 \0627\0644\063a\0633\0627\0644\0629', 'CTRL', 350.00, 650.00, 580.00, 2,  'SUP-003'),
    ('SP-015', '6901234567015', 'Refrigerator Thermostat',     U&'\062a\0631\0645\0648\0633\062a\0627\062a \062b\0644\0627\062c\0629', 'CTRL', 55.00,  100.00, 90.00,  4,  'SUP-001'),
    ('SP-016', '6901234567016', 'AC Filter Coarse Mesh',       U&'\0641\0644\062a\0631 \0647\0648\0627\0621 \062a\0643\064a\064a\0641 \062e\0634\0646', 'FILT', 12.00,  25.00,  20.00,  15, 'SUP-002'),
    ('SP-017', '6901234567017', 'Drum Bearing 6205-2Z',        U&'\0628\0644\064a\0629 \062f\0631\0627\0645 \063a\0633\0627\0644\0629 6205', 'MECH', 18.00,  35.00,  30.00,  10, 'SUP-002'),
    ('SP-018', '6901234567018', 'Carbon Brush Set (2pcs)',     U&'\0637\0642\0645 \0641\0631\0627\0634\064a \0643\0631\0628\0648\0646 (2 \0642\0637\0639\0629)', 'ELEC', 22.00,  45.00,  38.00,  8,  'SUP-001'),
    ('SP-019', '6901234567019', 'Door Latch Assembly',         U&'\0645\062c\0645\0648\0639\0629 \0642\0641\0644 \0628\0627\0628 \063a\0633\0627\0644\0629', 'MECH', 35.00,  68.00,  58.00,  5,  'SUP-002'),
    ('SP-020', '6901234567020', 'Temperature Sensor NTC',      U&'\0645\0633\062a\0634\0639\0631 \062d\0631\0627\0631\0629 NTC', 'ELEC', 28.00,  55.00,  48.00,  6,  'SUP-003')
) AS p(internal_code, barcode, name, name_ar, cat_code, purchase_price, selling_price, min_selling_price, min_stock_alert, sup_code)
JOIN categories c ON c.code = p.cat_code
JOIN suppliers  s ON s.code = p.sup_code
ON CONFLICT (internal_code) DO UPDATE
    SET name              = EXCLUDED.name,
        name_ar           = EXCLUDED.name_ar,
        purchase_price    = EXCLUDED.purchase_price,
        selling_price     = EXCLUDED.selling_price,
        min_selling_price = EXCLUDED.min_selling_price,
        supplier_id       = EXCLUDED.supplier_id,
        min_stock_alert   = EXCLUDED.min_stock_alert,
        updated_at        = NOW();

-- ============================================================
-- INVENTORY: MAIN store (20 rows)
-- ============================================================

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

-- ============================================================
-- INVENTORY: WH01 warehouse (20 rows)
-- ============================================================

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
