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

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(amount);
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

3️⃣ <b>Kirim Foto Struk / QRIS / Bukti Transfer:</b>
• Langsung kirim foto screenshot QRIS atau bukti transfer!
• AI otomatis mendeteksi nominal, merchant, dan rekening pengeluaran.

📊 <b>Perintah Tambahan:</b>
• /saldo - Cek rincian saldo semua rekening & e-wallet
• /rekap - Ringkasan pemasukan & pengeluaran bulan ini`;

            await sendTelegramMessage(chatId, welcomeText, messageId);
            return NextResponse.json({ ok: true });
        }

        // 2. Handle Command: /saldo
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
                .filter(([_, bal]) => bal !== 0)
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

        // 3. Handle Command: /rekap
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

        // 4. Handle Foto (Screenshot QRIS / Bukti Transfer / Struk)
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

            // Analisis gambar dengan Gemini AI
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
                const geminiRes = await model.generateContent([
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: "image/jpeg",
                        },
                    },
                    prompt,
                ]);
                geminiText = geminiRes.response.text().trim();
            } catch (err: any) {
                console.error("[Telegram] Gemini Vision Error:", err);
                await sendTelegramMessage(chatId, `❌ Gagal memproses gambar dengan AI: ${err.message || "Error"}`, messageId);
                return NextResponse.json({ ok: true });
            }

            // Clean markdown blocks if any
            let cleanedJson = geminiText;
            if (cleanedJson.startsWith("```")) {
                cleanedJson = cleanedJson.replace(/```(?:json)?\n?/g, "").replace(/```$/g, "").trim();
            }

            let parsedData: any = {};
            try {
                parsedData = JSON.parse(cleanedJson);
            } catch (e) {
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
            if (parsedData.isTransfer && parsedData.fromAccount && parsedData.toAccount) {
                const fromAcc = ACCOUNT_OPTIONS.includes(parsedData.fromAccount) ? parsedData.fromAccount : "Lainnya";
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
                    `📅 <b>Tanggal:</b> ${transDate.toISOString().split("T")[0]}`;

                await sendTelegramMessage(chatId, replyMsg, messageId);
                return NextResponse.json({ ok: true });
            }

            // Transaksi pengeluaran/pemasukan biasa (misal QRIS belanja)
            const type = parsedData.type === "income" ? "income" : "expense";
            const account = ACCOUNT_OPTIONS.includes(parsedData.account) ? parsedData.account : (parsedData.account || "Lainnya");
            const category = CATEGORY_OPTIONS.includes(parsedData.category) ? parsedData.category : "Lainnya";
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
                `📅 <b>Tanggal:</b> ${transDate.toISOString().split("T")[0]}`;

            await sendTelegramMessage(chatId, replyMsg, messageId);
            return NextResponse.json({ ok: true });
        }

        // 5. Handle Chat Teks (NLP Gemini)
        if (text) {
            await sendChatAction(chatId, "typing");
            const todayStr = new Date().toISOString().split("T")[0];

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `Kamu adalah asisten pencatat keuangan cerdas untuk aplikasi Budgetly.
Tugasmu adalah menganalisis pesan pengguna: "${text}"

Daftar Akun yang Dikenal: ${ACCOUNT_OPTIONS.join(", ")}
Daftar Kategori: ${CATEGORY_OPTIONS.join(", ")}
Tanggal Hari Ini: ${todayStr}

KEMUNGKINAN INTENT:
1. "transfer": Pemindahan dana, top-up, atau tf antar akun/rekening/dompet digital.
   Contoh: "tf ke gopay dari jago 50rb", "transfer dari bca ke jago 100k", "top up shopeepay 20rb pake bca admin 1000", "pindah dana 500rb dari mandiri ke bibit"
   Format JSON:
   {
     "action": "transfer",
     "amount": number (angka nominal tanpa titik/koma, misal 50000),
     "fromAccount": string (pilih akun sumber dari Daftar Akun yang Dikenal, misal "Jago"),
     "toAccount": string (pilih akun tujuan dari Daftar Akun yang Dikenal, misal "GoPay"),
     "adminFee": number (jika ada biaya admin, jika tidak ada isi 0),
     "description": string (keterangan singkat, misal "Transfer Jago ke GoPay")
   }

2. "single": Catatan pengeluaran atau pemasukan biasa.
   Contoh: "makan bakso 25rb pake gopay", "bensin 35k tunai", "gaji 10jt masuk mandiri", "beli kopi 20rb", "dapet transferan 150rb di bca"
   Format JSON:
   {
     "action": "single",
     "type": "expense" | "income",
     "amount": number (angka nominal murni),
     "account": string (pilih dari Daftar Akun yang Dikenal, jika tidak disebutkan gunakan "Uang Tunai" atau "Lainnya"),
     "category": string (pilih kategori paling cocok dari Daftar Kategori),
     "description": string (keterangan pengeluaran/pemasukan)
   }

3. "chat": Jika pesan hanya sapaan atau percakapan biasa dan bukan transaksi keuangan.
   Format JSON:
   {
     "action": "chat",
     "reply": string (balasan ramah dalam bahasa Indonesia)
   }

KEMBALIKAN HANYA JSON MURNI TANPA BACKTICK, TANPA MARKDOWN.`;

            let geminiReply = "";
            try {
                const result = await model.generateContent(prompt);
                geminiReply = result.response.text().trim();
            } catch (err: any) {
                console.error("[Telegram] Gemini Text Error:", err);
                await sendTelegramMessage(chatId, `❌ Gagal memproses pesan: ${err.message || "Error"}`, messageId);
                return NextResponse.json({ ok: true });
            }

            let cleanedJson = geminiReply;
            if (cleanedJson.startsWith("```")) {
                cleanedJson = cleanedJson.replace(/```(?:json)?\n?/g, "").replace(/```$/g, "").trim();
            }

            let parsed: any = {};
            try {
                parsed = JSON.parse(cleanedJson);
            } catch (e) {
                await sendTelegramMessage(chatId, "⚠️ Maaf, saya tidak dapat memahami format transaksi tersebut. Coba contoh: <i>'tf ke gopay dari jago 50rb'</i> atau <i>'makan bakso 25rb pake bca'</i>", messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika action == "chat"
            if (parsed.action === "chat") {
                await sendTelegramMessage(chatId, parsed.reply || "Halo! Ada yang bisa saya bantu catat hari ini?", messageId);
                return NextResponse.json({ ok: true });
            }

            // Jika action == "transfer"
            if (parsed.action === "transfer") {
                const amount = Number(parsed.amount) || 0;
                const adminFee = Number(parsed.adminFee) || 0;
                const fromAccount = ACCOUNT_OPTIONS.includes(parsed.fromAccount) ? parsed.fromAccount : (parsed.fromAccount || "Lainnya");
                const toAccount = ACCOUNT_OPTIONS.includes(parsed.toAccount) ? parsed.toAccount : (parsed.toAccount || "Lainnya");

                if (amount <= 0) {
                    await sendTelegramMessage(chatId, "⚠️ Nominal transfer tidak boleh 0.", messageId);
                    return NextResponse.json({ ok: true });
                }

                // Buat 2 transaksi (expense di akun pengirim, income di akun penerima)
                const dbOps: any[] = [
                    db.transaction.create({
                        data: {
                            description: parsed.description || `Transfer ke ${toAccount}`,
                            amount: amount,
                            type: "expense",
                            account: fromAccount,
                            category: "Top Up & Tabungan",
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
                            userId: CLERK_USER_ID,
                        },
                    }),
                ];

                // Tambahkan biaya admin jika ada
                if (adminFee > 0) {
                    dbOps.push(
                        db.transaction.create({
                            data: {
                                description: `Biaya Admin Transfer ke ${toAccount}`,
                                amount: adminFee,
                                type: "expense",
                                account: fromAccount,
                                category: "Biaya Admin & Pajak",
                                userId: CLERK_USER_ID,
                            },
                        })
                    );
                }

                await db.$transaction(dbOps);

                let replyMsg = `✅ <b>Transfer Berhasil Dicatat!</b>\n\n` +
                    `📤 <b>Keluar:</b> <code>${formatRupiah(amount)}</code> dari <b>${fromAccount}</b>\n` +
                    `📥 <b>Masuk:</b> <code>${formatRupiah(amount)}</code> ke <b>${toAccount}</b>\n`;

                if (adminFee > 0) {
                    replyMsg += `💸 <b>Biaya Admin:</b> <code>${formatRupiah(adminFee)}</code>\n`;
                }
                replyMsg += `📁 <b>Kategori:</b> Top Up & Tabungan\n\n` +
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
                const account = ACCOUNT_OPTIONS.includes(parsed.account) ? parsed.account : (parsed.account || "Uang Tunai");
                const category = CATEGORY_OPTIONS.includes(parsed.category) ? parsed.category : "Lainnya";
                const description = parsed.description || (type === "expense" ? "Pengeluaran" : "Pemasukan");

                await db.transaction.create({
                    data: {
                        description,
                        amount,
                        type,
                        account,
                        category,
                        userId: CLERK_USER_ID,
                    },
                });

                const replyMsg = `${type === "income" ? "🎉 <b>Pemasukan Berhasil Dicatat!</b>" : "✅ <b>Pengeluaran Berhasil Dicatat!</b>"}\n\n` +
                    `📝 <b>Keterangan:</b> ${description}\n` +
                    `💰 <b>Nominal:</b> <code>${formatRupiah(amount)}</code>\n` +
                    `🏦 <b>Akun:</b> ${account}\n` +
                    `📁 <b>Kategori:</b> ${category}`;

                await sendTelegramMessage(chatId, replyMsg, messageId);
                return NextResponse.json({ ok: true });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("[Telegram Webhook] Global Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
