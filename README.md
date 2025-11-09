# DOKUMENTASI API - DONATION PLATFORM

### Base URL: http://localhost:3000

## API Endpoints

### 🔐 AUTHENTICATION

#### 1. Register Fundraiser

**Endpoint:** `POST /auth/register`

**Description:** Mendaftarkan fundraiser baru

**Request Body:**
```json
{
  "user_name": "Oeratmangun",
  "email": "john@gmail.com",
  "password": "securepassword123"
}
```

**Response Success (201):**
```json
{
  "message": "Fundraiser registered successfully",
  "data": {
    "id": 1,
    "user_name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response Error (400):**
```json
{
  "error": "Email sudah terdaftar"
}
```

---

#### 2. Login Fundraiser

**Endpoint:** `POST /auth/login`

**Description:** Login untuk fundraiser

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response Success (200):**
```json
{
  "ok": true,
  "message": "Login Berhasil",
  "data": {
    "user": {
      "user_id": 1,
      "user_name": "John Doe",
      "email": "john@example.com",
      "role": "FUNDRAISER",
      "verified_at": null,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Error (401):**
```json
{
  "ok": false,
  "error": "Email atau password salah"
}
```

---

#### 3. Login Admin

**Endpoint:** `POST /auth/login/admin`

**Description:** Login khusus untuk admin

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminpassword123"
}
```

**Response Success (200):**
```json
{
  "ok": true,
  "message": "Login Admin Berhasil",
  "data": {
    "user": {
      "user_id": 10,
      "user_name": "Admin",
      "email": "admin@example.com",
      "role": "ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Error (403):**
```json
{
  "ok": false,
  "error": "Akun tidak memiliki izin admin"
}
```

---

#### 4. Google OAuth Login

**Endpoint:** `GET /auth/google`

**Description:** Redirect ke Google OAuth untuk login

**Response:** Redirect ke halaman Google consent

---

#### 5. Google OAuth Callback

**Endpoint:** `GET /auth/google/callback`

**Description:** Callback setelah Google OAuth berhasil

**Response Success (200):**
```json
{
  "ok": true,
  "message": "Google OAuth login successful",
  "data": {
    "user": {
      "user_id": 5,
      "user_name": "John Doe",
      "email": "john@gmail.com",
      "role": "FUNDRAISER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 📋 PROJECTS (PUBLIC)

#### 6. Get All Active Projects

**Endpoint:** `GET /project/public`

**Description:** Mendapatkan semua proyek aktif (tanpa autentikasi)

**Query Parameters:**
- `limit` (optional, default: 20) - Jumlah data per halaman
- `offset` (optional, default: 0) - Offset untuk pagination

**Example:**
```
GET /project/public?limit=10&offset=0
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "project_id": 1,
      "project_name": "Bantu Korban Banjir Jakarta",
      "project_desc": "Galang dana untuk membantu korban banjir",
      "target_amount": 50000000.00,
      "collected_amount": 25000000.00,
      "project_status": "ACTIVE",
      "created_at": "2024-01-01T00:00:00.000Z",
      "fundraiser_id": 3,
      "fundraiser_name": "John Doe",
      "fundraiser_email": "john@example.com",
      "progress_percentage": 50.00,
      "is_target_met": 0
    }
  ],
  "count": 1
}
```

---

#### 7. Get Project Detail

**Endpoint:** `GET /project/public/:projectId`

**Description:** Mendapatkan detail proyek tertentu

**Example:**
```
GET /project/public/1
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "project_id": 1,
    "project_name": "Bantu Korban Banjir Jakarta",
    "project_desc": "Galang dana untuk membantu korban banjir",
    "target_amount": 50000000.00,
    "collected_amount": 25000000.00,
    "project_status": "ACTIVE",
    "created_at": "2024-01-01T00:00:00.000Z",
    "fundraiser_id": 3,
    "fundraiser_name": "John Doe",
    "fundraiser_email": "john@example.com",
    "fundraiser_verified_at": "2024-01-15T00:00:00.000Z",
    "progress_percentage": 50.00,
    "is_target_met": 0,
    "available_payout": 25000000.00,
    "total_donors": 150,
    "total_payouts": 0,
    "total_paid_out": 0.00
  }
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "Project tidak ditemukan"
}
```

---

### 🔒 PROJECTS (PROTECTED)

**⚠️ Semua endpoint di bawah memerlukan authentication**

**Header Required:**
```
Authorization: Bearer <your_jwt_token>
```

---

#### 8. Create Project

**Endpoint:** `POST /project/create`

**Description:** Membuat proyek baru (status: PENDING, menunggu approval admin)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Bantu Pendidikan Anak Pedalaman",
  "description": "Galang dana untuk pendidikan anak-anak di daerah pedalaman",
  "target_amount": 100000000
}
```

