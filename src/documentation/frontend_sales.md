# Frontend Sales API

Dokumentasi ini disiapkan untuk frontend Vue.js yang akan terhubung ke modul `grt_sales_business_category`.

Fokus dokumen ini:

- login authentication via JSON-RPC
- penggunaan session Odoo dari frontend
- endpoint master data sales
- endpoint customer QR
- create draft Sales Order multi-item
- create draft Sales Order per jenis transaksi
- create draft Sales Order non-ongkir
- informasi accounting customer
- histori Sales Order customer

## Ringkasan Endpoint

| Endpoint | Method | Auth | Tujuan |
|---|---|---|---|
| `/api/sales/authenticate` | `POST` | public | login dan membuat session Odoo |
| `/api/sales/products` | `POST` | user | list product dan price |
| `/api/sales/payment-terms` | `POST` | user | list Payment Terms |
| `/api/sales/customer-qr-by-id` | `POST` | user | ambil `customer_qr_ref` dari `customer_id` |
| `/api/sales/customer-qr-payload-by-id` | `POST` | user | ambil payload QR siap render dari `customer_id` |
| `/api/sales/customer-qr-payload-by-ref` | `POST` | user | ambil payload QR siap render dari `customer_qr_ref` |
| `/api/sales/customer-detail-by-qr` | `POST` | user | detail customer langsung dari `customer_qr_ref` |
| `/api/sales/customer-accounting-summary-by-qr` | `POST` | user | summary aging hutang/piutang dari `customer_qr_ref` |
| `/api/sales/orders-by-qr` | `POST` | user | histori Sales Order customer dari `customer_qr_ref` |
| `/api/sales/susu-olahan/customers` | `POST` | user | list customer global untuk frontend SUSU OLAHAN |
| `/api/sales/susu-olahan/customer-search` | `POST` | user | autocomplete customer global untuk UI HP/typeahead |
| `/api/sales/susu-olahan/products` | `POST` | user | list produk saleable kategori SUSU OLAHAN (wajib customer, harga ikut pricelist customer) |
| `/api/sales/susu-olahan/shipping-products` | `POST` | user | list produk ongkos kirim SUSU OLAHAN untuk dropdown |
| `/api/sales/susu-olahan/draft-order` | `POST` | user | create draft Sales Order SUSU OLAHAN dengan auto ongkir |
| `/api/sales/draft-order` | `POST` | user | create draft Sales Order multi-item |
| `/api/sales/minimarket/grid-products` | `POST` | user | list produk untuk UI grid/sheet quantity minimarket (wajib customer, harga ikut pricelist customer) |
| `/api/sales/minimarket/draft-order` | `POST` | user | create draft Sales Order dari quantity grid minimarket |
| `/api/sales/draft-order/bon-kering` | `POST` | user | create draft Sales Order bon kering |
| `/api/sales/draft-order/bon-partus` | `POST` | user | create draft Sales Order bon partus |
| `/api/sales/draft-order/bon-reguler` | `POST` | user | create draft Sales Order bon reguler |
| `/api/sales/draft-order/non-ongkir` | `POST` | user | create draft Sales Order non-ongkir tanpa auto ongkir |

## Base URL

Contoh base URL Odoo:

```text
https://your-odoo-host
```

Semua endpoint di bawah menggunakan base URL tersebut.

## Authentication Model

Frontend menggunakan session authentication bawaan Odoo.

Flow:

1. frontend memanggil endpoint login
2. Odoo mengembalikan `session_id`
3. browser atau client menyimpan cookie session
4. request berikutnya ke endpoint yang butuh login menggunakan session yang sama

Catatan:

- endpoint login bersifat `auth="public"`
- endpoint data sales berikutnya memakai `auth="user"`
- jika frontend berjalan beda domain, CORS dan cookie policy perlu disiapkan di server
- untuk aplikasi Vue.js, semua request session-based sebaiknya selalu memakai `credentials: "include"`
- untuk endpoint list product minimarket/susu olahan, frontend harus memilih customer terlebih dahulu sebelum memanggil endpoint

## JSON-RPC Request Format

Frontend dapat mengirim payload JSON-RPC sederhana dengan pola:

```json
{
  "params": {
    "key": "value"
  }
}
```

Controller saat ini juga menerima payload langsung tanpa wrapper `params`, tetapi disarankan tetap memakai `params` agar konsisten.

## Endpoint Login

### `POST /api/sales/authenticate`

Endpoint untuk login dari frontend Vue.js dan membuat session Odoo.

#### Request body

```json
{
  "params": {
    "login": "user@example.com",
    "password": "secret",
    "db": "database_name"
  }
}
```

#### Success response

```json
{
  "status": "success",
  "message": "Authentication successful",
  "data": {
    "uid": 12,
    "session_id": "2d2c7d9f....",
    "db": "database_name",
    "login": "user@example.com",
    "name": "Demo User",
    "partner_id": 45,
    "company_id": 1,
    "company_name": "PT Example"
  }
}
```

#### Error response

```json
{
  "status": "error",
  "message": "Invalid credentials"
}
```

## Customer QR Reference

Field `customer_qr_ref` tersedia di model `res.partner`.

Tujuan field ini:

- menjadi identifier unik customer untuk keperluan QR
- dipakai frontend untuk lookup customer
- bisa diminta dari backend berdasarkan `customer_id`
- bisa diambil dalam bentuk payload siap render untuk QR frontend
- bukan pengganti `partner_id`

Contoh format:

```text
CUSTQR2603-000001
```

Catatan implementasi:

