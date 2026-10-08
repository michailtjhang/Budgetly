import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateGeminiContent } from "@/lib/gemini";

export const maxDuration = 60; // Izinkan durasi hingga 60s untuk pemrosesan AI di serverless

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_TELEGRAM_ID = process.env.TELEGRAM_ALLOWED_USER_ID;
const CLERK_USER_ID = process.env.TELEGRAM_DEFAULT_CLERK_USER_ID;

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

// Auto-create tabel TelegramUser jika belum ada (failsafe)
async function ensureTelegramUserTable() {
    try {
        await db.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "TelegramUser" (
                "id" SERIAL PRIMARY KEY,
                "telegramId" TEXT NOT NULL UNIQUE,
                "clerkUserId" TEXT NOT NULL,
                "telegramUsername" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch {
        // Ignored if table already exists
    }
}

// Ambil Clerk User ID yang terhubung dengan akun Telegram ini
async function getLinkedClerkUserId(telegramId: string): Promise<string | null> {
    await ensureTelegramUserTable();
    try {
        const rows = await db.$queryRawUnsafe<Array<{ clerkUserId: string }>>(
            `SELECT "clerkUserId" FROM "TelegramUser" WHERE "telegramId" = $1 LIMIT 1`,
            telegramId
        );
        if (rows && rows.length > 0 && rows[0].clerkUserId) {
            return rows[0].clerkUserId;
        }
    } catch (e) {
        console.error("[Telegram] Error fetching TelegramUser:", e);
    }

    // Fallback khusus untuk akun owner yang diset via environment variable
    if (ALLOWED_TELEGRAM_ID && telegramId === ALLOWED_TELEGRAM_ID.trim() && CLERK_USER_ID) {
        return CLERK_USER_ID;
    }

    return null;
}

// Simpan / update hubungan Telegram ID ke Clerk User ID
async function linkTelegramUser(telegramId: string, clerkUserId: string, username?: string): Promise<boolean> {
    await ensureTelegramUserTable();
    try {
        await db.$executeRawUnsafe(
            `INSERT INTO "TelegramUser" ("telegramId", "clerkUserId", "telegramUsername", "updatedAt")
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT ("telegramId")
             DO UPDATE SET "clerkUserId" = EXCLUDED."clerkUserId", "telegramUsername" = EXCLUDED."telegramUsername", "updatedAt" = CURRENT_TIMESTAMP`,
            telegramId,
            clerkUserId,
            username || null
        );
        return true;
    } catch (e) {
        console.error("[Telegram] Error linking TelegramUser:", e);
        return false;
    }
}

// Putuskan hubungan akun Telegram
async function unlinkTelegramUser(telegramId: string): Promise<boolean> {
    await ensureTelegramUserTable();
    try {
        await db.$executeRawUnsafe(
            `DELETE FROM "TelegramUser" WHERE "telegramId" = $1`,
            telegramId
        );
        return true;
    } catch {
        return false;
    }
}

async function handleShowHistory(chatId: number | string, clerkUserId: string, messageId?: number) {
    await sendChatAction(chatId, "typing");
    const transactions = await db.transaction.findMany({
        where: { userId: clerkUserId },
        orderBy: { date: "desc" },
        take: 10,
    });

    if (transactions.length === 0) {
        await sendTelegramMessage(
            chatId,
            "📜 <b>Riwayat Transaksi</b>\n\nBelum ada transaksi yang tercatat di akun Budgetly Anda.",
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
        message: "Budgetly Telegram Webhook is running with multi-user support."
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
        const senderUsername = message.from?.username || message.from?.first_name || "";
        const messageId = message.message_id;

        const text = message.text?.trim() || "";
        const photo = message.photo;
        const caption = message.caption?.trim() || "";

        // 1. Cek apakah pesan adalah permintaan Login / Pairing Clerk ID
        // Contoh: "/login user_2..." atau "/start user_2..." atau langsung kirim "user_2..."
        const loginPrefixMatch = text.match(/^\/(?:login|start)\s+(user_[a-zA-Z0-9_-]+)/i);
        const directClerkIdMatch = text.match(/^(user_[a-zA-Z0-9_-]{10,})$/i);
        const pairingClerkId = loginPrefixMatch ? loginPrefixMatch[1] : (directClerkIdMatch ? directClerkIdMatch[1] : null);

        if (pairingClerkId) {
            await sendChatAction(chatId, "typing");
            const success = await linkTelegramUser(senderId, pairingClerkId, senderUsername);

            if (success) {
                const welcomeMsg = `🎉 <b>Akun Berhasil Dihubungkan!</b>

Halo <b>${senderUsername || "Teman"}</b>, akun Telegram Anda sekarang telah tersambung dengan Budgetly:
👤 <b>User ID:</b> <code>${pairingClerkId}</code>

Sekarang Anda bisa langsung mencatat keuangan:
• <b>Catat Pengeluaran:</b> <i>"makan bakso 25rb pake bca"</i>
• <b>Catat Pemasukan:</b> <i>"gaji 10jt masuk mandiri"</i>
• <b>Transfer:</b> <i>"tf ke gopay dari jago 50rb"</i>
• <b>Tanggal Lampau:</b> <i>"kemarin beli bensin 35k tunai"</i>
• <b>Kirim Foto:</b> Screenshot struk / bukti transfer / QRIS
• <b>Perintah:</b> /saldo, /rekap, atau /riwayat

✨ <i>Akun Anda tersimpan otomatis. Anda tidak perlu memasukkan User ID lagi besok-besok!</i>`;
                await sendTelegramMessage(chatId, welcomeMsg, messageId);
                return NextResponse.json({ ok: true });
            } else {
                await sendTelegramMessage(chatId, "❌ Gagal menghubungkan akun. Silakan coba lagi sebentar lagi.", messageId);
                return NextResponse.json({ ok: true });
            }
        }

        // 2. Command /logout untuk memutuskan akun
        if (text === "/logout") {
            await unlinkTelegramUser(senderId);
            await sendTelegramMessage(
                chatId,
                "👋 <b>Koneksi Akun Berhasil Diputuskan.</b>\n\nUntuk menghubungkan kembali atau mengganti akun, kirimkan User ID Budgetly Anda yang baru.",
                messageId
            );
            return NextResponse.json({ ok: true });
        }

        // 3. Command /status atau /whoami
        if (text === "/status" || text === "/whoami") {
            const currentLinkedId = await getLinkedClerkUserId(senderId);
            if (currentLinkedId) {
                await sendTelegramMessage(
                    chatId,
                    `👤 <b>Status Akun Anda:</b>\n\n` +
                    `• <b>Telegram ID:</b> <code>${senderId}</code>\n` +
                    `• <b>Clerk User ID:</b> <code>${currentLinkedId}</code>\n` +
                    `• <b>Status:</b> 🟢 Terhubung\n\n` +
                    `<i>Ketik /logout jika ingin memutuskan atau berganti akun.</i>`,
                    messageId
                );
            } else {
                await sendTelegramMessage(
                    chatId,
                    `👤 <b>Status Akun Anda:</b>\n\n` +
                    `• <b>Telegram ID:</b> <code>${senderId}</code>\n` +
                    `• <b>Status:</b> 🔴 Belum terhubung\n\n` +
                    `Silakan kirimkan User ID Budgetly Anda untuk mulai mencatat keuangan.`,
                    messageId
                );
            }
            return NextResponse.json({ ok: true });
        }

        // 4. Periksa apakah user sudah terhubung
        const activeClerkUserId = await getLinkedClerkUserId(senderId);

        // Jika BELUM terhubung, tampilkan panduan login
        if (!activeClerkUserId) {
            const needLoginMsg = `👋 <b>Selamat Datang di Budgetly Assistant Bot!</b>

Bot ini dapat membantu Anda mencatat keuangan secara otomatis ke dashboard Budgetly Anda.

🔐 <b>Langkah Mudah Menghubungkan Akun:</b>

1️⃣ Buka website <b>Budgetly</b> di browser Anda.
2️⃣ Di pojok kanan atas, klik tombol <b>"Bot Telegram"</b>.
3️⃣ Klik tombol <b>"Salin ID"</b> untuk menyalin User ID Anda.
4️⃣ Kirim User ID tersebut ke sini, contoh:
<code>/login user_2xxxxxxxxxxxxxxx</code>
<i>(atau langsung kirim User ID-nya saja)</i>

✨ <i>Cukup hubungkan 1 kali saja. Akun Anda akan tersimpan secara permanen dan tidak perlu login lagi di masa mendatang!</i>`;

            await sendTelegramMessage(chatId, needLoginMsg, messageId);
            return NextResponse.json({ ok: true });
        }

        // ==========================================
        // USER SUDAH TERHUBUNG (activeClerkUserId)
        // ==========================================

        // Handle Command: /start atau /help
        if (text === "/start" || text === "/help" || text === "/bantuan") {
            const welcomeText = `👋 <b>Halo! Akun Budgetly Anda Sudah Terhubung!</b>
👤 ID: <code>${activeClerkUserId}</code>

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
• /rekap - Ringkasan pemasukan & pengeluaran bulan ini
• /status - Cek status akun Anda
• /logout - Putuskan koneksi akun`;

            await sendTelegramMessage(chatId, welcomeText, messageId);
            return NextResponse.json({ ok: true });
        }

        // Handle Command: /riwayat
        if (text === "/riwayat" || text === "/history") {
            await handleShowHistory(chatId, activeClerkUserId, messageId);
            return NextResponse.json({ ok: true });
        }

        // Handle Command: /saldo
        if (text === "/saldo") {
            await sendChatAction(chatId, "typing");
            const transactions = await db.transaction.findMany({
                where: { userId: activeClerkUserId },
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
                    "🏦 <b>Saldo Akun Budgetly</b>\n\nBelum ada saldo transaksi yang tercatat di akun Anda.",
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

        // Handle Command: /rekap
        if (text === "/rekap") {
            await sendChatAction(chatId, "typing");
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const transactions = await db.transaction.findMany({
                where: {
                    userId: activeClerkUserId,
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

        // Handle Foto (Screenshot QRIS / Bukti Transfer / Struk)
        if (photo && photo.length > 0) {
            await sendChatAction(chatId, "typing");
            const highestResPhoto = photo[photo.length - 1];

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
                            userId: activeClerkUserId,
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
                            userId: activeClerkUserId,
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
                    userId: activeClerkUserId,
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

        // Handle Chat Teks (NLP Gemini)
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

2. "transfer": Pemindahan dana, top-up, setor tunai, tarik tunai, tukar uang, atau tf antar akun/rekening/dompet digital/uang tunai.
   Contoh:
   - "tf ke gopay dari jago 50rb" -> fromAccount: "Jago", toAccount: "GoPay"
   - "kemarin transfer dari bca ke jago 100k" -> fromAccount: "BCA", toAccount: "Jago"
   - "top up shopeepay 20rb pake bca admin 1000" -> fromAccount: "BCA", toAccount: "ShopeePay", adminFee: 1000
   - "kemarin ada uang masuk 50000 ke jago karena tuker uang tunai" -> fromAccount: "Uang Tunai", toAccount: "Jago", description: "Tukar uang tunai ke Jago"
   - "tukar tunai 50rb ke jago" -> fromAccount: "Uang Tunai", toAccount: "Jago"
   - "tarik tunai 100rb dari bca" -> fromAccount: "BCA", toAccount: "Uang Tunai"
   - "setor tunai 200rb ke mandiri" -> fromAccount: "Uang Tunai", toAccount: "Mandiri"
   Format JSON:
   {
     "action": "transfer",
     "amount": number (angka nominal tanpa titik/koma, misal 50000),
     "fromAccount": string (pilih akun sumber dari Daftar Akun yang Dikenal, misal "Uang Tunai" atau "Jago"),
     "toAccount": string (pilih akun tujuan dari Daftar Akun yang Dikenal, misal "Jago" atau "GoPay"),
     "adminFee": number (jika ada biaya admin, jika tidak ada isi 0),
     "description": string (keterangan singkat, misal "Tukar uang tunai ke Jago"),
     "date": string (format YYYY-MM-DD)
   }

3. "single": Catatan pengeluaran atau pemasukan biasa (bukan transfer antar akun).
   - Pemasukan (type: "income"):
     Contoh: "gaji 10jt masuk mandiri", "ada uang masuk 100rb ke jago dari teman", "dapat bonus 200k di bca"
   - Pengeluaran (type: "expense"):
     Contoh: "kemarin saya makan bakso 25rb pake gopay", "kemarin keluar 50rb buat bensin", "2 hari lalu beli pulsa 50k bca", "beli kopi 25rb cash"
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
                await handleShowHistory(chatId, activeClerkUserId, messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika action == "chat"
            if (parsed.action === "chat") {
                await sendTelegramMessage(chatId, parsed.reply || "Halo! Ada yang bisa saya bantu catat hari ini?", messageId);
                return NextResponse.json({ ok: true });
            }

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

                const transferOps = [
                    db.transaction.create({
                        data: {
                            description: parsed.description || `Transfer ke ${toAccount}`,
                            amount: amount,
                            type: "expense",
                            account: fromAccount,
                            category: "Top Up & Tabungan",
                            date: transDate,
                            userId: activeClerkUserId,
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
                            userId: activeClerkUserId,
                        },
                    }),
                ];

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
                                userId: activeClerkUserId,
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
                        userId: activeClerkUserId,
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
