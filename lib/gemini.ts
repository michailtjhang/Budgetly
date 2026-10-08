import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let cachedGeminiModel: string | null = null;

export async function getAvailableGeminiModel(): Promise<string> {
    if (cachedGeminiModel) return cachedGeminiModel;
    
    try {
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY tidak dikonfigurasi.");
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        if (res.ok) {
            const data = await res.json();
            const validModels = (data.models || [])
                .filter((m: { name: string; supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent") && m.name.startsWith("models/gemini-"))
                .map((m: { name: string }) => m.name.replace("models/", ""));
            
            // Prioritaskan model flash yang cepat dan murah
            const preferred = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"];
            for (const p of preferred) {
                if (validModels.includes(p)) {
                    cachedGeminiModel = p;
                    return p;
                }
            }
            // Fallback ke model gemini pertama yang tersedia
            if (validModels.length > 0) {
                cachedGeminiModel = validModels[0];
                return validModels[0];
            }
        }
    } catch (e) {
        console.error("[Gemini] Error fetching dynamic Gemini models:", e);
    }
    
    // Fallback darurat
    return "gemini-1.5-flash";
}

export function resetGeminiModelCache() {
    cachedGeminiModel = null;
}