- customer baru akan otomatis mendapat `customer_qr_ref`
- customer lama akan terisi saat module install atau upgrade
- referensi ini unik di database
- jika frontend sudah menyimpan `customer_qr_ref`, frontend tidak perlu lagi menampilkan atau mengirim `customer_id` untuk flow lookup customer
- flow yang sudah bisa langsung memakai `customer_qr_ref` adalah detail customer, summary accounting customer, dan histori order customer
- endpoint yang masih membutuhkan `customer_id` hanya endpoint pembangkit QR awal berbasis id: `customer-qr-by-id` dan `customer-qr-payload-by-id`
- frontend juga bisa membentuk ulang payload QR langsung dari reference melalui `customer-qr-payload-by-ref`

## Endpoint Master Data

### Setup Business Category `SUSU OLAHAN`

Untuk frontend minimarket susu olahan, buat master `Business Category` dengan nama resmi:

```text
SUSU OLAHAN
```

Endpoint khusus susu olahan melakukan lookup secara case-insensitive, sehingga nama `susu olahan` juga terbaca. Namun untuk menjaga master data rapi, gunakan satu nama resmi saja: `SUSU OLAHAN`.

Langkah ringkas:

1. Masuk ke Sales Odoo.
2. Buka menu `Business Categories`.
3. Buat category baru dengan `Name = SUSU OLAHAN`.
4. Isi `Code`, misalnya `SUSU_OLAHAN`.
5. Pilih `Company`.
6. Isi `Analytic Account` jika transaksi kategori ini perlu analytic khusus.
7. Aktifkan `Gunakan Ongkos Kirim di Sales Order` jika order minimarket tetap memakai auto ongkir.
8. Beri akses user Sales melalui `Allowed Business Categories` atau Team Sales yang memakai category `SUSU OLAHAN`.
9. Set produk susu kemasan ke Business Category `SUSU OLAHAN`. Field ini tersedia dari modul `grt_inventory_business_category`.
10. Buat kategori produk `All / Saleable / Ongkos Kirim`.
11. Set produk ongkos kirim ke kategori tersebut dan Business Category `SUSU OLAHAN`.
12. Buka `Sales > Frontend Shipping Rules`.
13. Untuk setiap wilayah customer, buat rule dan pilih `Produk Ongkir Wilayah` dari produk ongkos kirim SUSU OLAHAN.
14. Isi `Tarif per Unit`.
15. Customer pada list susu olahan diambil dari master customer global; Business Category tetap dipakai sebagai konteks produk/order, bukan filter master customer.

### `POST /api/sales/products`

Mengambil list produk untuk kebutuhan form Sales Order.

#### Request body

```json
{
  "params": {
    "search": "",
    "limit": 50,
    "offset": 0
  }
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "product_id": 101,
        "default_code": "PRD-001",
        "name": "Produk A",
        "list_price": 12000.0,
        "uom_id": 1,
        "uom_name": "Unit",
        "currency_id": 13,
        "currency_name": "IDR"
      }
    ],
    "count": 1
  }
}
```

### `POST /api/sales/minimarket/grid-products`

Mengambil produk dalam format grid entry untuk UI Sales minimarket. Endpoint ini mengembalikan `columns` dan `items`, dengan field `quantity` sebagai input utama frontend Vue.
Untuk flow minimarket di modul ini, backend otomatis membatasi produk ke Business Category `SUSU OLAHAN`.
Endpoint ini wajib menerima customer (`customer_id`/`partner_id` atau `customer_qr_ref`) karena harga produk mengikuti pricelist customer terpilih.

Dokumentasi lengkap flow minimarket ada di `minimarket_sales_order_entry_ui.md`.

Contoh request:

```json
{
  "params": {
    "customer_id": 45,
    "search": "susu",
    "category_ids": [],
    "quantities": {
      "101": 24
    },
    "limit": 100,
    "offset": 0
  }
}
```

Contoh response ringkas:

```json
{
  "status": "success",
  "data": {
    "customer_id": 45,
    "pricelist_name": "Pricelist Minimarket",
    "items": [
      {
        "product_id": 101,
        "default_code": "SUSU-UHT-200",
        "barcode": "899000000001",
        "name": "Susu UHT 200ml",
        "category_name": "Susu Kemasan",
        "list_price": 4300.0,
        "uom_name": "Pcs",
        "quantity": 24.0
      }
    ],
    "count": 1
  }
}
```

### `POST /api/sales/payment-terms`

Mengambil daftar Payment Terms.

