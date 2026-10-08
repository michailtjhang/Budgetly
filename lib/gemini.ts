import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Model prioritas (gemini-3.8-flash adalah model generasi terbaru yang direkomendasikan Google)
const PREFERRED_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.8-flash-lite",
    "gemini-3.8-pro",
    "gemini-3.0-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
];

// Model yang diketahui sudah discontinued / tidak tersedia untuk user baru
const blacklistedModels = new Set<string>([
    "gemini-2.5-flash",
    "gemini-pro",
]);

let cachedGeminiModel: string | null = null;

export async function getCandidateGeminiModels(): Promise<string[]> {
    const candidates: string[] = [];

    // Jika sudah ada model yang terbukti berhasil sebelumnya, taruh di paling awal
    if (cachedGeminiModel && !blacklistedModels.has(cachedGeminiModel)) {
        candidates.push(cachedGeminiModel);
    }

    // 1. Ambil daftar model dinamis dari Google API
    try {
        if (GEMINI_API_KEY) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
            if (res.ok) {
                const data = await res.json();
                const validModels: string[] = (data.models || [])
                    .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
                        m.supportedGenerationMethods?.includes("generateContent") && m.name.startsWith("models/gemini-")
                    )
                    .map((m: { name: string }) => m.name.replace("models/", ""));

                // Urutkan berdasarkan preferensi
                for (const p of PREFERRED_MODELS) {
                    if (validModels.includes(p) && !blacklistedModels.has(p) && !candidates.includes(p)) {
                        candidates.push(p);
                    }
                }

                // Tambahkan sisa model valid lainnya
                for (const m of validModels) {
                    if (!blacklistedModels.has(m) && !candidates.includes(m)) {
                        candidates.push(m);
                    }
                }
            }
        }
    } catch (e) {
        console.error("[Gemini] Error fetching dynamic Gemini models:", e);
    }

    // 2. Tambahkan preferred models statis jika belum ada di list
    for (const p of PREFERRED_MODELS) {
        if (!blacklistedModels.has(p) && !candidates.includes(p)) {
            candidates.push(p);
        }
    }

    // Selalu pastikan minimal gemini-3.8-flash ada di antrean
    if (!candidates.includes("gemini-3.8-flash") && !blacklistedModels.has("gemini-3.8-flash")) {
        candidates.unshift("gemini-3.8-flash");
    }

    return candidates.length > 0 ? candidates : ["gemini-3.8-flash"];
}

export async function getAvailableGeminiModel(): Promise<string> {
    const candidates = await getCandidateGeminiModels();
    return candidates[0] || "gemini-3.8-flash";
}

export function resetGeminiModelCache() {
    cachedGeminiModel = null;
}

export type GenerateContentInput = Parameters<
    ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]
>[0];

/**
 * Memanggil Gemini API dengan retry dan fallback otomatis ke model lain
 * jika terjadi error 404 / deprecated / unavailable pada model tertentu.
 */
export async function generateGeminiContent(contents: GenerateContentInput): Promise<string> {
    const candidates = await getCandidateGeminiModels();
    let lastError: unknown = null;

    for (const modelName of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(contents);
            const text = result.response.text().trim();

            // Berhasil! Tandai model ini sebagai model aktif
            cachedGeminiModel = modelName;
            return text;
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[Gemini] Model ${modelName} gagal: ${errMsg}. Mencoba model alternatif...`);
            lastError = err;

            // Jika error 404, not found, deprecated, atau unsupported -> blacklist model ini
            if (
                errMsg.includes("404") ||
                errMsg.includes("not found") ||
                errMsg.includes("no longer available") ||
                errMsg.includes("not supported")
            ) {
                blacklistedModels.add(modelName);
                if (cachedGeminiModel === modelName) {
                    cachedGeminiModel = null;
                }
            }
        }
    }

    throw lastError || new Error("Semua kandidat model Gemini gagal dieksekusi.");
}