**Response Success (201):**
```json
{
  "ok": true,
  "message": "Project created successfully (menunggu persetujuan)",
  "data": {
    "project_id": 5,
    "title": "Bantu Pendidikan Anak Pedalaman",
    "target_amount": 100000000.00,
    "status": "PENDING"
  }
}
```

**Response Error (400):**
```json
{
  "ok": false,
  "message": "Title dan target amount wajib diisi"
}
```

**Response Error (401):**
```json
{
  "ok": false,
  "message": "Akses ditolak. Token tidak ditemukan."
}
```

---

#### 9. Get My Projects

**Endpoint:** `GET /project/all`

**Description:** Mendapatkan semua proyek milik user yang sedang login

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Example:**
```
GET /project/all?limit=5&offset=0
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "project_id": 5,
      "project_name": "Bantu Pendidikan Anak Pedalaman",
      "project_desc": "Galang dana untuk pendidikan",
      "target_amount": 100000000.00,
      "collected_amount": 0.00,
      "project_status": "PENDING",
      "created_at": "2024-01-20T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

#### 10. Update Project

**Endpoint:** `PUT /project/:projectId/update`

**Description:** Memperbarui detail proyek (hanya pemilik proyek yang bisa update)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "projectName": "Bantu Pendidikan Anak (Updated)",
  "projectDesc": "Deskripsi yang telah diperbarui",
  "targetAmount": 150000000
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Project berhasil diperbarui.",
  "data": {
    "affected_rows": 1
  }
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "Project tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya."
}
```

---

#### 11. Delete Project

**Endpoint:** `DELETE /project/:projectId/delete`

**Description:** Menutup/menghapus proyek (soft delete - status menjadi CLOSED)

**Headers:**
```
Authorization: Bearer <token>
```

**Example:**
```
DELETE /project/5/delete
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Project berhasil dihapus."
}
```

**Response Error (403):**
```json
{
  "success": false,
  "message": "Anda tidak memiliki izin untuk menghapus project ini."
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "Project tidak ditemukan atau sudah ditutup."
}
```

---

### 💰 DONATIONS

#### 12. Create Donation (Get Payment Token)

**Endpoint:** `POST /donation/create`

**Description:** Membuat donasi dan mendapatkan token pembayaran dari Midtrans

**Request Body:**
```json
{
  "project_id": 1,
  "donatorName": "Jane Doe",
  "donatorEmail": "jane@example.com",
  "amount": 500000
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Token pembayaran berhasil dibuat",
  "data": {
    "orderId": "DON-1-1234567890",
    "token": "abc123xyz789",
    "redirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/abc123xyz789"
  }
}
```

**Usage Flow:**
1. Client memanggil endpoint ini untuk membuat donasi
2. Server membuat record di database dengan status PENDING
3. Server request payment token ke Midtrans
4. Client menerima `redirectUrl`
5. Redirect user ke URL Midtrans untuk menyelesaikan pembayaran
6. Setelah pembayaran selesai, Midtrans akan memanggil webhook
7. Status donasi di-update menjadi COMPLETED atau FAILED

**Response Error (400):**
```json
{
  "success": false,
  "message": "Amount harus lebih besar dari 0"
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "Proyek tidak ditemukan"
}
```

---

#### 13. Get All Public Donations

**Endpoint:** `GET /donation/public`

