# ERP/POS System — Home Appliances Spare Parts
## نظام إدارة متجر قطع غيار الأجهزة المنزلية

A full production-grade ERP/POS system built with **NestJS + Next.js + PostgreSQL**.

---

## 🗂 Project Structure

```
erp-pos/
├── backend/              # NestJS API server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # JWT auth, RBAC
│   │   │   ├── products/     # Products CRUD, barcode, Excel import
│   │   │   ├── inventory/    # Stock, movements, adjustments
│   │   │   ├── sales/        # POS, invoices, refunds
│   │   │   ├── transfers/    # Inter-branch transfers
│   │   │   ├── purchases/    # Purchase orders
│   │   │   ├── reports/      # Sales, profit, dashboard
│   │   │   ├── notifications/# Real-time via WebSocket
│   │   │   └── sync/         # Store ↔ Warehouse sync
│   │   ├── common/           # Guards, decorators, interceptors
│   │   └── database/         # Prisma service
│   └── prisma/
│       └── schema.prisma     # Full DB schema
│
├── frontend/             # Next.js 14 app
│   └── src/
│       ├── app/
│       │   ├── page.tsx       # Dashboard
│       │   ├── login/         # Login page
│       │   ├── pos/           # POS screen (barcode + cart)
│       │   ├── products/      # Product management
│       │   ├── inventory/     # Stock levels + movements
│       │   └── reports/       # Charts and analytics
│       ├── components/
│       │   ├── layout/        # Sidebar, Header, AppLayout
│       │   └── ui/            # Toaster, reusable UI
│       ├── store/             # Zustand: auth + cart
│       └── lib/               # Axios API client, utils
│
├── scripts/
│   ├── init.sql          # DB schema + seed data
│   ├── backup.sh         # Automated backup
│   └── restore.sh        # DB restore
│
├── docker-compose.yml    # Full stack orchestration
└── .env.example          # Environment template
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)

### 1. Clone and configure
```bash
git clone <repo>
cd erp-pos
cp .env.example .env
# Edit .env — change all passwords and secrets!
```

### 2. Generate JWT secrets
```bash
openssl rand -base64 64   # for JWT_SECRET
openssl rand -base64 64   # for JWT_REFRESH_SECRET
```

### 3. Start everything
```bash
docker compose up -d
```

### 4. Access
| Service   | URL                              |
|-----------|----------------------------------|
| Frontend  | http://localhost:3000            |
| Backend   | http://localhost:3001/api        |
| Swagger   | http://localhost:3001/api/docs   |

### Default login
- Username: `admin`
- Password: `Admin@1234`

---

## 🔧 Local Development

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push        # applies schema to DB
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🏗 Architecture

### Backend (NestJS)
- **Clean Architecture** — modules, services, repositories separated
- **JWT + Refresh Token** rotation
- **RBAC** — Admin / Branch Manager / Cashier / Warehouse
- **WebSocket** (Socket.IO) for real-time notifications
- **Prisma ORM** with PostgreSQL
- **Rate limiting** via `@nestjs/throttler`
- **Swagger** auto-documentation

### Frontend (Next.js 14)
- **App Router** with layouts
- **React Query** for server state
- **Zustand** for local state (auth, cart)
- **Recharts** for dashboards
- **Arabic RTL + English** bilingual UI
- **Tailwind CSS** with dark mode

### Database (PostgreSQL 16)
- Full relational schema with foreign keys & constraints
- `pg_trgm` extension for fast text search
- Inventory movements audit trail
- Automatic `updated_at` triggers

---

## 🔑 API Reference

Full Swagger docs at `/api/docs`. Key endpoints:

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | /api/v1/auth/login                | Login                    |
| POST   | /api/v1/auth/refresh              | Refresh token            |
| GET    | /api/v1/products                  | List products            |
| GET    | /api/v1/products/barcode/:code    | Instant barcode lookup   |
| POST   | /api/v1/products/import/excel     | Bulk import from Excel   |
| GET    | /api/v1/products/export/excel     | Export to Excel          |
| POST   | /api/v1/sales                     | Create sale (POS)        |
| POST   | /api/v1/sales/:id/refund          | Process refund           |
| GET    | /api/v1/inventory                 | Stock levels             |
| POST   | /api/v1/inventory/adjust          | Manual adjustment        |
| GET    | /api/v1/reports/dashboard         | Dashboard KPIs           |
| GET    | /api/v1/reports/sales             | Sales report             |
| GET    | /api/v1/reports/profit            | Profit report            |
| GET    | /api/v1/reports/sales/export      | Export report to Excel   |

---

## ⌨️ POS Keyboard Shortcuts

| Key     | Action                     |
|---------|----------------------------|
| `F2`    | Focus product search       |
| `F10`   | Open checkout              |
| `ESC`   | Clear search               |
| USB scanner | Auto-detect barcode   |

---

## 🔐 Roles & Permissions

| Feature              | Admin | Branch Mgr | Cashier | Warehouse |
|----------------------|-------|------------|---------|-----------|
| Full system access   | ✅    |            |         |           |
| Create/edit products | ✅    | ✅         |         |           |
| Process sales        | ✅    | ✅         | ✅      |           |
| Process refunds      | ✅    | ✅         | ✅      |           |
| Stock adjustments    | ✅    | ✅         |         | ✅        |
| Approve transfers    | ✅    | ✅         |         |           |
| View reports         | ✅    | ✅         |         |           |
| User management      | ✅    |            |         |           |

---

## 📦 Excel Import Format

Column order for product import:
1. Internal Code *(required)*
2. Barcode
3. Name *(required)*
4. Name Arabic
5. Category Code
6. Purchase Price
7. Selling Price
8. Min Stock Alert

Download the export template to use as import reference.

---

## 🔄 Backup

```bash
# Manual backup
./scripts/backup.sh ./backups

# Restore from backup
./scripts/restore.sh ./backups/erp_backup_20240101_120000.sql.gz

# Automated daily backup (add to crontab)
0 2 * * * /path/to/erp-pos/scripts/backup.sh /var/backups/erp >> /var/log/erp-backup.log 2>&1
```

---

## 🌍 Multi-Branch Expansion

The system is designed for multi-branch from day one:
- Every sale, inventory record, and transfer is scoped to a `branch_id`
- Branch managers only see their branch data
- Admin sees all branches
- Stock transfers flow from any branch to any branch
- Real-time sync via WebSocket rooms per branch

To add a new branch:
```sql
INSERT INTO branches (code, name, name_ar) VALUES ('BR02', 'Branch 2', 'الفرع الثاني');
```

---

## 📋 Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | NestJS 10, Node.js 20               |
| ORM         | Prisma 5                            |
| Database    | PostgreSQL 16                       |
| Cache       | Redis 7                             |
| Realtime    | Socket.IO 4                         |
| Auth        | JWT + Refresh Tokens (bcrypt)       |
| Frontend    | Next.js 14 (App Router)             |
| State       | Zustand + React Query               |
| UI          | Tailwind CSS, Radix UI              |
| Charts      | Recharts                            |
| Excel       | ExcelJS                             |
| Deployment  | Docker + Docker Compose             |