#### Response

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "payment_term_id": 1,
        "name": "Cash"
      },
      {
        "payment_term_id": 2,
        "name": "30 Days"
      }
    ]
  }
}
```

## Panduan Frontend Jika Memakai `customer_qr_ref`

Jika sisi frontend sudah menyimpan `customer_qr_ref`, maka frontend bisa memakai reference tersebut sebagai identifier customer untuk flow setelah QR terbentuk atau setelah customer pernah dipilih sebelumnya.

Frontend bisa langsung memakai `customer_qr_ref` untuk endpoint berikut:

- `POST /api/sales/customer-detail-by-qr`
- `POST /api/sales/customer-accounting-summary-by-qr`
- `POST /api/sales/orders-by-qr`
- `POST /api/sales/customer-qr-payload-by-ref`

Contoh request umum:

```json
{
  "params": {
    "customer_qr_ref": "CUSTQR2603-000001"
  }
}
```

Catatan integrasi:

- jika frontend hanya perlu lookup ulang customer yang sudah punya QR reference, gunakan `customer_qr_ref`
- jika frontend ingin membuat atau membentuk ulang payload QR, frontend bisa memakai `customer_id` atau `customer_qr_ref` sesuai data yang tersedia
- `customer_qr_ref` sudah cukup untuk flow scan, detail customer, summary accounting, histori order, dan pembentukan ulang payload QR

## Endpoint SUSU OLAHAN

### `POST /api/sales/susu-olahan/products`

Mengambil produk `Can be Sold` dengan Business Category `SUSU OLAHAN`.
Endpoint ini wajib menerima customer (`customer_id`/`partner_id` atau `customer_qr_ref`) agar `list_price` sesuai pricelist customer.

Request:

```json
{
  "params": {
    "customer_id": 45,
    "search": "uht",
    "limit": 100,
    "offset": 0
  }
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "business_category_id": 2,
    "business_category_name": "SUSU OLAHAN",
    "customer_id": 45,
    "pricelist_name": "Pricelist Minimarket",
    "items": [
      {
        "product_id": 101,
        "default_code": "SUSU-UHT-200",
        "barcode": "899000000001",
        "name": "Susu UHT 200ml",
        "category_name": "Susu Kemasan",
        "list_price": 4300.0,
        "uom_name": "Pcs",
        "quantity": 0.0,
        "business_category_id": 2,
        "business_category_name": "SUSU OLAHAN"
      }
    ],
    "count": 1
  }
}
```

Catatan:

- endpoint ini membutuhkan field `product.product.business_category_id`
- field tersebut tersedia jika modul `grt_inventory_business_category` sudah aktif/upgrade
- jika field belum tersedia, endpoint akan mengembalikan error yang menjelaskan modul yang perlu diaktifkan

### `POST /api/sales/susu-olahan/shipping-products`

Mengambil produk ongkos kirim untuk dropdown frontend. Filter default:

- kategori produk `All / Saleable / Ongkos Kirim`
- Business Category produk `SUSU OLAHAN`
- produk aktif dan `Can be Sold`

Gunakan endpoint ini untuk dropdown `Produk Ongkir Wilayah` pada UI setup rule ongkir frontend. Produk yang dipilih tetap disimpan pada model `sale.frontend.shipping.rule`.

Request:

```json
{
  "params": {
    "search": "ongkir",
    "limit": 100,
    "offset": 0
  }
}
```

Path kategori juga bisa dikirim eksplisit:

```json
{
  "params": {
    "category_path": "all/saleable/ongkoskirim"
  }
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "business_category_id": 2,
    "business_category_name": "SUSU OLAHAN",
    "category_id": 12,
    "category_name": "All / Saleable / Ongkos Kirim",
    "items": [
      {
        "product_id": 2001,
        "default_code": "ONGKIR-SO",
        "name": "Ongkos Kirim Susu Olahan",
        "category_name": "All / Saleable / Ongkos Kirim",
        "list_price": 0.0,
        "uom_name": "Unit",
        "business_category_id": 2,
        "business_category_name": "SUSU OLAHAN"
      }
    ],
    "count": 1
  }
}
```

### `POST /api/sales/susu-olahan/customers`

Mengambil master customer global untuk frontend `SUSU OLAHAN`.

Request:

```json
{
  "params": {
    "search": "minimarket",
    "limit": 50,
    "offset": 0
  }
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "business_category_id": 2,
    "business_category_name": "SUSU OLAHAN",
    "items": [
      {
        "partner_id": 45,
        "customer_id": 45,
        "name": "Minimarket Cabang A",
        "ref": "MM-A",
        "customer_qr_ref": "CUSTQR2603-000001",
        "shipping_wilayah_id": 15,
        "shipping_wilayah_name": "Kecamatan A",
        "payment_term_id": 4,
        "payment_term_name": "14 Days",
        "customer_segment_name": "Repeat",
        "last_sale_date": "2026-04-20",
        "sales_frequency": 8,
        "total_sales_amount": 12500000.0
      }
    ],
    "count": 1
  }
}
```

Customer di endpoint ini tidak difilter berdasarkan Business Category. Field behavior/analysis kategori `SUSU OLAHAN` hanya dipakai untuk mengisi ringkasan segment dan histori bila datanya tersedia.

### `POST /api/sales/susu-olahan/customer-search`

Autocomplete customer ringan untuk UI HP. Endpoint ini kompatibel dengan input `q`, `term`, `query`, atau `search`, sehingga bisa dipakai oleh typeahead/Select2 tanpa mengambil semua customer.

Alias endpoint:

- `POST /api/sales/susu-olahan/customers/search`

Request:

```json
{
  "params": {
    "q": "alfa",
    "limit": 20,
    "min_chars": 1
  }
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 45,
        "text": "Alfamart Cabang A [ALFA-A] CUSTQR2603-000001",
        "partner_id": 45,
        "customer_id": 45,
        "name": "Alfamart Cabang A",
        "ref": "ALFA-A",
        "customer_qr_ref": "CUSTQR2603-000001"
      }
    ],
    "results": [
      {
        "id": 45,
        "text": "Alfamart Cabang A [ALFA-A] CUSTQR2603-000001"
      }
    ],
    "count": 1,
    "has_more": false
  }
}
```

## Endpoint Customer

### `POST /api/sales/customer-qr-by-id`

Mengambil `customer_qr_ref` dari `customer_id` untuk kebutuhan generate QR di frontend.

#### Request body

```json
{
  "params": {
    "customer_id": 45
  }
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "customer_id": 45,
    "name": "PT Customer A",
    "customer_qr_ref": "CUSTQR2603-000001"
  }
}
```

### `POST /api/sales/customer-qr-payload-by-id`

Mengambil payload QR siap render dari `customer_id`.

Endpoint ini cocok jika frontend ingin langsung membuat QR tanpa menyusun data sendiri.

#### Request body

```json
{
  "params": {
    "customer_id": 45,
    "format": "ref"
  }
}
```

#### Field request

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `customer_id` | integer | ya | id customer / partner |
| `format` | string | tidak | `ref` atau `json`; default `ref` |

#### Response format `ref`

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "customer_id": 45,
    "name": "PT Customer A",
    "customer_qr_ref": "CUSTQR2603-000001",
    "format": "ref",
    "qr_content": "CUSTQR2603-000001",
    "qr_payload": {
      "customer_id": 45,
      "customer_qr_ref": "CUSTQR2603-000001",
      "customer_name": "PT Customer A"
    }
  }
}
```

