# Budgetly 💰

Aplikasi manajemen keuangan modern untuk mencatat pemasukan dan pengeluaran dengan filter bulanan dan laporan saldo real-time.

## ✨ Fitur Utama

- 🔐 **Autentikasi Aman**: Login & profil user menggunakan [Clerk](https://clerk.com/).
- 📝 **Manajemen Transaksi (CRUD)**: Tambah, Edit, dan Hapus transaksi dengan mudah.
- 📅 **Input Tanggal**: Pilih tanggal transaksi secara spesifik.
- 📊 **Laporan Terfilter**:
  - **Saldo Bulanan**: Lihat pemasukan & pengeluaran berdasarkan bulan tertentu.
  - **Saldo Keseluruhan**: Akumulasi总 total saldo dari awal hingga saat ini.
- 📱 **Desain Premium & Responsive**: Interface modern dengan Glassmorphism, Gradasi, dan font Outfit.
- ☁️ **Cloud Database**: Tersimpan aman di **PostgreSQL (Neon.tech)** menggunakan **Prisma ORM**.

## 🛠️ Teknologi

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL (Neon)](https://neon.tech/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Authentikasi**: [Clerk](https://clerk.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Cara Menjalankan (Lokal)

1. **Clone project**
   ```bash
   git clone https://github.com/michailtjhang/Budgetly.git
   cd Budgetly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment (.env)**
   Buat file `.env` di root folder dan isi dengan key Anda:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
   ```

4. **Siapkan Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Jalankan Development Server**
   ```bash
   npm run dev
   ```

6. **Buka di Browser**
   Cek [http://localhost:3000](http://localhost:3000)

## 📦 Deployment (Vercel)

Aplikasi ini sudah dioptimalkan untuk Vercel. Pastikan Anda menambahkan Environment Variables yang sama di dashboard Vercel Anda. Script build sudah menyertakan `prisma generate`.

---
MIT License © 2026

