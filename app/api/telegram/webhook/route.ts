import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Izinkan durasi hingga 60s untuk pemrosesan AI di serverless

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_TELEGRAM_ID = process.env.TELEGRAM_ALLOWED_USER_ID;
const CLERK_USER_ID = process.env.TELEGRAM_DEFAULT_CLERK_USER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

const ACCOUNT_OPTIONS = [
    "BCA", "blu by BCA", "BRI", "BNI", "Mandiri", "BJB", "Permata",
    "SeaBank", "Jago", "Flip", "GoPay", "ShopeePay", "OVO", "DANA",
    "Bibit", "Stockbit", "Ajaib", "Superbank", "Bank Saqu", "Krom Bank",
    "Dana Darurat", "Uang Tunai", "Lainnya"
];

const CATEGORY_OPTIONS = [
    "Makanan & Minuman", "Belanja & Pakaian", "Kesehatan & Skincare",
    "Investasi & Saham", "Top Up & Tabungan", "Komunikasi & Internet",
    "Ibadah & Sosial", "Tempat Tinggal", "Hobby & Gaming", "Elektronik",
    "Transportasi", "Biaya Admin & Pajak", "Pendidikan", "Tagihan",
    "Penghasilan", "Bunga", "Lainnya"
];

interface GeminiReceiptResult {
    error?: string;
    isTransfer?: boolean;
    type?: "expense" | "income";
    amount?: number;
    description?: string;
    account?: string;
    toAccount?: string;
    category?: string;
    date?: string;
}

interface GeminiTextResult {
    action?: "transfer" | "single" | "chat" | "history";
    amount?: number;
    adminFee?: number;
    fromAccount?: string;
    toAccount?: string;
    type?: "expense" | "income";
    account?: string;
    category?: string;
    description?: string;
    date?: string;
    reply?: string;
}

type GeminiPart = string | { inlineData: { data: string; mimeType: string } };

// Helper dengan fallback otomatis untuk menghindari error model 404 / deprecated
async function generateGeminiContent(contents: GeminiPart | GeminiPart[]): Promise<string> {
    const modelsToTry = [
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-pro"
    ];

    let lastError: unknown = null;
    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(contents);
            return result.response.text().trim();
        } catch (err: unknown) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("is not supported")) {
                continue;
            }
            throw err;
        }
    }
    throw lastError || new Error("Tidak ada model Gemini yang tersedia.");
}

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(amount);
}

function formatTanggalIndo(d: Date): string {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function sendTelegramMessage(chatId: number | string, text: string, replyToMessageId?: number) {
    if (!BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML",
                reply_to_message_id: replyToMessageId,
            }),
        });
    } catch (err) {
        console.error("[Telegram] Error sending message:", err);
    }
}

async function sendChatAction(chatId: number | string, action: string = "typing") {
    if (!BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                action,
            }),
        });
    } catch (err) {
        console.error("[Telegram] Error sending action:", err);
    }
}

async function handleShowHistory(chatId: number | string, messageId?: number) {
    await sendChatAction(chatId, "typing");
    const transactions = await db.transaction.findMany({
        where: { userId: CLERK_USER_ID },
        orderBy: { date: "desc" },
        take: 10,
    });

    if (transactions.length === 0) {
        await sendTelegramMessage(
            chatId,
            "📜 <b>Riwayat Transaksi</b>\n\nBelum ada transaksi yang tercatat di Budgetly.",
            messageId
        );
        return;
    }

    let msg = `📜 <b>10 Riwayat Transaksi Terakhir:</b>\n\n`;
    for (const t of transactions) {
        const isIncome = t.type === "income";
        const symbol = isIncome ? "🟢" : "🔴";
        const sign = isIncome ? "+" : "-";
        const tDate = new Date(t.date);
        const dateStr = `${tDate.getDate().toString().padStart(2, "0")}/${(tDate.getMonth() + 1).toString().padStart(2, "0")}/${tDate.getFullYear()}`;

        msg += `${symbol} <b>${sign}${formatRupiah(t.amount)}</b> • ${t.description}\n`;
        msg += `   📅 <i>${dateStr}</i> | 🏦 <i>${t.account || "Lainnya"}</i> | 📁 <i>${t.category || "Lainnya"}</i>\n\n`;
    }

    await sendTelegramMessage(chatId, msg, messageId);
}