**Description:** Mendapatkan semua donasi yang telah completed

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "donation_id": 10,
      "project_id": 1,
      "donator_name": "Jane Doe",
      "donation_amount": 500000.00,
      "paid_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:00:00.000Z",
      "project_name": "Bantu Korban Banjir Jakarta"
    }
  ]
}
```

---

#### 14. Get Donations by Project

**Endpoint:** `GET /donation/public/:projectId`

**Description:** Mendapatkan donasi untuk proyek tertentu

**Example:**
```
GET /donation/public/1
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "donation_id": 10,
      "project_id": 1,
      "donator_name": "Jane Doe",
      "donation_amount": 500000.00,
      "paid_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:00:00.000Z",
      "project_name": "Bantu Korban Banjir Jakarta"
    }
  ]
}
```

---

#### 15. Check Donation Status

**Endpoint:** `GET /donation/status/:orderId`

**Description:** Mengecek status donasi berdasarkan order ID

**Example:**
```
GET /donation/status/DON-1-1234567890
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "donation_id": 10,
    "project_id": 1,
    "donator_name": "Jane Doe",
    "donator_email": "jane@example.com",
    "donation_amount": 500000.00,
    "payment_status": "COMPLETED",
    "external_id": "DON-1-1234567890",
    "payment_gateway": "MIDTRANS",
    "paid_at": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-15T10:00:00.000Z",
    "project_name": "Bantu Korban Banjir Jakarta",
    "project_status": "ACTIVE"
  }
}
```

**Payment Status Values:**
- `PENDING` - Menunggu pembayaran
- `COMPLETED` - Pembayaran berhasil
- `FAILED` - Pembayaran gagal
- `EXPIRED` - Pembayaran expired

**Response Error (404):**
```json
{
  "success": false,
  "message": "Donasi tidak ditemukan"
}
```

---

#### 16. Midtrans Webhook

**Endpoint:** `POST /donation/webhook`

**Description:** Endpoint untuk menerima notifikasi pembayaran dari Midtrans

**⚠️ Note:** Endpoint ini dipanggil otomatis oleh Midtrans, bukan oleh client!

**Request Body (dari Midtrans):**
```json
{
  "transaction_status": "settlement",
  "order_id": "DON-1-1234567890",
  "fraud_status": "accept",
  "gross_amount": "500000.00",
  "transaction_id": "xxxx-xxxx-xxxx",
  "payment_type": "bank_transfer"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Webhook Configuration:**
Set di Midtrans Dashboard → Settings → Configuration → Payment Notification URL:
```
https://yourdomain.com/donation/webhook
```

---

### 👨‍💼 ADMIN ENDPOINTS

**⚠️ Semua endpoint admin memerlukan:**
- JWT Token dengan role ADMIN
- Header: `Authorization: Bearer <admin_token>`

---

#### 17. Get Pending Verifications

**Endpoint:** `GET /admin/verifications/pending`

**Description:** Mendapatkan daftar verifikasi dokumen fundraiser yang pending

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Example:**
```
GET /admin/verifications/pending?limit=10&offset=0
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "verification_id": 3,
      "user_id": 5,
      "user_name": "John Doe",
      "email": "john@example.com",
      "doc_path": "/uploads/ktp-12345.jpg",
      "notes": null,
      "status": "PENDING",
      "created_at": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

---

#### 18. Verify Document

**Endpoint:** `POST /admin/verifications/:verificationId/verify`

**Description:** Menyetujui atau menolak dokumen verifikasi fundraiser

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "APPROVED",
  "notes": "Dokumen lengkap dan valid"
}
```

**Status Values:**
- `APPROVED` - Dokumen disetujui
- `REJECTED` - Dokumen ditolak

**Example:**
```
POST /admin/verifications/3/verify
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Dokumen berhasil diapproved",
  "data": {
    "affected_rows": 1
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "message": "Status harus berupa APPROVED atau REJECTED"
}
```

---

#### 19. Get Pending Projects

**Endpoint:** `GET /admin/projects/pending`

**Description:** Mendapatkan daftar proyek yang menunggu approval admin

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "project_id": 5,
      "project_name": "Bantu Pendidikan Anak Pedalaman",
      "project_desc": "Galang dana untuk pendidikan",
      "target_amount": 100000000.00,
      "project_status": "PENDING",
      "user_id": 3,
      "user_name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-20T00:00:00.000Z"
    }
  ]
}
```

---

#### 20. Close Project

**Endpoint:** `POST /admin/projects/:projectId/close`

**Description:** Menutup proyek (mengubah status menjadi CLOSED)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Example:**
```
POST /admin/projects/5/close
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Project berhasil ditutup.",
  "data": {
    "affected_rows": 1
  }
}
```

**Response Error (404):**
```json
{
  "success": false,
  "message": "Project tidak ditemukan atau sudah ditutup."
}
```

---

#### 21. Approve Payout

**Endpoint:** `POST /admin/payouts/:payoutId/approve`

**Description:** Menyetujui permintaan payout dari fundraiser

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Example:**
```
POST /admin/payouts/7/approve
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Payout berhasil disetujui.",
  "data": {
    "affected_rows": 1
  }
}
```

---

#### 22. Reject Payout

**Endpoint:** `POST /admin/payouts/:payoutId/reject`

**Description:** Menolak permintaan payout

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Payout berhasil ditolak.",
  "data": {
    "affected_rows": 1
  }
}
```

---

#### 23. Mark Payout Transferred

**Endpoint:** `POST /admin/payouts/:payoutId/transfer`

**Description:** Menandai payout sebagai sudah ditransfer ke fundraiser

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Payout berhasil ditandai sebagai selesai.",
  "data": {
    "affected_rows": 1
  }
}
```

---

#### 24. Recalculate Collected Amount

**Endpoint:** `POST /admin/recalculate-collected`

**Description:** Menghitung ulang total donasi (collected_amount) untuk semua proyek

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Rekalkulasi total donasi berhasil.",
  "data": {
    "projects_updated": 25
  }
}
```