#### Response format `json`

Request:

```json
{
  "params": {
    "customer_id": 45,
    "format": "json"
  }
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "customer_id": 45,
    "name": "PT Customer A",
    "customer_qr_ref": "CUSTQR2603-000001",
    "format": "json",
    "qr_content": "{\"customer_id\":45,\"customer_qr_ref\":\"CUSTQR2603-000001\",\"customer_name\":\"PT Customer A\"}",
    "qr_payload": {
      "customer_id": 45,
      "customer_qr_ref": "CUSTQR2603-000001",
      "customer_name": "PT Customer A"
    }
  }
}
```

Catatan:

- `qr_content` adalah isi yang langsung di-encode ke QR
- `format="ref"` cocok jika backend lookup nanti cukup pakai `customer_qr_ref`
- `format="json"` cocok jika frontend atau scanner ingin membaca metadata customer langsung dari isi QR
- `qr_payload` tetap selalu dikembalikan sebagai object referensi


### `POST /api/sales/customer-qr-payload-by-ref`

Mengambil payload QR siap render dari `customer_qr_ref`.

Endpoint ini cocok jika frontend sudah menyimpan reference customer dan ingin membentuk ulang payload QR tanpa membutuhkan `customer_id`.

#### Request body

```json
{
  "params": {
    "customer_qr_ref": "CUSTQR2603-000001",
    "format": "ref"
  }
}
```

#### Field request

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `customer_qr_ref` | string | ya | reference QR customer |
| `format` | string | tidak | `ref` atau `json`; default `ref` |

#### Response format `ref`

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "customer_id": 45,
    "name": "PT Customer A",
    "customer_qr_ref": "CUSTQR2603-000001",
    "format": "ref",
    "qr_content": "CUSTQR2603-000001",
    "qr_payload": {
      "customer_id": 45,
      "customer_qr_ref": "CUSTQR2603-000001",
      "customer_name": "PT Customer A"
    }
  }
}
```

#### Response format `json`

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "customer_id": 45,
    "name": "PT Customer A",
    "customer_qr_ref": "CUSTQR2603-000001",
    "format": "json",
    "qr_content": "{\"customer_id\":45,\"customer_qr_ref\":\"CUSTQR2603-000001\",\"customer_name\":\"PT Customer A\"}",
    "qr_payload": {
      "customer_id": 45,
      "customer_qr_ref": "CUSTQR2603-000001",
      "customer_name": "PT Customer A"
    }
  }
}
```
### `POST /api/sales/customer-detail-by-qr`

Mengambil detail customer berdasarkan `customer_qr_ref`.

#### Request body

```json
{
  "params": {
    "customer_qr_ref": "CUSTQR2603-000001"
  }
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "name": "PT Customer A",
    "customer_qr_ref": "CUSTQR2603-000001",
    "street": "Jl. Contoh",
    "street2": null,
    "city": "Jakarta",
    "phone": "08123456789",
    "mobile": "08123456789",
    "email": "customer@example.com",
    "shipping_wilayah_id": 15,
    "shipping_wilayah_name": "Kecamatan A",
    "payment_term_id": 2,
    "payment_term_name": "30 Days"
  }
}
```

### `POST /api/sales/customer-accounting-summary-by-qr`

Mengambil nilai dan aging hutang/piutang customer berdasarkan `customer_qr_ref`.

#### Request body

```json
{
  "params": {
    "customer_qr_ref": "CUSTQR2603-000001"
  }
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "partner_id": 45,
    "customer_qr_ref": "CUSTQR2603-000001",
    "receivable_total": 15000000.0,
    "payable_total": 0.0,
    "currency": "IDR",
    "aging_receivable": {
      "current": 5000000.0,
      "1_10": 2000000.0,
      "11_30": 2000000.0,
      "31_60": 3000000.0,
      "61_90": 2000000.0,
      "over_90": 1000000.0
    },
    "aging_payable": {
      "current": 0.0,
      "1_10": 0.0,
      "11_30": 0.0,
      "31_60": 0.0,
      "61_90": 0.0,
      "over_90": 0.0
    }
  }
}
```

Keterangan bucket aging:

- `current` = belum jatuh tempo
- `1_10` = telat `1-10` hari
- `11_30` = telat `11-30` hari
- `31_60` = telat `31-60` hari
- `61_90` = telat `61-90` hari
- `over_90` = telat lebih dari `90` hari

Catatan untuk frontend:

- key JSON tetap memakai underscore agar stabil dan mudah diproses program
- label tampilan di UI frontend sebaiknya ditampilkan sebagai `Current`, `1-10`, `11-30`, `31-60`, `61-90`, `>90`

## Konfigurasi Rule Ongkir Frontend

Sebelum frontend membuat Sales Order yang memakai auto ongkir, backend harus menyiapkan rule ongkir terlebih dahulu.

Setup dilakukan di menu:

- `Sales > Frontend Shipping Rules`

Setiap rule minimal berisi:

- `Wilayah` pada level `wilayah.kecamatan`
- `Produk Ongkir Wilayah`
- `Tarif per Unit`

Untuk flow `SUSU OLAHAN`, pilihan `Produk Ongkir Wilayah` sebaiknya diambil dari:

- `POST /api/sales/susu-olahan/shipping-products`

