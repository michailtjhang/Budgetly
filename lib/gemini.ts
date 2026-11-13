import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import type { Interactions } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
export const genAIv2 = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Model prioritas (gemini-4-hydrogen model eksperimental terbaru diutamakan, dengan fallback ke gemini-3.8-flash)
const PREFERRED_MODELS = [
    "models/gemini-4-hydrogen",
    "gemini-4-hydrogen",
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
                    const cleanP = p.replace("models/", "");
                    if ((validModels.includes(cleanP) || p.includes("gemini-4-hydrogen")) && !blacklistedModels.has(p) && !candidates.includes(p)) {
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

    // Pastikan models/gemini-4-hydrogen dan gemini-3.8-flash tetap ada di antrean
    if (!candidates.includes("models/gemini-4-hydrogen") && !blacklistedModels.has("models/gemini-4-hydrogen")) {
        candidates.unshift("models/gemini-4-hydrogen");
    }

    return candidates.length > 0 ? candidates : ["models/gemini-4-hydrogen", "gemini-3.8-flash"];
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
 * Mendukung SDK @google/genai baru (Interactions API / gemini-4-hydrogen) serta fallback @google/generative-ai.
 */
export async function generateGeminiContent(contents: GenerateContentInput | string): Promise<string> {
    const candidates = await getCandidateGeminiModels();
    let lastError: unknown = null;

    for (const rawModelName of candidates) {
        const normalizedName = rawModelName.replace(/^models\//, "");

        // 1. Coba gunakan @google/genai Interactions API (khusus teks & model gemini-4-hydrogen / models baru)
        if (typeof contents === "string" && genAIv2 && (rawModelName.includes("gemini-4-hydrogen") || rawModelName.includes("hydrogen"))) {
            try {
                const tools: Interactions.Tool[] = [
                    {
                        type: "google_search",
                    },
                ];

                const interaction = await genAIv2.interactions.create({
                    model: rawModelName.startsWith("models/") ? rawModelName : `models/${rawModelName}`,
                    input: contents,
                    tools: tools,
                    generation_config: {
                        max_output_tokens: 65536,
                        thinking_level: "high",
                    },
                });

                const lastStep = interaction.steps?.at(-1);
                if (lastStep && typeof lastStep === "object") {
                    const stepRecord = lastStep as Record<string, unknown>;
                    if (typeof stepRecord.text === "string" && stepRecord.text.trim()) {
                        cachedGeminiModel = rawModelName;
                        return stepRecord.text.trim();
                    }
                    if (Array.isArray(stepRecord.content)) {
                        const extracted = stepRecord.content
                            .map((c: unknown) => {
                                if (c && typeof c === "object" && "parts" in c && Array.isArray((c as { parts: unknown[] }).parts)) {
                                    return (c as { parts: { text?: string }[] }).parts
                                        .map((p) => p.text || "")
                                        .join("");
                                }
                                return "";
                            })
                            .join("")
                            .trim();
                        if (extracted) {
                            cachedGeminiModel = rawModelName;
                            return extracted;
                        }
                    }
                }
            } catch (interactionErr: unknown) {
                const errMsg = interactionErr instanceof Error ? interactionErr.message : String(interactionErr);
                console.warn(`[Gemini GenAIv2 Interaction] Model ${rawModelName} gagal: ${errMsg}. Mencoba generateContent fallback...`);
                // Blacklist model ini jika not found / permission / unhandled
                if (errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("400") || errMsg.includes("403")) {
                    blacklistedModels.add(rawModelName);
                }
            }
        }

        // 2. Fallback standar via generateContent (@google/generative-ai)
        try {
            const model = genAI.getGenerativeModel({ model: normalizedName });
            const result = await model.generateContent(contents as GenerateContentInput);
            const text = result.response.text().trim();

            // Berhasil! Tandai model ini sebagai model aktif
            cachedGeminiModel = normalizedName;
            return text;
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[Gemini] Model ${normalizedName} gagal: ${errMsg}. Mencoba model alternatif...`);
            lastError = err;

            // Jika error 404, not found, deprecated, atau unsupported -> blacklist model ini
            if (
                errMsg.includes("404") ||
                errMsg.includes("not found") ||
                errMsg.includes("no longer available") ||
                errMsg.includes("not supported")
            ) {
                blacklistedModels.add(rawModelName);
                blacklistedModels.add(normalizedName);
                if (cachedGeminiModel === rawModelName || cachedGeminiModel === normalizedName) {
                    cachedGeminiModel = null;
                }
            }
        }
    }

    throw lastError || new Error("Semua kandidat model Gemini gagal dieksekusi.");
}