**Use Case:**
- Memperbaiki inkonsistensi data
- Sinkronisasi ulang setelah migration
- Debugging issues dengan total donasi

---

### 🏥 HEALTH & INFO

#### 25. Health Check

**Endpoint:** `GET /health`

**Description:** Mengecek status server

**Response Success (200):**
```json
{
  "status": "OK",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

---

#### 26. API Info

**Endpoint:** `GET /`

**Description:** Informasi dasar API

**Response Success (200):**
```json
{
  "message": "API is working",
  "subject": "Donations API"
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "message": "Deskripsi error"
}
```

atau

```json
{
  "ok": false,
  "error": "Deskripsi error"
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request berhasil |
| 201 | Created | Resource berhasil dibuat |
| 400 | Bad Request | Validasi gagal, data tidak lengkap |
| 401 | Unauthorized | Token tidak valid/tidak ada |
| 403 | Forbidden | Tidak memiliki izin akses |
| 404 | Not Found | Resource tidak ditemukan |
| 500 | Internal Server Error | Error pada server |

### Common Error Messages

#### Authentication Errors

```json
{
  "ok": false,
  "message": "Akses ditolak. Token tidak ditemukan."
}
```

```json
{
  "ok": false,
  "message": "Token tidak valid atau sudah kadaluarsa."
}
```

```json
{
  "ok": false,
  "message": "Akses ditolak. Hanya admin yang dapat mengakses sumber daya ini."
}
```

#### Validation Errors

```json
{
  "ok": false,
  "message": "Title dan target amount wajib diisi"
}
```

```json
{
  "success": false,
  "message": "Amount harus lebih besar dari 0"
}
```

#### Not Found Errors

```json
{
  "success": false,
  "message": "Project tidak ditemukan"
}
```

```json
{
  "success": false,
  "message": "Donasi tidak ditemukan"
}
```

---

## Testing

### Using cURL

#### 1. Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Test User",
    "email": "test@example.com",
    "password": "test123"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

#### 3. Get Projects (Public)
```bash
curl http://localhost:3000/project/public
```

#### 4. Create Project (Protected)
```bash
curl -X POST http://localhost:3000/project/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Test Project",
    "description": "Test Description",
    "target_amount": 1000000
  }'
```

#### 5. Create Donation
```bash
curl -X POST http://localhost:3000/donation/create \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "donatorName": "Donor Name",
    "donatorEmail": "donor@example.com",
    "amount": 50000
  }'
```

### Using Postman/Thunder Client

1. **Import Collection:**
   - Create new collection
   - Add all endpoints dari dokumentasi

2. **Set Environment Variables:**
   ```
   base_url: http://localhost:3000
   token: <akan diisi setelah login>
   admin_token: <akan diisi setelah login admin>
   ```

3. **Test Flow:**
   - Register → Login → Create Project
   - Login Admin → Approve Verification → Approve Project
   - Create Donation → Check Status

---

## 📊 Database Schema

### Users Table
```sql
users (
  id INT PRIMARY KEY,
  user_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  user_pass VARCHAR(255),
  role ENUM('FUNDRAISER', 'ADMIN'),
  verified_at DATETIME,
  created_at DATETIME
)
```

### Projects Table
```sql
projects (
  id INT PRIMARY KEY,
  user_id INT,
  project_name VARCHAR(255),
  project_desc TEXT,
  target_amount DECIMAL(19,2),
  collected_amount DECIMAL(19,2),
  project_status ENUM('PENDING', 'ACTIVE', 'CLOSED', 'COMPLETED'),
  created_at DATETIME,
  updated_at DATETIME
)
```

### Donations Table
```sql
donations (
  id INT PRIMARY KEY,
  project_id INT,
  donator_name VARCHAR(255),
  donator_email VARCHAR(255),
  donation_amount DECIMAL(19,2),
  payment_status ENUM('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'),
  external_id VARCHAR(255),
  payment_gateway VARCHAR(50),
  paid_at DATETIME,
  created_at DATETIME
)
```

---

## 🔒 Security Best Practices

1. **JWT Token:**
   - Expires in 1 hour
   - Store in httpOnly cookie (recommended) atau localStorage
   - Always send via `Authorization: Bearer <token>` header

2. **Password:**
   - Minimum 6 characters
   - Hashed dengan bcrypt (10 rounds)
   - Tidak pernah di-return di response

3. **CORS:**
   - Configured untuk specific origins
   - Credentials allowed

4. **Helmet:**
   - Security headers enabled
   - XSS protection
   - Content security policy

5. **Rate Limiting:**
   - Implement rate limiting untuk production
   - Prevent brute force attacks

---