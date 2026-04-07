# Frontend Sales API

Dokumentasi ini disiapkan untuk frontend Vue.js yang akan terhubung ke modul `grt_sales_business_category`.

Fokus dokumen ini:

- login authentication via JSON-RPC
- penggunaan session Odoo dari frontend
- endpoint master data sales
- endpoint customer QR
- create draft Sales Order multi-item
- create draft Sales Order per jenis bon
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
| `/api/sales/draft-order` | `POST` | user | create draft Sales Order multi-item |
| `/api/sales/draft-order/bon-kering` | `POST` | user | create draft Sales Order bon kering |
| `/api/sales/draft-order/bon-partus` | `POST` | user | create draft Sales Order bon partus |
| `/api/sales/draft-order/bon-reguler` | `POST` | user | create draft Sales Order bon reguler |

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

## Konfigurasi Rule Ongkir Frontend

Sebelum frontend membuat Sales Order yang memakai auto biaya pengiriman, backend harus menyiapkan rule ongkir terlebih dahulu.

Setup dilakukan di menu:

- `Sales > Frontend Shipping Rules`

Setiap rule minimal berisi:

- `Wilayah` pada level `wilayah.kecamatan`
- `Produk Ongkir Wilayah`
- `Tarif per Kg`

Perilaku backend:

- backend hanya menambahkan ongkir otomatis untuk Sales Order yang dibuat dari endpoint frontend
- backend mengambil `Wilayah Ongkir` dari customer
- backend mencari rule berdasarkan kombinasi `wilayah_id + company`
- jika rule ditemukan, backend menambahkan 1 line produk ongkir otomatis
- backend menghitung total berat dari semua line produk: `qty x berat produk`
- nominal ongkir dihitung dengan rumus `total_kg x tarif_per_kg`
- line ongkir otomatis menyimpan ringkasan berat total dan tarif per kg pada deskripsi line
- jika rule tidak ditemukan, pembuatan Sales Order akan ditolak
- jika total berat produk `0`, pembuatan Sales Order akan ditolak

Catatan untuk tim frontend:

- frontend tidak perlu mengirim `wilayah_id`
- backend membaca wilayah ongkir langsung dari customer
- customer harus sudah dilengkapi field `Wilayah Ongkir`

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

Endpoint ini tidak mengisi default Terms and Conditions. Di backend, Terms and Conditions disimpan pada field `note` di `sale.order`. Jika frontend membutuhkan Terms and Conditions default berdasarkan jenis bon, gunakan salah satu endpoint khusus jenis bon di bagian berikutnya.

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
    "wilayah_id": 15,
    "wilayah_name": "Kecamatan A",
    "shipping_product_id": 2001,
    "shipping_product_name": "Biaya Angkutan Kecamatan A",
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
- backend otomatis menambahkan line biaya pengiriman untuk order frontend berdasarkan rule wilayah customer
- backend menghitung nominal line ongkir dari `total berat produk x tarif per kg` pada rule
- jika rule ongkir frontend tidak ditemukan, pembuatan order akan ditolak

### Endpoint Draft Order Berdasarkan Jenis Bon

Tiga endpoint berikut memakai proses backend yang sama. Perbedaannya hanya pada isi default Terms and Conditions. Di backend, nilai ini ditulis ke field `note` pada `sale.order`.

| Endpoint | Isi default Terms and Conditions |
|---|---|
| `/api/sales/draft-order/bon-kering` | `sale order ini jenis bon kering` |
| `/api/sales/draft-order/bon-partus` | `sale order ini jenis bon partus` |
| `/api/sales/draft-order/bon-reguler` | `sale order ini jenis reguler` |

Jika frontend tetap mengirim `note`, backend akan menaruh teks default jenis bon di bagian atas lalu menambahkan isi `note` dari frontend di bawahnya. Response API mengembalikan hasil akhirnya pada field `terms_and_conditions`.

Panduan pemakaian:

- gunakan `/api/sales/draft-order/bon-kering` untuk Sales Order bon kering
- gunakan `/api/sales/draft-order/bon-partus` untuk Sales Order bon partus
- gunakan `/api/sales/draft-order/bon-reguler` untuk Sales Order reguler
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
    "wilayah_id": 15,
    "wilayah_name": "Kecamatan A",
    "shipping_product_id": 2001,
    "shipping_product_name": "Biaya Angkutan Kecamatan A",
    "shipping_price_per_kg": 1500.0
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
10. user pilih banyak item
11. pilih endpoint create order yang sesuai dengan jenis transaksi
12. gunakan `/api/sales/draft-order/bon-kering` untuk bon kering
13. gunakan `/api/sales/draft-order/bon-partus` untuk bon partus
14. gunakan `/api/sales/draft-order/bon-reguler` untuk reguler
15. pastikan customer yang dipilih sudah memiliki `Wilayah Ongkir`
16. gunakan `/api/sales/draft-order` jika frontend ingin mengirim Terms and Conditions sendiri tanpa default jenis bon

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
- backend akan lookup rule ongkir frontend berdasarkan wilayah customer
- backend menghitung total berat dari seluruh line produk non-ongkir menggunakan field `weight` pada produk
- jika rule cocok, backend otomatis menambah 1 line produk ongkir dengan nominal `total_kg x tarif_per_kg`
- semua produk yang dipakai untuk perhitungan ongkir berbasis kilogram harus memiliki field `weight` yang terisi benar
- Terms and Conditions di backend disimpan pada field `note` di `sale.order`
- `customer-qr-by-id` cocok jika frontend hanya perlu string referensi QR
- `customer-qr-payload-by-id` cocok jika frontend ingin langsung render QR dan menyimpan metadata QR sekaligus dari `customer_id`
- `customer-qr-payload-by-ref` cocok jika frontend sudah menyimpan `customer_qr_ref` dan ingin membentuk ulang payload QR
- gunakan `format="ref"` jika flow scan tetap lookup ke backend dengan `customer_qr_ref`
- gunakan `format="json"` jika scanner/frontend perlu membaca detail dasar customer langsung dari isi QR
- endpoint `draft-order` tidak memberi Terms and Conditions default
- endpoint `draft-order/bon-kering`, `draft-order/bon-partus`, dan `draft-order/bon-reguler` akan mengisi Terms and Conditions default sesuai jenis bon
- jika frontend mengirim `note` ke endpoint jenis bon, backend akan menggabungkannya setelah teks default jenis bon

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
- `POST /api/sales/draft-order/bon-kering`
- `POST /api/sales/draft-order/bon-partus`
- `POST /api/sales/draft-order/bon-reguler`
- field `customer_qr_ref` di `res.partner`
- auto-generate `customer_qr_ref` untuk customer baru
- backfill `customer_qr_ref` untuk data existing saat install atau upgrade module

## Referensi File Backend

- endpoint sales: `grt_sales_business_category/controllers/main.py`
- customer QR ref: `grt_sales_business_category/models/res_partner.py`
- sales order model: `grt_sales_business_category/models/sale_order.py`
- accounting move model: `grt_sales_business_category/models/account_move.py`
- sequence QR ref: `grt_sales_business_category/data/res_partner_sequence.xml`