Dengan begitu produk ongkos kirim yang tampil di frontend sudah dibatasi ke kategori produk `All / Saleable / Ongkos Kirim` dan Business Category produk `SUSU OLAHAN`.

Perilaku backend:

- backend menambahkan ongkir otomatis hanya untuk endpoint frontend yang memakai skema auto ongkir
- backend mengambil `Wilayah Ongkir` dari customer
- backend mencari rule berdasarkan kombinasi `wilayah_id + company`
- jika rule ditemukan, backend menambahkan 1 line produk ongkir otomatis
- backend menghitung total unit dari semua line produk non-ongkir: `sum(qty)`
- nominal ongkir dihitung dengan rumus `total_unit x tarif_per_unit`
- line ongkir otomatis menyimpan ringkasan total unit dan tarif per unit pada deskripsi line
- jika rule tidak ditemukan, pembuatan Sales Order akan ditolak
- jika total unit produk `0`, pembuatan Sales Order akan ditolak

Catatan untuk tim frontend:

- frontend tidak perlu mengirim `wilayah_id`
- backend membaca wilayah ongkir langsung dari customer
- customer harus sudah dilengkapi field `Wilayah Ongkir`
- endpoint `/api/sales/draft-order/non-ongkir` dikecualikan dari lookup dan perhitungan auto ongkir

## Monitoring Admin Sales

Pada halaman list view Sales Order, admin sales sekarang dapat memakai informasi customer berikut untuk validasi prioritas:

- `Wilayah Customer`
- `Referensi Customer`

Kegunaan operasional:

- gunakan `Group By Wilayah Customer` untuk melihat konsentrasi order per wilayah
- gunakan kolom `Referensi Customer` untuk sorting manual
- referensi customer di atas `4000` dipakai sebagai penanda pelanggan mitra, bukan perorangan

Field ini ditarik langsung dari data customer pada Sales Order, sehingga admin sales tidak perlu membuka form customer satu per satu saat melakukan validasi prioritas.

### `POST /api/sales/orders-by-qr`

Mengambil list Sales Order berdasarkan `customer_qr_ref`.

#### Request body

```json
{
  "params": {
    "customer_qr_ref": "CUSTQR2603-000001",
    "limit": 20,
    "offset": 0
  }
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "sale_order_id": 120,
        "name": "S000120",
        "date_order": "2026-03-14 09:30:00",
        "commitment_date": "2026-03-15 10:00:00",
        "amount_total": 3000000.0,
        "state": "sale",
        "approval_state": "approved"
      }
    ],
    "count": 1
  }
}
```

## Endpoint Create Draft Sales Order

### `POST /api/sales/draft-order`

Membuat draft Sales Order dari frontend dan mendukung multi-item.

Endpoint ini tidak mengisi default Terms and Conditions. Di backend, Terms and Conditions disimpan pada field `note` di `sale.order`. Jika frontend membutuhkan Terms and Conditions default berdasarkan jenis transaksi, gunakan salah satu endpoint khusus jenis transaksi di bagian berikutnya.

#### Request body

Minimal kirim `partner_id` atau `customer_qr_ref`.

```json
{
  "params": {
    "partner_id": 45,
    "customer_qr_ref": "CUSTQR2603-000001",
    "commitment_date": "2026-03-15 10:00:00",
    "payment_term_id": 4,
    "team_id": 3,
    "business_category_id": 2,
    "note": "Kirim pagi",
    "order_line": [
      {
        "product_id": 1001,
        "product_uom_qty": 25,
        "price_unit": 12000
      },
      {
        "product_id": 1002,
        "product_uom_qty": 10,
        "price_unit": 18000
      },
      {
        "product_id": 1003,
        "product_uom_qty": 5
      }
    ]
  }
}
```

#### Struktur `order_line`

| Field | Type | Required | Keterangan |
|---|---|---|---|
| `product_id` | integer | ya | id produk |
| `product_uom_qty` | float | ya | quantity |
| `price_unit` | float | tidak | harga manual; jika kosong pakai harga product/pricelist |
| `name` | string | tidak | deskripsi item |

#### Response

```json
{
  "status": "success",
  "message": "Draft sales order created",
  "data": {
    "sale_order_id": 120,
    "name": "S000120",
    "state": "draft",
    "amount_total": 620000.0,
    "line_count": 4,
    "terms_and_conditions": "Kirim pagi",
    "is_frontend_order": true,
    "skip_frontend_shipping": false,
    "wilayah_id": 15,
    "wilayah_name": "Kecamatan A",
    "shipping_product_id": 2001,
    "shipping_product_name": "Biaya Ongkir Kecamatan A",
    "shipping_price_per_kg": 1500.0
  }
}
```

#### Validasi

- `partner_id` atau `customer_qr_ref` wajib ada
- jika keduanya dikirim, nilainya harus saling cocok
- `payment_term_id` harus valid
- customer wajib punya `Wilayah Ongkir`
- `order_line` wajib minimal 1 item
- setiap line wajib punya `product_id` dan `product_uom_qty > 0`
- backend otomatis menambahkan line ongkir untuk order frontend berdasarkan rule wilayah customer
- backend menghitung nominal line ongkir dari `total unit produk x tarif per unit` pada rule
- jika rule ongkir frontend tidak ditemukan, pembuatan order akan ditolak

### `POST /api/sales/minimarket/draft-order`

Membuat draft Sales Order dari UI minimarket berbentuk grid/sheet. Frontend cukup mengirim quantity per produk, lalu backend mengubahnya menjadi `order_line`.

Endpoint ini cocok untuk Sales yang input permintaan susu kemasan waralaba minimarket karena tidak perlu memakai pola `add item` satu per satu seperti form Sales Order Odoo.

Contoh request dengan `grid_lines`:

