-- ============================================================
-- seed.sql — Sample data for development & testing
-- Run AFTER init.sql on a fresh database:
--   psql -h HOST -U erp_user -d erp_pos -f scripts/seed.sql
--
-- Safe to re-run: all INSERTs use ON CONFLICT DO NOTHING/UPDATE
-- ============================================================

-- ── Suppliers ────────────────────────────────────────────────
INSERT INTO suppliers (code, name, name_ar, contact, phone, email, is_active)
VALUES
    ('SUP-001', 'Al-Nile Electronics',  'النيل للإلكترونيات',   'Ahmed Hassan', '+20-2-12345678', 'supplier@alnile.com',  TRUE),
    ('SUP-002', 'Cairo Spare Parts',    'القاهرة لقطع الغيار',  'Mohamed Ali',  '+20-2-87654321', 'info@cairospares.com', TRUE),
    ('SUP-003', 'Delta Tech Supplies',  'دلتا تك للمستلزمات',   'Sara Ibrahim', '+20-2-11223344', 'delta@deltatech.com',  TRUE)
ON CONFLICT (code) DO NOTHING;

-- ── Products (20 spare parts) ────────────────────────────────
INSERT INTO products (
    internal_code, barcode, name, name_ar,
    category_id, purchase_price, selling_price, min_selling_price,
    tax_rate, supplier_id, min_stock_alert, is_active
)
SELECT
    p.internal_code, p.barcode, p.name, p.name_ar,
    c.id, p.purchase_price, p.selling_price, p.min_selling_price,
    0, s.id, p.min_stock_alert, TRUE
FROM (VALUES
    ('SP-001','6901234567001','Motor Start Capacitor 25uF',  'مكثف تشغيل موتور 25 ميكروفاراد', 'ELEC',25.50, 45.00, 40.00,5, 'SUP-001'),
    ('SP-002','6901234567002','Washing Machine Pump 250W',   'مضخة غسالة 250 واط',              'PUMP',85.00,150.00,130.00,3, 'SUP-001'),
    ('SP-003','6901234567003','AC Capacitor 35uF',           'مكثف تكييف 35 ميكروفاراد',        'ELEC',35.00, 65.00, 55.00,5, 'SUP-001'),
    ('SP-004','6901234567004','Refrigerator Door Gasket',    'حلقة باب ثلاجة',                  'SEAL',45.00, 85.00, 75.00,4, 'SUP-002'),
    ('SP-005','6901234567005','Dishwasher Spray Arm',        'ذراع رش غسالة أطباق',             'MECH',55.00,100.00, 90.00,2, 'SUP-002'),
    ('SP-006','6901234567006','Dryer Heating Element 1800W', 'عنصر تسخين مجفف 1800 واط',        'HEAT',120.00,220.00,190.00,3,'SUP-001'),
    ('SP-007','6901234567007','Microwave Magnetron 900W',    'مغناطرون ميكروويف 900 واط',       'ELEC',200.00,380.00,340.00,2,'SUP-003'),
    ('SP-008','6901234567008','Fridge Compressor 1/3 HP',    'ضاغط ثلاجة 3/1 حصان',            'COOL',450.00,800.00,720.00,2,'SUP-003'),
    ('SP-009','6901234567009','Washing Machine Belt',        'حزام غسالة',                      'MECH',15.00, 30.00, 25.00,10,'SUP-002'),
    ('SP-010','6901234567010','Oven Thermostat 300C',        'ترموستات فرن 300 درجة',           'CTRL',65.00,120.00,105.00,4, 'SUP-001'),
    ('SP-011','6901234567011','AC Fan Motor 1/5 HP',         'موتور مروحة تكييف 5/1 حصان',     'PUMP',180.00,320.00,290.00,3,'SUP-003'),
    ('SP-012','6901234567012','Water Inlet Valve 220V',      'صمام دخول ماء 220 فولت',          'MECH',40.00, 75.00, 65.00,5, 'SUP-001'),
    ('SP-013','6901234567013','Drain Pump Filter',           'فلتر مضخة تصريف',                 'FILT',20.00, 40.00, 35.00,8, 'SUP-002'),
    ('SP-014','6901234567014','PCB Control Board - WM',      'لوحة تحكم الغسالة',               'CTRL',350.00,650.00,580.00,2,'SUP-003'),
    ('SP-015','6901234567015','Refrigerator Thermostat',     'ترموستات ثلاجة',                  'CTRL',55.00,100.00, 90.00,4, 'SUP-001'),
    ('SP-016','6901234567016','AC Filter Coarse Mesh',       'فلتر هواء تكييف خشن',             'FILT',12.00, 25.00, 20.00,15,'SUP-002'),
    ('SP-017','6901234567017','Drum Bearing 6205-2Z',        'بلية درام غسالة 6205',            'MECH',18.00, 35.00, 30.00,10,'SUP-002'),
    ('SP-018','6901234567018','Carbon Brush Set (2pcs)',     'طقم فراشي كربون (2 قطعة)',        'ELEC',22.00, 45.00, 38.00,8, 'SUP-001'),
    ('SP-019','6901234567019','Door Latch Assembly',         'مجموعة قفل باب غسالة',            'MECH',35.00, 68.00, 58.00,5, 'SUP-002'),
    ('SP-020','6901234567020','Temperature Sensor NTC',      'مستشعر حرارة NTC',                'ELEC',28.00, 55.00, 48.00,6, 'SUP-003')
) AS p(internal_code,barcode,name,name_ar,cat_code,purchase_price,selling_price,min_selling_price,min_stock_alert,sup_code)
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

