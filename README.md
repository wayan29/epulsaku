
# ePulsaku - Aplikasi Transaksi Produk Digital

Selamat datang di ePulsaku! Aplikasi web Next.js yang dirancang untuk memfasilitasi transaksi produk digital seperti pulsa, token listrik, top-up game, dan lainnya, dengan integrasi ke provider seperti Digiflazz dan TokoVoucher.

## Daftar Isi

1.  [Fitur Utama](#fitur-utama)
2.  [Prasyarat Server](#prasyarat-server)
3.  [Langkah-langkah Instalasi](#langkah-langkah-instalasi)
    *   [3.1. Clone Repository](#31-clone-repository)
    *   [3.2. Instal Node.js dan Manajer Paket](#32-instal-nodejs-dan-manajer-paket)
    *   [3.3. Instal MongoDB](#33-instal-mongodb)
    *   [3.4. Konfigurasi Variabel Lingkungan (.env)](#34-konfigurasi-variabel-lingkungan-env)
    *   [3.5. Instal Dependensi Aplikasi](#35-instal-dependensi-aplikasi)
    *   [3.6. Build Aplikasi](#36-build-aplikasi)
    *   [3.7. Menjalankan Aplikasi dengan PM2](#37-menjalankan-aplikasi-dengan-pm2)
4.  [Konfigurasi Pasca-Instalasi](#konfigurasi-pasca-instalasi)
    *   [4.1. Pengaturan Web Server (Nginx/Apache - Opsional tapi Direkomendasikan)](#41-pengaturan-web-server-nginxapache---opsional-tapi-direkomendasikan)
    *   [4.2. Buat Akun Admin Pertama](#42-buat-akun-admin-pertama)
    *   [4.3. Konfigurasi Admin Settings](#43-konfigurasi-admin-settings)
    *   [4.4. Konfigurasi Webhook Provider](#44-konfigurasi-webhook-provider)
    *   [4.5. (Opsional) Konfigurasi Notifikasi Telegram](#45-opsional-konfigurasi-notifikasi-telegram)
5.  [Struktur Proyek (Ringkasan)](#struktur-proyek-ringkasan)
6.  [Penggunaan](#penggunaan)
7.  [Berkontribusi](#berkontribusi)

## 1. Fitur Utama

*   Frontend Next.js dengan React dan ShadCN UI.
*   Backend dengan Next.js API Routes dan Server Actions.
*   Manajemen pengguna (signup, login, ganti password, ganti PIN).
*   Integrasi dengan provider produk digital (Digiflazz, TokoVoucher).
*   Form order dinamis untuk berbagai jenis produk (Pulsa, Token Listrik, Layanan Digital Lainnya).
*   Histori transaksi.
*   Pengaturan harga kustom per produk (untuk Digiflazz & TokoVoucher).
*   Laporan profit sederhana.
*   Webhook untuk update status transaksi otomatis dari Digiflazz dan TokoVoucher.
*   Pengaturan admin untuk kredensial API provider, konfigurasi webhook, dan notifikasi Telegram.
*   Notifikasi status transaksi via Telegram.

## 2. Prasyarat Server

Sebelum memulai, pastikan VPS Anda (misalnya Ubuntu 20.04 LTS atau lebih baru) memiliki:

*   Akses root atau pengguna dengan hak sudo.
*   Koneksi internet yang stabil.
*   (Opsional) Nama domain yang sudah diarahkan ke IP VPS Anda jika ingin menggunakan HTTPS.

Software yang perlu diinstal:
*   **Node.js** (versi 18.x atau 20.x direkomendasikan)
*   **npm** (biasanya terinstal bersama Node.js) atau **Yarn**
*   **Git**
*   **MongoDB** (bisa diinstal lokal di VPS atau menggunakan layanan MongoDB Atlas)
*   **PM2** (Process Manager untuk Node.js - sangat direkomendasikan untuk produksi)
*   (Opsional) **Nginx** atau **Apache** sebagai reverse proxy.

## 3. Langkah-langkah Instalasi

### 3.1. Clone Repository

Clone repository ini ke direktori yang Anda inginkan di server Anda:
```bash
git clone [URL_REPOSITORY_ANDA] ePulsaku
cd ePulsaku
```
Ganti `[URL_REPOSITORY_ANDA]` dengan URL Git repository proyek Anda.

### 3.2. Instal Node.js dan Manajer Paket

Cara termudah untuk menginstal Node.js adalah melalui NodeSource:
```bash
# Untuk Node.js 20.x (direkomendasikan)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs

# Verifikasi instalasi
node -v
npm -v
```
Jika Anda lebih suka menggunakan Yarn:
```bash
sudo npm install --global yarn
yarn --version
```

### 3.3. Instal MongoDB

Jika Anda ingin menginstal MongoDB secara lokal di VPS Ubuntu:
```bash
sudo apt update
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb # Agar MongoDB berjalan otomatis saat boot

# Verifikasi
mongo --eval 'db.runCommand({ connectionStatus: 1 })'
```
Atau, Anda bisa menggunakan layanan cloud seperti MongoDB Atlas dan dapatkan Connection String URI Anda.

### 3.4. Konfigurasi Variabel Lingkungan (.env)

Buat file `.env` di root direktori proyek (`ePulsaku/.env`) dari contoh `.env.example` jika ada, atau buat baru. Isi dengan konfigurasi yang sesuai:

```dotenv
# MongoDB Configuration
MONGODB_URI="mongodb://localhost:27017" # Ganti jika menggunakan MongoDB Atlas atau konfigurasi custom
MONGODB_DB_NAME="ePulsakuDB"         # Nama database Anda

# Aplikasi
# PENTING: Untuk produksi, ganti dengan URL publik aplikasi Anda yang dapat diakses dari internet.
# Contoh: https://app.domainanda.com
# Ini digunakan untuk callback webhook dan fungsionalitas lainnya.
NEXT_PUBLIC_BASE_URL="http://localhost:9002" 

# Kredensial Admin Settings (akan diisi melalui UI, tapi perlu ada di DB)
# Tidak perlu diisi di .env kecuali untuk nilai default saat development jika diinginkan

# Webhook Secrets & IPs (akan diisi melalui UI Admin Settings)
# DIGIFLAZZ_WEBHOOK_SECRET="" # Secret key untuk webhook Digiflazz (atur di dashboard Digiflazz)
# ALLOWED_DIGIFLAZZ_IPS=""    # Daftar IP Digiflazz (comma-separated, dari dokumentasi Digiflazz)
# ALLOWED_TOKOVOUCHER_IPS=""  # Daftar IP TokoVoucher (comma-separated, dari dokumentasi TokoVoucher)

# Telegram Bot (akan diisi melalui UI Admin Settings)
# TELEGRAM_BOT_TOKEN=""
# TELEGRAM_CHAT_ID="" # Bisa beberapa ID, pisahkan dengan koma

# Genkit (Jika menggunakan fitur AI, sesuaikan - saat ini tidak digunakan secara aktif untuk GenAI models)
# GOOGLE_API_KEY="" 
# GENKIT_ENV="production" 
# GENKIT_TRACE_STORE="firebase" 
# FIREBASE_PROJECT_ID="" 
```

**PENTING:**
*   Ganti `mongodb://localhost:27017` dengan string koneksi MongoDB Anda jika menggunakan remote MongoDB atau MongoDB Atlas.
*   Ganti `ePulsakuDB` dengan nama database yang Anda inginkan.
*   **Sangat penting untuk mengganti `NEXT_PUBLIC_BASE_URL`** dengan URL domain publik Anda setelah aplikasi di-deploy dan diakses melalui web server (misalnya, `https://app.domainanda.com`). Saat development lokal, `http://localhost:9002` sudah cukup.
*   Nilai untuk `DIGIFLAZZ_WEBHOOK_SECRET`, `ALLOWED_DIGIFLAZZ_IPS`, `ALLOWED_TOKOVOUCHER_IPS`, `TELEGRAM_BOT_TOKEN`, dan `TELEGRAM_CHAT_ID` akan dikelola melalui halaman Admin Settings di aplikasi web setelah admin pertama login.

### 3.5. Instal Dependensi Aplikasi

Dari root direktori proyek (`ePulsaku/`):
```bash
npm install
# atau jika menggunakan Yarn
# yarn install
```

### 3.6. Build Aplikasi

Untuk production, build aplikasi Next.js:
```bash
npm run build
# atau jika menggunakan Yarn
# yarn build
```

### 3.7. Menjalankan Aplikasi dengan PM2

PM2 adalah process manager yang akan menjaga aplikasi Anda tetap berjalan dan memudahkannya untuk dikelola.

Instal PM2 secara global:
```bash
sudo npm install pm2 -g
```

Skrip `start` di `package.json` sudah dikonfigurasi untuk menjalankan aplikasi di port `9002`.
Mulai aplikasi Anda dengan PM2:
```bash
pm2 start npm --name "ePulsaku-web" -- start
```

Beberapa perintah PM2 yang berguna:
*   `pm2 list`: Melihat daftar semua proses yang dikelola PM2.
*   `pm2 logs ePulsaku-web`: Melihat log aplikasi.
*   `pm2 restart ePulsaku-web`: Merestart aplikasi.
*   `pm2 stop ePulsaku-web`: Menghentikan aplikasi.
*   `pm2 delete ePulsaku-web`: Menghapus aplikasi dari PM2.
*   `pm2 startup`: Membuat PM2 berjalan otomatis saat server boot (ikuti instruksi yang muncul).
*   `pm2 save`: Menyimpan konfigurasi proses PM2 saat ini agar dapat dipulihkan setelah reboot.

Aplikasi Anda sekarang seharusnya berjalan di port `9002`.

## 4. Konfigurasi Pasca-Instalasi

### 4.1. Pengaturan Web Server (Nginx/Apache - Opsional tapi Direkomendasikan)

Untuk production, sangat disarankan menggunakan web server seperti Nginx atau Apache sebagai reverse proxy di depan aplikasi Node.js Anda. Ini berguna untuk:
*   Menangani koneksi HTTPS (SSL/TLS).
*   Menyajikan aset statis.
*   Load balancing (jika diperlukan di masa depan).
*   Keamanan tambahan.

**Contoh Konfigurasi Nginx Sederhana:**

Buat file konfigurasi baru di `/etc/nginx/sites-available/epulsaku`:
```nginx
server {
    listen 80;
    server_name domainanda.com www.domainanda.com; # Ganti dengan domain Anda

    location / {
        proxy_pass http://localhost:9002; # Port aplikasi Next.js Anda (sesuai package.json)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Aktifkan konfigurasi:
```bash
sudo ln -s /etc/nginx/sites-available/epulsaku /etc/nginx/sites-enabled/
sudo nginx -t # Test konfigurasi Nginx
sudo systemctl restart nginx
```
Untuk HTTPS dengan Let's Encrypt (sangat direkomendasikan), Anda bisa menggunakan Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d domainanda.com -d www.domainanda.com
```
Certbot akan otomatis memodifikasi konfigurasi Nginx Anda untuk HTTPS.

### 4.2. Buat Akun Admin Pertama

*   Akses website Anda melalui browser (misalnya, `http://IP_VPS_ANDA:9002` atau `https://domainanda.com` jika sudah dikonfigurasi dengan Nginx/Apache).
*   Karena belum ada pengguna, Anda akan diarahkan ke halaman pendaftaran (`/signup`).
*   Daftarkan akun admin pertama Anda. Akun ini akan menjadi superuser. Setelah akun pertama dibuat, halaman `/signup` akan dinonaktifkan.

### 4.3. Konfigurasi Admin Settings

*   Setelah login dengan akun admin Anda, navigasikan ke `/admin-settings` (melalui menu dropdown User di header).
*   Masukkan semua kredensial API yang diperlukan untuk Digiflazz (Username, API Key, Webhook Secret, Allowed IPs) dan TokoVoucher (Member Code, Signature, API Key/Secret, Allowed IPs).
*   (Opsional) Masukkan kredensial untuk Notifikasi Telegram (Bot Token dan Chat ID).
*   Simpan pengaturan. Anda akan diminta memasukkan password akun admin Anda untuk konfirmasi.

### 4.4. Konfigurasi Webhook Provider

*   **Digiflazz:**
    *   Login ke dashboard Digiflazz Anda.
    *   Masuk ke menu Atur Koneksi > API > Webhook.
    *   Atur URL Webhook ke: `[NEXT_PUBLIC_BASE_URL_ANDA]/api/webhook/digiflazz` (ganti `[NEXT_PUBLIC_BASE_URL_ANDA]` dengan URL publik aplikasi Anda, misal `https://app.domainanda.com/api/webhook/digiflazz`).
    *   Masukkan **Secret Key Webhook** yang sama dengan yang Anda masukkan di Admin Settings aplikasi Anda (`digiflazzWebhookSecret`).
*   **TokoVoucher:**
    *   Login ke dashboard TokoVoucher Anda.
    *   Cari bagian pengaturan Webhook/Callback.
    *   Atur URL Webhook ke: `[NEXT_PUBLIC_BASE_URL_ANDA]/api/webhook/tokovoucher` (ganti `[NEXT_PUBLIC_BASE_URL_ANDA]` dengan URL publik aplikasi Anda).
    *   Pastikan Anda sudah mengisi Member Code dan Key/Secret API TokoVoucher Anda di Admin Settings aplikasi. Header `X-TokoVoucher-Authorization` akan diverifikasi menggunakan Member Code, Key/Secret, dan Ref ID dari payload.

### 4.5. (Opsional) Konfigurasi Notifikasi Telegram

Jika Anda ingin menerima notifikasi transaksi melalui Telegram:
1.  **Buat Bot Telegram:**
    *   Buka Telegram dan cari "BotFather".
    *   Kirim perintah `/newbot` ke BotFather.
    *   Ikuti instruksi untuk memberi nama bot Anda dan username bot.
    *   BotFather akan memberi Anda **Bot Token**. Simpan token ini.
2.  **Dapatkan Chat ID:**
    *   Untuk notifikasi pribadi: Kirim pesan apa saja ke bot baru Anda. Lalu, buka browser dan kunjungi URL: `https://api.telegram.org/bot[TOKEN_BOT_ANDA]/getUpdates`. Ganti `[TOKEN_BOT_ANDA]` dengan token yang Anda dapatkan. Cari bagian `"chat":{"id":xxxxxxxx?, ...}`. Angka `xxxxxxxxx` adalah Chat ID Anda.
    *   Untuk notifikasi grup: Tambahkan bot Anda ke grup Telegram. Kirim pesan apa saja ke grup. Gunakan URL `getUpdates` di atas. Chat ID grup biasanya dimulai dengan tanda minus (`-`).
3.  **Masukkan di Admin Settings:**
    *   Login ke aplikasi ePulsaku sebagai admin.
    *   Navigasikan ke `/admin-settings`.
    *   Masukkan **Bot Token** dan **Chat ID** (bisa beberapa, pisahkan dengan koma) yang sudah Anda dapatkan ke field yang sesuai.
    *   Simpan pengaturan (konfirmasi dengan password admin).

## 5. Struktur Proyek (Ringkasan)

*   `src/app/`: Direktori utama untuk halaman dan layout menggunakan Next.js App Router.
    *   `src/app/(app)/`: Halaman yang memerlukan autentikasi (Dashboard, Orders, Settings, dll.).
    *   `src/app/(auth)/`: Halaman untuk login dan signup.
    *   `src/app/api/`: Endpoint API Next.js.
        *   `src/app/api/webhook/`: Handler untuk webhook dari provider (Digiflazz, TokoVoucher).
*   `src/ai/`: File terkait Genkit.
    *   `src/ai/flows/`: Logika bisnis dan interaksi dengan API provider (Digiflazz, TokoVoucher, Codashop untuk inquiry nickname, Telegram untuk notifikasi).
*   `src/components/`: Komponen React UI.
    *   `src/components/ui/`: Komponen ShadCN UI.
    *   `src/components/auth/`: Komponen untuk login dan signup.
    *   `src/components/core/`: Komponen inti seperti Header.
    *   `src/components/dashboard/`: Komponen untuk halaman dashboard (dialog deposit).
    *   `src/components/order/`: Komponen terkait form pemesanan.
    *   `src/components/products/`: Komponen untuk menampilkan produk.
    *   `src/components/transactions/`: Komponen untuk menampilkan histori transaksi.
*   `src/contexts/`: React Contexts (misalnya, AuthContext).
*   `src/lib/`: Utilitas dan logika helper.
    *   `src/lib/mongodb.ts`: Koneksi ke MongoDB.
    *   `src/lib/user-utils.ts`: Fungsi terkait manajemen pengguna (termasuk sesi).
    *   `src/lib/transaction-utils.ts`: Fungsi terkait manajemen transaksi.
    *   `src/lib/admin-settings-utils.ts`: Fungsi terkait pengaturan admin.
    *   `src/lib/db-price-settings-utils.ts`: Fungsi terkait pengaturan harga dari database.
    *   `src/lib/price-settings-utils.ts`: Fungsi terkait pengaturan harga (localStorage untuk UI).
    *   `src/lib/client-utils.ts`: Utilitas sisi klien (seperti generate Ref ID).
    *   `src/lib/notification-utils.ts`: Utilitas untuk notifikasi (termasuk Telegram).
*   `public/`: Aset statis.

## 6. Penggunaan

Setelah instalasi dan konfigurasi selesai:

*   Akses aplikasi melalui domain Anda.
*   Admin dapat login dan mengelola pengaturan API provider, webhook, harga produk, notifikasi Telegram, dan melihat laporan profit.
*   Admin dapat melakukan transaksi produk digital.
*   Status transaksi akan diperbarui secara otomatis melalui webhook.
*   Notifikasi transaksi akan dikirim melalui Telegram (jika dikonfigurasi).

## 7. Berkontribusi

Jika Anda ingin berkontribusi pada proyek ini, silakan fork repository dan buat pull request. Untuk bug atau permintaan fitur, silakan buat issue.

---

Semoga berhasil dengan instalasi ePulsaku!