// Endpoint GET untuk mengecek status webhook via browser
export async function GET() {
    return NextResponse.json({
        status: "active",
        botConfigured: Boolean(BOT_TOKEN),
        geminiConfigured: Boolean(GEMINI_API_KEY),
        allowedUserConfigured: Boolean(ALLOWED_TELEGRAM_ID),
        clerkUserConfigured: Boolean(CLERK_USER_ID),
        message: "Budgetly Telegram Webhook is running."
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const message = body.message || body.edited_message;

        if (!message || !message.chat) {
            return NextResponse.json({ ok: true });
        }

        const chatId = message.chat.id;
        const senderId = message.from?.id ? String(message.from.id) : "";
        const messageId = message.message_id;

        // Keamanan: Pastikan hanya pemilik yang diizinkan
        if (ALLOWED_TELEGRAM_ID && senderId !== ALLOWED_TELEGRAM_ID.trim()) {
            await sendTelegramMessage(
                chatId,
                `⛔ <b>Akses Ditolak</b>\n\nID Telegram Anda: <code>${senderId}</code>\nBot ini dikonfigurasi khusus untuk pemilik akun Budgetly. Masukkan ID ini ke <code>TELEGRAM_ALLOWED_USER_ID</code> jika ini adalah akun Anda.`,
                messageId
            );
            return NextResponse.json({ ok: true });
        }

        if (!CLERK_USER_ID) {
            await sendTelegramMessage(
                chatId,
                "⚠️ <b>Konfigurasi Belum Lengkap</b>\n\nVariabel <code>TELEGRAM_DEFAULT_CLERK_USER_ID</code> belum diset di Vercel.",
                messageId
            );
            return NextResponse.json({ ok: true });
        }

        const text = message.text?.trim() || "";
        const photo = message.photo;
        const caption = message.caption?.trim() || "";

        // 1. Handle Command: /start atau /help
        if (text === "/start" || text === "/help" || text === "/bantuan") {
            const welcomeText = `👋 <b>Halo di Budgetly Assistant Bot!</b>

Saya siap membantu mencatat transaksi keuangan Anda secara otomatis.

💡 <b>Cara Penggunaan:</b>

1️⃣ <b>Transfer Antar Rekening / E-Wallet:</b>
• <i>"tf ke gopay dari jago 50rb"</i>
• <i>"transfer 100k dari bca ke seabank"</i>
• <i>"top up ovo dari bca 25rb admin 1000"</i>
👉 <i>(Saldo pengirim otomatis berkurang, dan penerima bertambah!)</i>

2️⃣ <b>Pengeluaran / Pemasukan Teks:</b>
• <i>"makan siang geprek 25rb pake bca"</i>
• <i>"bensin 35k tunai"</i>
• <i>"gaji bulanan 10jt masuk mandiri"</i>

3️⃣ <b>Bisa Catat Tanggal Lampau (Kemarin, Lusa, dll):</b>
• <i>"kemarin saya makan bakso 25rb pake bca"</i>
• <i>"kemarin keluar 50rb buat bensin"</i>
• <i>"2 hari lalu tf ke gopay dari bca 100rb"</i>
👉 <i>(Tanggal otomatis disesuaikan ke kemarin / hari lampau!)</i>

4️⃣ <b>Kirim Foto Struk / QRIS / Bukti Transfer:</b>
• Langsung kirim foto screenshot QRIS atau bukti transfer!
• AI otomatis mendeteksi nominal, merchant, dan rekening pengeluaran.

📊 <b>Perintah Tambahan:</b>
• /riwayat - Lihat 10 transaksi terakhir
• /saldo - Cek rincian saldo semua rekening & e-wallet
• /rekap - Ringkasan pemasukan & pengeluaran bulan ini`;

            await sendTelegramMessage(chatId, welcomeText, messageId);
            return NextResponse.json({ ok: true });
        }

        // 2. Handle Command: /riwayat
        if (text === "/riwayat" || text === "/history") {
            await handleShowHistory(chatId, messageId);
            return NextResponse.json({ ok: true });
        }

        // 3. Handle Command: /saldo
        if (text === "/saldo") {
            await sendChatAction(chatId, "typing");
            const transactions = await db.transaction.findMany({
                where: { userId: CLERK_USER_ID },
            });

            const balances = transactions.reduce((acc, t) => {
                const accName = t.account || "Lainnya";
                const amt = Number(t.amount) || 0;
                if (!acc[accName]) acc[accName] = 0;
                if (t.type === "income") {
                    acc[accName] += amt;
                } else {
                    acc[accName] -= amt;
                }
                return acc;
            }, {} as Record<string, number>);

            const nonZeroAccounts = Object.entries(balances)
                .filter(([, bal]) => bal !== 0)
                .sort((a, b) => b[1] - a[1]);

            const totalBalance = Object.values(balances).reduce((sum, b) => sum + b, 0);

            if (nonZeroAccounts.length === 0) {
                await sendTelegramMessage(
                    chatId,
                    "🏦 <b>Saldo Akun Budgetly</b>\n\nBelum ada saldo transaksi yang tercatat.",
                    messageId
                );
                return NextResponse.json({ ok: true });
            }

            let msg = `🏦 <b>Rincian Saldo Akun Budgetly:</b>\n\n`;
            for (const [accName, bal] of nonZeroAccounts) {
                msg += `• <b>${accName}</b>: <code>${formatRupiah(bal)}</code>\n`;
            }
            msg += `\n💰 <b>Total Saldo:</b> <code>${formatRupiah(totalBalance)}</code>`;

            await sendTelegramMessage(chatId, msg, messageId);
            return NextResponse.json({ ok: true });
        }

        // 4. Handle Command: /rekap
        if (text === "/rekap") {
            await sendChatAction(chatId, "typing");
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const transactions = await db.transaction.findMany({
                where: {
                    userId: CLERK_USER_ID,
                    date: { gte: firstDayOfMonth },
                },
            });

            let incomeTotal = 0;
            let expenseTotal = 0;

            for (const t of transactions) {
                if (t.type === "income") incomeTotal += Number(t.amount) || 0;
                else expenseTotal += Number(t.amount) || 0;
            }

            const monthNames = [
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
            ];
            const currentMonthName = monthNames[now.getMonth()];

            const rekapMsg = `📊 <b>Rekap Bulan ${currentMonthName} ${now.getFullYear()}</b>\n\n` +
                `🟢 <b>Pemasukan:</b> <code>${formatRupiah(incomeTotal)}</code>\n` +
                `🔴 <b>Pengeluaran:</b> <code>${formatRupiah(expenseTotal)}</code>\n` +
                `💵 <b>Selisih (Net):</b> <code>${formatRupiah(incomeTotal - expenseTotal)}</code>\n\n` +
                `📝 Total: ${transactions.length} transaksi`;

            await sendTelegramMessage(chatId, rekapMsg, messageId);
            return NextResponse.json({ ok: true });
        }

        // 5. Handle Foto (Screenshot QRIS / Bukti Transfer / Struk)
        if (photo && photo.length > 0) {
            await sendChatAction(chatId, "typing");
            const highestResPhoto = photo[photo.length - 1];

            // Dapatkan URL file dari Telegram
            const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${highestResPhoto.file_id}`);
            const fileJson = await fileRes.json();

            if (!fileJson.ok || !fileJson.result?.file_path) {
                await sendTelegramMessage(chatId, "❌ Gagal mengunduh gambar dari Telegram. Coba kirim ulang.", messageId);
                return NextResponse.json({ ok: true });
            }

            const imageFilePath = fileJson.result.file_path;
            const imageBlobRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${imageFilePath}`);
            const imageBuffer = await imageBlobRes.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString("base64");

            const prompt = `Kamu adalah asisten keuangan pintar Budgetly. Analisis gambar bukti transaksi / QRIS / struk transfer / nota belanja ini.

Daftar Akun yang Dikenal: ${ACCOUNT_OPTIONS.join(", ")}
Daftar Kategori: ${CATEGORY_OPTIONS.join(", ")}
Caption dari user (jika ada): "${caption}"

ATURAN ANALISIS:
1. Bukti pembayaran QRIS, struk kasir, atau bukti transfer keluar selalu merupakan "expense" (pengeluaran). Kecuali jika jelas-jelas terdapat keterangan dana masuk/diterima maka "income".
2. Jika merupakan transfer antar akun sendiri (misal dari rekening ke e-wallet pribadi yang sama-sama milik user):
   set "isTransfer": true, "fromAccount": nama akun pengirim, "toAccount": nama akun penerima.
3. Ekstrak data dalam format JSON murni:
{
  "isTransfer": boolean,
  "type": "expense" | "income",
  "amount": number (angka murni tanpa titik atau koma),
  "description": string (nama toko/merchant/keterangan transaksi, maks 45 karakter),
  "account": string (pilih yang paling cocok dari Daftar Akun, atau "Lainnya" jika tidak tertera),
  "toAccount": string (jika isTransfer true),
  "category": string (pilih yang paling cocok dari Daftar Kategori),
  "date": string (format YYYY-MM-DD, jika tanggal tidak terlihat gunakan ${new Date().toISOString().split("T")[0]})
}

Jika gambar sama sekali bukan bukti transaksi/struk, kembalikan:
{"error": "Gambar bukan bukti transaksi atau tidak dapat dibaca"}

KEMBALIKAN HANYA JSON MURNI TANPA BACKTICK, TANPA MARKDOWN.`;

            let geminiText = "";
            try {
                geminiText = await generateGeminiContent([
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: "image/jpeg",
                        },
                    },
                    prompt,
                ]);
            } catch (err: unknown) {
                console.error("[Telegram] Gemini Vision Error:", err);
                const errMsg = err instanceof Error ? err.message : "Error";
                await sendTelegramMessage(chatId, `❌ Gagal memproses gambar dengan AI: ${errMsg}`, messageId);
                return NextResponse.json({ ok: true });
            }

            // Clean markdown blocks if any
            let cleanedJson = geminiText;
            if (cleanedJson.startsWith("```")) {
                cleanedJson = cleanedJson.replace(/```(?:json)?\n?/g, "").replace(/```$/g, "").trim();
            }

            let parsedData: GeminiReceiptResult = {};
            try {
                parsedData = JSON.parse(cleanedJson) as GeminiReceiptResult;
            } catch {
                await sendTelegramMessage(chatId, "⚠️ Gambar tidak terbaca dengan jelas sebagai bukti transaksi.", messageId);
                return NextResponse.json({ ok: true });
            }

            if (parsedData.error) {
                await sendTelegramMessage(chatId, `⚠️ ${parsedData.error}`, messageId);
                return NextResponse.json({ ok: true });
            }

            const transDate = parsedData.date ? new Date(parsedData.date) : new Date();
            const amount = Number(parsedData.amount) || 0;

            if (amount <= 0) {
                await sendTelegramMessage(chatId, "⚠️ Nominal transaksi pada gambar tidak terdeteksi atau 0.", messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika terdeteksi transfer antar akun sendiri
            if (parsedData.isTransfer && parsedData.account && parsedData.toAccount) {
                const fromAcc = ACCOUNT_OPTIONS.includes(parsedData.account) ? parsedData.account : "Lainnya";
                const toAcc = ACCOUNT_OPTIONS.includes(parsedData.toAccount) ? parsedData.toAccount : "Lainnya";

                await db.$transaction([
                    db.transaction.create({
                        data: {
                            description: `Transfer ke ${toAcc}`,
                            amount: amount,
                            type: "expense",
                            account: fromAcc,
                            category: "Top Up & Tabungan",
                            date: transDate,
                            userId: CLERK_USER_ID,
                        },
                    }),
                    db.transaction.create({
                        data: {
                            description: `Transfer dari ${fromAcc}`,
                            amount: amount,
                            type: "income",
                            account: toAcc,
                            category: "Top Up & Tabungan",
                            date: transDate,
                            userId: CLERK_USER_ID,
                        },
                    }),
                ]);

                const replyMsg = `✅ <b>Transfer Berhasil Dicatat dari Bukti Struk!</b>\n\n` +
                    `📤 <b>Keluar:</b> <code>${formatRupiah(amount)}</code> (${fromAcc})\n` +
                    `📥 <b>Masuk:</b> <code>${formatRupiah(amount)}</code> (${toAcc})\n` +
                    `📁 <b>Kategori:</b> Top Up & Tabungan\n` +
                    `📅 <b>Tanggal:</b> ${formatTanggalIndo(transDate)}`;

                await sendTelegramMessage(chatId, replyMsg, messageId);
                return NextResponse.json({ ok: true });
            }

            // Transaksi pengeluaran/pemasukan biasa (misal QRIS belanja)
            const type = parsedData.type === "income" ? "income" : "expense";
            const account = parsedData.account && ACCOUNT_OPTIONS.includes(parsedData.account) ? parsedData.account : (parsedData.account || "Lainnya");
            const category = parsedData.category && CATEGORY_OPTIONS.includes(parsedData.category) ? parsedData.category : "Lainnya";
            const description = parsedData.description || (type === "expense" ? "Pembayaran QRIS" : "Pemasukan");

            await db.transaction.create({
                data: {
                    description,
                    amount,
                    type,
                    account,
                    category,
                    date: transDate,
                    userId: CLERK_USER_ID,
                },
            });

            const replyMsg = `${type === "expense" ? "💸 <b>Pengeluaran Berhasil Dicatat dari Bukti/QRIS!</b>" : "🎉 <b>Pemasukan Berhasil Dicatat!</b>"}\n\n` +
                `📝 <b>Keterangan:</b> ${description}\n` +
                `💰 <b>Nominal:</b> <code>${formatRupiah(amount)}</code>\n` +
                `🏦 <b>Akun:</b> ${account}\n` +
                `📁 <b>Kategori:</b> ${category}\n` +
                `📅 <b>Tanggal:</b> ${formatTanggalIndo(transDate)}`;

            await sendTelegramMessage(chatId, replyMsg, messageId);
            return NextResponse.json({ ok: true });
        }

        // 6. Handle Chat Teks (NLP Gemini)
        if (text) {
            await sendChatAction(chatId, "typing");
            const now = new Date();
            const todayStr = now.toISOString().split("T")[0];
            const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
            const currentDayName = daysIndo[now.getDay()];

            const prompt = `Kamu adalah asisten pencatat keuangan cerdas untuk aplikasi Budgetly.
Tugasmu adalah menganalisis pesan pengguna: "${text}"

Daftar Akun yang Dikenal: ${ACCOUNT_OPTIONS.join(", ")}
Daftar Kategori: ${CATEGORY_OPTIONS.join(", ")}
Hari Ini: ${currentDayName}, ${todayStr}

ATURAN TANGGAL & WAKTU:
- Analisis apakah pengguna menyebutkan keterangan waktu:
  - "kemarin": hitung tanggal H-1 dari hari ini.
  - "kemarin lusa" / "2 hari lalu": hitung tanggal H-2 dari hari ini.
  - "3 hari lalu": hitung tanggal H-3 dari hari ini.
  - Jika menyebut hari tertentu (misal "senin kemarin", "minggu lalu"), hitung tanggal hari tersebut yang paling dekat ke belakang.
  - Jika menyebut tanggal spesifik (misal "tanggal 2", "tgl 4 kemarin"), sesuaikan dengan bulan dan tahun saat ini (${todayStr}).
  - Jika tidak ada keterangan waktu: gunakan tanggal hari ini: "${todayStr}".
- Masukkan ke field "date" dalam format "YYYY-MM-DD".

KEMUNGKINAN INTENT:
1. "history": Jika user meminta melihat riwayat, transaksi terakhir, catatan keuangan lalu.
   Contoh: "lihat riwayat", "riwayat terakhir", "history transaksi", "rekap transaksi terakhir", "transaksi kemaren kemaren"
   Format JSON:
   {
     "action": "history"
   }

2. "transfer": Pemindahan dana, top-up, atau tf antar akun/rekening/dompet digital.
   Contoh: "tf ke gopay dari jago 50rb", "kemarin transfer dari bca ke jago 100k", "top up shopeepay 20rb pake bca admin 1000", "pindah dana 500rb dari mandiri ke bibit"
   Format JSON:
   {
     "action": "transfer",
     "amount": number (angka nominal tanpa titik/koma, misal 50000),
     "fromAccount": string (pilih akun sumber dari Daftar Akun yang Dikenal, misal "Jago"),
     "toAccount": string (pilih akun tujuan dari Daftar Akun yang Dikenal, misal "GoPay"),
     "adminFee": number (jika ada biaya admin, jika tidak ada isi 0),
     "description": string (keterangan singkat, misal "Transfer Jago ke GoPay"),
     "date": string (format YYYY-MM-DD)
   }

3. "single": Catatan pengeluaran atau pemasukan biasa.
   Contoh: "kemarin saya makan bakso 25rb pake gopay", "kemarin keluar 50rb buat bensin", "2 hari lalu beli pulsa 50k bca", "tgl 3 dapet gaji 10jt masuk mandiri"
   Format JSON:
   {
     "action": "single",
     "type": "expense" | "income",
     "amount": number (angka nominal murni),
     "account": string (pilih dari Daftar Akun yang Dikenal, jika tidak disebutkan gunakan "Uang Tunai" atau "Lainnya"),
     "category": string (pilih kategori paling cocok dari Daftar Kategori),
     "description": string (keterangan pengeluaran/pemasukan),
     "date": string (format YYYY-MM-DD)
   }

4. "chat": Jika pesan hanya sapaan atau percakapan biasa dan bukan transaksi keuangan.
   Format JSON:
   {
     "action": "chat",
     "reply": string (balasan ramah dalam bahasa Indonesia)
   }

KEMBALIKAN HANYA JSON MURNI TANPA BACKTICK, TANPA MARKDOWN.`;

            let geminiReply = "";
            try {
                geminiReply = await generateGeminiContent(prompt);
            } catch (err: unknown) {
                console.error("[Telegram] Gemini Text Error:", err);
                const errMsg = err instanceof Error ? err.message : "Error";
                await sendTelegramMessage(chatId, `❌ Gagal memproses pesan: ${errMsg}`, messageId);
                return NextResponse.json({ ok: true });
            }

            let cleanedJson = geminiReply;
            if (cleanedJson.startsWith("```")) {
                cleanedJson = cleanedJson.replace(/```(?:json)?\n?/g, "").replace(/```$/g, "").trim();
            }

            let parsed: GeminiTextResult = {};
            try {
                parsed = JSON.parse(cleanedJson) as GeminiTextResult;
            } catch {
                await sendTelegramMessage(chatId, "⚠️ Maaf, saya tidak dapat memahami format transaksi tersebut. Coba contoh: <i>'kemarin makan bakso 25rb pake bca'</i> atau <i>'tf ke gopay dari jago 50rb'</i>", messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika action == "history"
            if (parsed.action === "history") {
                await handleShowHistory(chatId, messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika action == "chat"
            if (parsed.action === "chat") {
                await sendTelegramMessage(chatId, parsed.reply || "Halo! Ada yang bisa saya bantu catat hari ini?", messageId);
                return NextResponse.json({ ok: true });
            }

            // Tanggal transaksi (kemarin, lusa, atau hari ini)
            const transDate = parsed.date ? new Date(parsed.date) : new Date();

            // Jika action == "transfer"
            if (parsed.action === "transfer") {
                const amount = Number(parsed.amount) || 0;
                const adminFee = Number(parsed.adminFee) || 0;
                const fromAccount = parsed.fromAccount && ACCOUNT_OPTIONS.includes(parsed.fromAccount) ? parsed.fromAccount : (parsed.fromAccount || "Lainnya");
                const toAccount = parsed.toAccount && ACCOUNT_OPTIONS.includes(parsed.toAccount) ? parsed.toAccount : (parsed.toAccount || "Lainnya");

                if (amount <= 0) {
                    await sendTelegramMessage(chatId, "⚠️ Nominal transfer tidak boleh 0.", messageId);
                    return NextResponse.json({ ok: true });
                }

                // Buat 2 transaksi (expense di akun pengirim, income di akun penerima)
                const transferOps = [
                    db.transaction.create({
                        data: {
                            description: parsed.description || `Transfer ke ${toAccount}`,
                            amount: amount,
                            type: "expense",
                            account: fromAccount,
                            category: "Top Up & Tabungan",
                            date: transDate,
                            userId: CLERK_USER_ID,
                        },
                    }),
                    db.transaction.create({
                        data: {
                            description: parsed.description || `Transfer dari ${fromAccount}`,
                            amount: amount,
                            type: "income",
                            account: toAccount,
                            category: "Top Up & Tabungan",
                            date: transDate,
                            userId: CLERK_USER_ID,
                        },
                    }),
                ];

                // Tambahkan biaya admin jika ada
                if (adminFee > 0) {
                    transferOps.push(
                        db.transaction.create({
                            data: {
                                description: `Biaya Admin Transfer ke ${toAccount}`,
                                amount: adminFee,
                                type: "expense",
                                account: fromAccount,
                                category: "Biaya Admin & Pajak",
                                date: transDate,
                                userId: CLERK_USER_ID,
                            },
                        })
                    );
                }

                await db.$transaction(transferOps);

                let replyMsg = `✅ <b>Transfer Berhasil Dicatat!</b>\n\n` +
                    `📤 <b>Keluar:</b> <code>${formatRupiah(amount)}</code> dari <b>${fromAccount}</b>\n` +
                    `📥 <b>Masuk:</b> <code>${formatRupiah(amount)}</code> ke <b>${toAccount}</b>\n`;

                if (adminFee > 0) {
                    replyMsg += `💸 <b>Biaya Admin:</b> <code>${formatRupiah(adminFee)}</code>\n`;
                }
                replyMsg += `📁 <b>Kategori:</b> Top Up & Tabungan\n` +
                    `📅 <b>Tanggal:</b> ${formatTanggalIndo(transDate)}\n\n` +
                    `💡 <i>Saldo di ${fromAccount} otomatis berkurang dan di ${toAccount} bertambah.</i>`;

                await sendTelegramMessage(chatId, replyMsg, messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika action == "single"
            if (parsed.action === "single") {
                const amount = Number(parsed.amount) || 0;
                if (amount <= 0) {
                    await sendTelegramMessage(chatId, "⚠️ Nominal transaksi tidak boleh 0.", messageId);
                    return NextResponse.json({ ok: true });
                }

                const type = parsed.type === "income" ? "income" : "expense";
                const account = parsed.account && ACCOUNT_OPTIONS.includes(parsed.account) ? parsed.account : (parsed.account || "Uang Tunai");
                const category = parsed.category && CATEGORY_OPTIONS.includes(parsed.category) ? parsed.category : "Lainnya";
                const description = parsed.description || (type === "expense" ? "Pengeluaran" : "Pemasukan");

                await db.transaction.create({
                    data: {
                        description,
                        amount,
                        type,
                        account,
                        category,
                        date: transDate,
                        userId: CLERK_USER_ID,
                    },
                });

                const replyMsg = `${type === "income" ? "🎉 <b>Pemasukan Berhasil Dicatat!</b>" : "✅ <b>Pengeluaran Berhasil Dicatat!</b>"}\n\n` +
                    `📝 <b>Keterangan:</b> ${description}\n` +
                    `💰 <b>Nominal:</b> <code>${formatRupiah(amount)}</code>\n` +
                    `🏦 <b>Akun:</b> ${account}\n` +
                    `📁 <b>Kategori:</b> ${category}\n` +
                    `📅 <b>Tanggal:</b> ${formatTanggalIndo(transDate)}`;

                await sendTelegramMessage(chatId, replyMsg, messageId);
                return NextResponse.json({ ok: true });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        console.error("[Telegram Webhook] Global Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