-- ── Inventory (Main Store) ───────────────────────────────────
INSERT INTO inventory (product_id, branch_id, quantity, location)
SELECT p.id, b.id, v.qty,
    'A-' || LPAD(ROW_NUMBER() OVER (ORDER BY p.internal_code)::text, 2, '0') || '-01'
FROM (VALUES
    ('SP-001',15),('SP-002',4), ('SP-003',8), ('SP-004',3),
    ('SP-005',12),('SP-006',5), ('SP-007',2), ('SP-008',4),
    ('SP-009',20),('SP-010',7), ('SP-011',3), ('SP-012',10),
    ('SP-013',18),('SP-014',2), ('SP-015',9), ('SP-016',25),
    ('SP-017',14),('SP-018',16),('SP-019',8), ('SP-020',11)
) AS v(code, qty)
JOIN products p ON p.internal_code = v.code
JOIN branches b ON b.code = 'MAIN'
ON CONFLICT (product_id, branch_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

-- ── Inventory (Warehouse WH01) ───────────────────────────────
INSERT INTO inventory (product_id, branch_id, quantity, location)
SELECT p.id, b.id, v.qty,
    'W-' || LPAD(ROW_NUMBER() OVER (ORDER BY p.internal_code)::text, 2, '0') || '-01'
FROM (VALUES
    ('SP-001',50),('SP-002',15),('SP-003',30),('SP-004',10),
    ('SP-005',25),('SP-006',20),('SP-007',8), ('SP-008',12),
    ('SP-009',100),('SP-010',18),('SP-011',15),('SP-012',35),
    ('SP-013',60),('SP-014',6), ('SP-015',22),('SP-016',80),
    ('SP-017',40),('SP-018',45),('SP-019',20),('SP-020',30)
) AS v(code, qty)
JOIN products p ON p.internal_code = v.code
JOIN branches b ON b.code = 'WH01'
ON CONFLICT (product_id, branch_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

-- ── Summary ──────────────────────────────────────────────────
SELECT 'suppliers' as entity, COUNT(*) as count FROM suppliers
UNION ALL SELECT 'products',  COUNT(*) FROM products  WHERE is_active = true
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
ORDER BY entity;
