# Budgetly 💰

Aplikasi dompet digital sederhana untuk mencatat pemasukan & pengeluaran.  
Dibangun dengan **Next.js 15 (App Router)**, **Tailwind CSS**, dan **Clerk Authentication**.

## ✨ Fitur

- 🔐 **Autentikasi** dengan [Clerk](https://clerk.com/)  
- ➕ Tambah pemasukan & pengeluaran dengan deskripsi dan jumlah  
- 📅 Simpan tanggal transaksi otomatis  
- 💾 Data transaksi tersimpan di **JSON file** melalui API (`/api/transactions`)  
- 📊 Ringkasan keuangan:
  - Total Pemasukan
  - Total Pengeluaran
  - Saldo  
- 📱 Tampilan responsive (Mobile & Desktop)  
- 🎨 Mode **Light Only** (tidak mengikuti system dark mode)

## 🛠️ Teknologi

- [Next.js 15 (App Router)](https://nextjs.org/) → framework React modern  
- [Tailwind CSS](https://tailwindcss.com/) → styling cepat dengan utility-first  
- [Clerk](https://clerk.com/) → autentikasi login & logout  
- [TypeScript](https://www.typescriptlang.org/) → typing yang lebih aman  
- JSON File → penyimpanan transaksi sederhana  

## 🚀 Cara Menjalankan

1. Clone repo ini
   ```bash
   git clone https://github.com/username/dompetin.git
   cd dompetin
   ````

2. Install dependencies

   ```bash
   npm install
   ```

3. Tambahkan environment variable untuk Clerk di file `.env.local`

   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxx
   CLERK_SECRET_KEY=sk_test_xxxxxxx
   ```

4. Jalankan server development

   ```bash
   npm run dev
   ```

5. Buka di browser:
   👉 [http://localhost:3000](http://localhost:3000)

## 📜 Lisensi

MIT License © 2025
