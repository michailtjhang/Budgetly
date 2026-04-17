import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CATEGORY_OPTIONS = [
    "Makanan & Minuman",
    "Belanja & Pakaian",
    "Kesehatan & Skincare",
    "Investasi & Saham",
    "Top Up & Tabungan",
    "Komunikasi & Internet",
    "Ibadah & Sosial",
    "Tempat Tinggal",
    "Hobby & Gaming",
    "Elektronik",
    "Transportasi",
    "Biaya Admin & Pajak",
    "Pendidikan",
    "Tagihan",
    "Penghasilan",
    "Lainnya",
];

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Tidak ada gambar yang dikirim." }, { status: 400 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif";

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Kamu adalah asisten keuangan pintar. Analisis gambar struk/invoice/nota/bukti transaksi ini dan ekstrak informasi berikut dalam format JSON.

Aturan:
- "description": nama toko, merchant, atau deskripsi singkat transaksi (maks 50 karakter)
- "amount": total nominal yang dibayar, hanya angka tanpa titik/koma/simbol mata uang
- "date": tanggal transaksi dalam format YYYY-MM-DD. Jika tidak ada tanggal, gunakan tanggal hari ini: ${new Date().toISOString().split("T")[0]}
- "type": "expense" jika ini pengeluaran/pembelian, "income" jika ini penerimaan/pemasukan
- "category": pilih SATU yang paling sesuai dari daftar ini: ${CATEGORY_OPTIONS.join(", ")}
- "confidence": nilai antara 0-1 seberapa yakin kamu bisa membaca struk ini

Jika gambar BUKAN struk/invoice/bukti transaksi, kembalikan: {"error": "Gambar bukan struk atau tidak terbaca"}

Kembalikan HANYA JSON, tanpa teks lain, tanpa markdown, tanpa backtick.

Contoh output yang benar:
{"description":"Indomaret - Snack & Minuman","amount":45000,"date":"2025-04-17","type":"expense","category":"Makanan & Minuman","confidence":0.95}`;

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64,
                    mimeType,
                },
            },
            prompt,
        ]);

        const responseText = result.response.text().trim();

        // Attempt to parse JSON — sometimes Gemini wraps in ```json
        let cleaned = responseText;
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/```(?:json)?\n?/g, "").replace(/```$/g, "").trim();
        }

        const parsed = JSON.parse(cleaned);

        if (parsed.error) {
            return NextResponse.json({ error: parsed.error }, { status: 422 });
        }

        return NextResponse.json({
            description: String(parsed.description || ""),
            amount: Number(parsed.amount) || 0,
            date: String(parsed.date || new Date().toISOString().split("T")[0]),
            type: parsed.type === "income" ? "income" : "expense",
            category: CATEGORY_OPTIONS.includes(parsed.category) ? parsed.category : "Lainnya",
            confidence: Number(parsed.confidence) || 0,
        });
    } catch (err) {
        console.error("[scan-invoice] Error:", err);
        return NextResponse.json(
            { error: "Gagal menganalisis gambar. Coba lagi dengan foto yang lebih jelas." },
            { status: 500 }
        );
    }
}