```json
{
  "params": {
    "partner_id": 45,
    "commitment_date": "2026-04-30 10:00:00",
    "payment_term_id": 4,
    "team_id": 3,
    "business_category_id": 2,
    "sale_order_type": "reguler",
    "note": "PO minimarket cabang A",
    "grid_lines": [
      {"product_id": 101, "quantity": 24},
      {"product_id": 102, "quantity": 12},
      {"product_id": 103, "quantity": 0}
    ]
  }
}
```

Contoh request dengan object `quantities`, yang biasanya lebih natural untuk state Vue:

```json
{
  "params": {
    "partner_id": 45,
    "commitment_date": "2026-04-30 10:00:00",
    "payment_term_id": 4,
    "team_id": 3,
    "business_category_id": 2,
    "quantities": {
      "101": 24,
      "102": 12,
      "103": 0
    }
  }
}
```

Catatan:

- quantity `0` akan diabaikan
- jika `sale_order_type` kosong, backend memakai `reguler`
- default Terms and Conditions endpoint ini adalah `sales order minimarket`
- response sama dengan endpoint `/api/sales/draft-order`
- dokumentasi detail ada di `minimarket_sales_order_entry_ui.md`

### `POST /api/sales/susu-olahan/draft-order`

Membuat draft Sales Order khusus Business Category `SUSU OLAHAN`. Payload sama dengan endpoint minimarket, tetapi backend otomatis mengisi/menjaga `business_category_id = SUSU OLAHAN`.

Backend juga otomatis menambahkan line ongkir dari konfigurasi `Sales > Frontend Shipping Rules`: produk ongkir diambil dari `Produk Ongkir Wilayah`, lalu nominal dihitung dari `total quantity produk x Tarif per Unit`.

Contoh request:

```json
{
  "params": {
    "partner_id": 45,
    "commitment_date": "2026-04-30 10:00:00",
    "payment_term_id": 4,
    "team_id": 3,
    "sale_order_type": "reguler",
    "note": "PO susu olahan cabang A",
    "quantities": {
      "101": 24,
      "102": 12
    }
  }
}
```

Catatan:

- customer wajib punya `Wilayah Ongkir`
- wilayah customer wajib punya rule di `sale.frontend.shipping.rule`
- produk ongkir rule wajib `Can be Sold`
- semua produk order wajib punya Business Category `SUSU OLAHAN`
- tipe `peralatan` tidak diterima di endpoint ini karena behavior-nya memang non-ongkir

### Endpoint Draft Order Berdasarkan Jenis Transaksi

Empat endpoint berikut memakai proses backend yang sama untuk membuat draft order frontend. Perbedaannya ada pada isi default Terms and Conditions dan apakah order tersebut memakai auto ongkir. Di backend, nilai keterangan ini ditulis ke field `note` pada `sale.order`.

| Endpoint | Isi default Terms and Conditions | Auto ongkir |
|---|---|---|
| `/api/sales/draft-order/bon-kering` | `sale order ini jenis bon kering` | ya |
| `/api/sales/draft-order/bon-partus` | `sale order ini jenis bon partus` | ya |
| `/api/sales/draft-order/bon-reguler` | `sale order ini jenis reguler` | ya |
| `/api/sales/draft-order/non-ongkir` | `sales order non ongkir` | tidak |

Jika frontend tetap mengirim `note`, backend akan menaruh teks default jenis transaksi di bagian atas lalu menambahkan isi `note` dari frontend di bawahnya. Response API mengembalikan hasil akhirnya pada field `terms_and_conditions`.

Panduan pemakaian:

- gunakan `/api/sales/draft-order/bon-kering` untuk Sales Order bon kering
- gunakan `/api/sales/draft-order/bon-partus` untuk Sales Order bon partus
- gunakan `/api/sales/draft-order/bon-reguler` untuk Sales Order reguler
- gunakan `/api/sales/draft-order/non-ongkir` untuk Sales Order `peralatan` yang tanpa ongkir dan tanpa fee sales commission
- gunakan `/api/sales/draft-order` hanya jika frontend ingin mengirim Terms and Conditions sendiri tanpa default jenis bon

#### Contoh request

```json
{
  "params": {
    "partner_id": 45,
    "customer_qr_ref": "CUSTQR2603-000001",
    "commitment_date": "2026-03-15 10:00:00",
    "payment_term_id": 4,
    "team_id": 3,
    "business_category_id": 2,
    "note": "Kirim pagi",
    "order_line": [
      {
        "product_id": 1001,
        "product_uom_qty": 25,
        "price_unit": 12000
      }
    ]
  }
}
```

#### Contoh response `POST /api/sales/draft-order/bon-kering`

```json
{
  "status": "success",
  "message": "Draft sales order created",
  "data": {
    "sale_order_id": 120,
    "name": "S000120",
    "state": "draft",
    "amount_total": 350000.0,
    "line_count": 2,
    "terms_and_conditions": "sale order ini jenis bon kering\n\nKirim pagi",
    "is_frontend_order": true,
    "skip_frontend_shipping": false,
    "wilayah_id": 15,
    "wilayah_name": "Kecamatan A",
    "shipping_product_id": 2001,
    "shipping_product_name": "Biaya Ongkir Kecamatan A",
    "shipping_price_per_kg": 1500.0
  }
}
```

### `POST /api/sales/draft-order/non-ongkir`

Endpoint ini dipakai untuk Sales Order frontend yang khusus menjual transaksi `peralatan`.

Perilaku khusus endpoint ini:

- backend tetap membuat order sebagai order frontend
- backend memberi default keterangan `sales order non ongkir`
- backend otomatis mengisi `sale_order_type = "peralatan"`
- backend tidak melakukan lookup rule ongkir
- backend tidak menambahkan line produk ongkir otomatis
- customer tidak wajib punya `Wilayah Ongkir` hanya untuk endpoint ini

#### Contoh response

```json
{
  "status": "success",
  "message": "Draft sales order created",
  "data": {
    "sale_order_id": 121,
    "name": "S000121",
    "state": "draft",
    "amount_total": 300000.0,
    "line_count": 1,
    "terms_and_conditions": "sales order non ongkir\n\nPembelian ambil sendiri",
    "is_frontend_order": true,
    "skip_frontend_shipping": true,
    "wilayah_id": false,
    "wilayah_name": false,
    "shipping_product_id": false,
    "shipping_product_name": false,
    "shipping_price_per_kg": false
  }
}
```

## Urutan Integrasi Frontend

Urutan implementasi yang disarankan di Vue:

1. login ke `/api/sales/authenticate`
2. ambil master data: `products`, `payment-terms`
3. jika frontend punya `customer_id`, panggil `customer-qr-payload-by-id` untuk membentuk payload QR
4. jika frontend sudah punya `customer_qr_ref`, panggil `customer-qr-payload-by-ref`
5. pilih `format="ref"` jika QR hanya menyimpan reference string
6. pilih `format="json"` jika QR ingin menyimpan metadata customer di dalam kontennya
7. jika QR discan dan backend lookup memakai ref, panggil `customer-detail-by-qr`
8. panggil `customer-accounting-summary-by-qr`
9. panggil `orders-by-qr`
10. untuk flow susu olahan, ambil produk dari `/api/sales/susu-olahan/products`
11. jika frontend menyediakan setup rule ongkir, ambil dropdown produk ongkir dari `/api/sales/susu-olahan/shipping-products`
12. user pilih banyak item
13. gunakan `/api/sales/susu-olahan/draft-order` untuk membuat order susu olahan dengan auto ongkir
14. gunakan `/api/sales/draft-order/bon-kering` untuk bon kering
15. gunakan `/api/sales/draft-order/bon-partus` untuk bon partus
16. gunakan `/api/sales/draft-order/bon-reguler` untuk reguler
17. gunakan `/api/sales/draft-order/non-ongkir` untuk transaksi `peralatan`
18. pastikan customer yang dipilih sudah memiliki `Wilayah Ongkir` jika memakai endpoint auto ongkir
19. gunakan `/api/sales/draft-order` jika frontend ingin mengirim Terms and Conditions sendiri tanpa default jenis bon

## Contoh Alur Request Lengkap

```javascript
await postJsonRpc(`${baseUrl}/api/sales/authenticate`, {
  login,
  password,
  db,
});

await postJsonRpc(`${baseUrl}/api/sales/products`, {
  search: "",
  limit: 50,
  offset: 0,
});

await postJsonRpc(`${baseUrl}/api/sales/payment-terms`, {});

await postJsonRpc(`${baseUrl}/api/sales/customer-qr-payload-by-id`, {
  customer_id: 45,
  format: "ref",
});


await postJsonRpc(`${baseUrl}/api/sales/customer-qr-payload-by-ref`, {
  customer_qr_ref,
  format: "ref",
});
await postJsonRpc(`${baseUrl}/api/sales/customer-detail-by-qr`, {
  customer_qr_ref,
});

await postJsonRpc(`${baseUrl}/api/sales/customer-accounting-summary-by-qr`, {
  customer_qr_ref,
});

await postJsonRpc(`${baseUrl}/api/sales/orders-by-qr`, {
  customer_qr_ref,
  limit: 20,
  offset: 0,
});

await postJsonRpc(`${baseUrl}/api/sales/susu-olahan/shipping-products`, {
  search: "ongkir",
  limit: 100,
  offset: 0,
});

await postJsonRpc(`${baseUrl}/api/sales/draft-order/bon-kering`, payload);
```

## Standard Response

### Success

```json
{
  "status": "success",
  "message": "optional message",
  "data": {}
}
```

### Error

```json
{
  "status": "error",
  "message": "error message"
}
```

## Contoh Service Vue.js

```javascript
export async function postJsonRpc(url, params) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ params }),
  });

  return response.json();
}

export async function getJsonSession(url) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.json();
}
```

## Catatan Frontend Vue

- simpan data login user di Pinia atau store sejenis
- semua endpoint selain login harus dipanggil setelah session terbentuk
- handle session expired dengan redirect ke halaman login
- untuk list product dan order history, siapkan pagination
- form order sebaiknya memakai dynamic rows agar multi-item nyaman dipakai
- tampilkan warning jika `receivable_total` atau aging customer tinggi
- pilih endpoint draft order sesuai jenis transaksi yang dipilih user di frontend
- frontend tidak perlu mengirim `wilayah_id` untuk create draft order
- backend akan lookup rule ongkir frontend berdasarkan wilayah customer untuk endpoint yang memakai auto ongkir
- backend menghitung total unit dari seluruh line produk non-ongkir menggunakan `product_uom_qty`
- jika rule cocok, backend otomatis menambah 1 line produk ongkir dengan nominal `total_unit x tarif_per_unit`
- endpoint `draft-order/non-ongkir` tidak melakukan lookup rule ongkir dan tidak menambah line ongkir
- semua produk yang dipakai untuk perhitungan ongkir tidak lagi membutuhkan field `weight`
- Terms and Conditions di backend disimpan pada field `note` di `sale.order`
- `customer-qr-by-id` cocok jika frontend hanya perlu string referensi QR
- `customer-qr-payload-by-id` cocok jika frontend ingin langsung render QR dan menyimpan metadata QR sekaligus dari `customer_id`
- `customer-qr-payload-by-ref` cocok jika frontend sudah menyimpan `customer_qr_ref` dan ingin membentuk ulang payload QR
- gunakan `format="ref"` jika flow scan tetap lookup ke backend dengan `customer_qr_ref`
- gunakan `format="json"` jika scanner/frontend perlu membaca detail dasar customer langsung dari isi QR
- endpoint `draft-order` tidak memberi Terms and Conditions default
- endpoint `draft-order/bon-kering`, `draft-order/bon-partus`, dan `draft-order/bon-reguler` akan mengisi Terms and Conditions default sesuai jenis bon
- endpoint `draft-order/non-ongkir` akan mengisi Terms and Conditions default `sales order non ongkir`
- jika frontend mengirim `note` ke endpoint jenis transaksi, backend akan menggabungkannya setelah teks default jenis transaksi

## Status Implementasi Saat Ini

Sudah tersedia:

- `POST /api/sales/authenticate`
- `POST /api/sales/products`
- `POST /api/sales/payment-terms`
- `POST /api/sales/customer-qr-by-id`
- `POST /api/sales/customer-qr-payload-by-id`
- `POST /api/sales/customer-qr-payload-by-ref`
- `POST /api/sales/customer-detail-by-qr`
- `POST /api/sales/customer-accounting-summary-by-qr`
- `POST /api/sales/orders-by-qr`
- `POST /api/sales/draft-order`
- `POST /api/sales/susu-olahan/products`
- `POST /api/sales/susu-olahan/customers`
- `POST /api/sales/susu-olahan/shipping-products`
- `POST /api/sales/susu-olahan/draft-order`
- endpoint list produk minimarket/susu olahan wajib customer (`customer_id`/`partner_id` atau `customer_qr_ref`)
- harga `list_price` di endpoint list produk minimarket/susu olahan mengikuti pricelist customer terpilih
- `POST /api/sales/draft-order/bon-kering`
- `POST /api/sales/draft-order/bon-partus`
- `POST /api/sales/draft-order/bon-reguler`
- `POST /api/sales/draft-order/non-ongkir`
- field `customer_qr_ref` di `res.partner`
- auto-generate `customer_qr_ref` untuk customer baru
- backfill `customer_qr_ref` untuk data existing saat install atau upgrade module

## Referensi File Backend

- endpoint sales: `grt_sales_business_category/controllers/main.py`
- customer QR ref: `grt_sales_business_category/models/res_partner.py`
- sales order model: `grt_sales_business_category/models/sale_order.py`
- accounting move model: `grt_sales_business_category/models/account_move.py`
- sequence QR ref: `grt_sales_business_category/data/res_partner_sequence.xml`

## Update API Sales Order Type (2026-04-23)

Mulai update ini, frontend dapat diminta mengirim `sale_order_type` saat membuat draft Sales Order.

Kapan wajib:

- wajib jika `business_category_id` atau `team_id` yang dipakai mengarah ke business category dengan setting `Gunakan Tipe Sales Order`
- tidak wajib untuk business category yang tidak mengaktifkan fitur tersebut

Nilai yang valid:

- `reguler`
- `kering`
- `partus`
- `peralatan`
- `silase`

Contoh request `POST /api/sales/draft-order`:

```json
{
  "params": {
    "partner_id": 45,
    "commitment_date": "2026-03-15 10:00:00",
    "payment_term_id": 4,
    "team_id": 3,
    "business_category_id": 2,
    "sale_order_type": "kering",
    "note": "Kirim pagi",
    "order_line": [
      {
        "product_id": 1001,
        "product_uom_qty": 25,
        "price_unit": 12000
      }
    ]
  }
}
```

Aturan untuk endpoint khusus:

- `/api/sales/draft-order/bon-kering` -> backend otomatis memaksa `sale_order_type = "kering"`
- `/api/sales/draft-order/bon-partus` -> backend otomatis memaksa `sale_order_type = "partus"`
- `/api/sales/draft-order/bon-reguler` -> backend otomatis memaksa `sale_order_type = "reguler"`
- `/api/sales/draft-order/non-ongkir` -> backend otomatis memaksa `sale_order_type = "peralatan"`

Tambahan response:

- `sale_order_type`
- `sale_order_type_label`

Contoh potongan response:

```json
{
  "status": "success",
  "message": "Draft sales order created",
  "data": {
    "sale_order_id": 120,
    "name": "S000120",
    "sale_order_type": "kering",
    "sale_order_type_label": "Kering"
  }
}
```

## Update Default Ongkir dan Commission per Type (2026-04-23)

Payload `sale_order_type` sekarang juga menentukan default ongkir dan fee sales commission.

Default per type:

- `reguler` -> ongkir aktif, sales commission aktif
- `kering` -> ongkir aktif, sales commission aktif
- `partus` -> ongkir aktif, sales commission aktif
- `peralatan` -> ongkir nonaktif, sales commission nonaktif
- `silase` -> ongkir aktif, sales commission nonaktif

Default commission method:

- jika commission aktif, method default adalah `weight`

Catatan endpoint:

- endpoint `/api/sales/draft-order` akan mengikuti default di atas berdasarkan `sale_order_type`
- endpoint `/api/sales/draft-order/bon-kering` akan memaksa `sale_order_type = "kering"`
- endpoint `/api/sales/draft-order/bon-partus` akan memaksa `sale_order_type = "partus"`
- endpoint `/api/sales/draft-order/bon-reguler` akan memaksa `sale_order_type = "reguler"`
- endpoint `/api/sales/draft-order/non-ongkir` dipakai untuk transaksi `peralatan`, sehingga tetap tanpa ongkir dan tanpa fee sales commission

Tambahan response draft order jika modul `grt_sales_commission` terpasang:

- `sales_commission_enabled`
- `sales_commission_method`
