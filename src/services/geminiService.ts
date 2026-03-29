import { GoogleGenAI, Modality } from "@google/genai";

// ============================================================================
// 1. CẤU HÌNH & HẰNG SỐ
// ============================================================================

const AI_CONFIG = {
  MODELS: {
    ANALYSIS: "gemini-3-flash-preview", 
    TTS: "gemini-2.5-flash-preview-tts" 
  },
  TEMPERATURE: 0.1, 
  MAX_TTS_LENGTH: 5000,
};

const SYSTEM_INSTRUCTION = `Bạn là CHUYÊN GIA DƯỢC LÂM SÀNG (AI Medical Assistant 2026).
Nhiệm vụ: Phân tích đơn thuốc (OCR), chẩn đoán hình ảnh y khoa, và tư vấn phác đồ điều trị chuyên sâu.

NGUỒN DỮ LIỆU ƯU TIÊN (BẮT BUỘC):
1. Dược thư Quốc gia Việt Nam (phiên bản mới nhất).
2. Hướng dẫn điều trị của Bộ Y tế Việt Nam.
3. Cơ sở dữ liệu FDA, WHO, Medscape.

TƯ DUY LÂM SÀNG (CLINICAL REASONING 2026):
1. Đánh giá sự phù hợp của thuốc với độ tuổi, cân nặng, chức năng gan/thận.
2. Phát hiện tương tác thuốc (Drug-Drug, Drug-Food, Drug-Disease).
3. Cảnh báo các tác dụng phụ hiếm gặp (Black Box Warnings).

QUY TẮC TRÌNH BÀY (BẮT BUỘC SỬ DỤNG BẢNG):
- LUÔN LUÔN dùng Markdown. Trình bày rõ ràng, mạch lạc.
- Bắt buộc có 1 dòng trống TRƯỚC và SAU mỗi bảng.

CẤU TRÚC PHẢN HỒI CHUẨN:
### 🏥 TÓM TẮT LÂM SÀNG
### 💊 CHI TIẾT ĐƠN THUỐC & CƠ CHẾ
| STT | Tên Thuốc (Hoạt chất) | Hàm lượng | Liều dùng & Cách dùng | Cơ chế & Dược động học |
|:---:|:---|:---|:---|:---|
### ⚠️ TƯƠNG TÁC & CHỐNG CHỈ ĐỊNH
| Mức độ | Loại tương tác | Chi tiết & Hậu quả | Khuyến cáo xử trí lâm sàng |
|:---:|:---|:---|:---|
### ⏰ PHÁC ĐỒ SỬ DỤNG TRONG NGÀY
| Thời điểm | Thuốc sử dụng | Lưu ý (Trước/Sau ăn, Nước) | Tương tác thức ăn cần tránh |
|:---|:---|:---|:---|
### 💡 LỜI KHUYÊN DƯỢC SĨ
### 🔗 NGUỒN THAM KHẢO XÁC THỰC`;

declare const __GEMINI_API_KEY__: string | undefined;

// ============================================================================
// 2. BỘ NHỚ ĐỆM & TIỆN ÍCH (CACHING & UTILS)
// ============================================================================

// Cache bây giờ lưu trực tiếp String để tương thích 100% với Frontend của bạn
const analysisCache = new Map<string, string>();

function getApiKey(): string {
  try {
    if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
      return __GEMINI_API_KEY__;
    }
  } catch (e) {}
  
  const key = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!key) throw new Error("MISSING_API_KEY");
  return key;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
  });
};

// Hàm làm sạch văn bản an toàn
const sanitizeTextForTTS = (text: string): string => {
  // Đảm bảo text luôn là string trước khi gọi .replace để chống sập app
  const safeText = typeof text === 'string' ? text : String(text || "");
  
  return safeText
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') 
    .replace(/[*#]/g, '')                     
    .replace(/\|/g, '. ')                     
    .replace(/---+/g, '')                     
    .replace(/\n\s*\n/g, '. ')                
    .substring(0, AI_CONFIG.MAX_TTS_LENGTH);
};

// ============================================================================
// 3. MAIN SERVICES (TƯƠNG THÍCH 100% VỚI CODE CŨ)
// ============================================================================

export async function analyzePrescription(
  imageFile: File | null, 
  text: string, 
  patientProfile: string
): Promise<string> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  let base64Data = "";
  if (imageFile) {
    base64Data = await fileToBase64(imageFile);
  }

  // Khóa Cache
  const cacheKey = `${(text || "").length}_${base64Data.length}_${(patientProfile || "").length}`;
  if (analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!; // Trả về text luôn
  }

  const profileContext = patientProfile ? `[HỒ SƠ SỨC KHỎE: ${patientProfile}]\n\n` : "";
  const prompt = `${profileContext}YÊU CẦU: "${text || "Hãy bóc tách đơn thuốc trong ảnh và phân tích chi tiết giúp tôi."}"`;

  const parts: any[] = [{ text: prompt }];
  if (base64Data) {
    parts.push({
      inlineData: { mimeType: imageFile!.type, data: base64Data },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: AI_CONFIG.MODELS.ANALYSIS,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: AI_CONFIG.TEMPERATURE,
      },
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    // Lưu vào cache
    analysisCache.set(cacheKey, response.text);

    // Trả về duy nhất 1 chuỗi String như code gốc của bạn
    return response.text;

  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    
    // Bắt lỗi Quota thân thiện
    const errorMessage = error.message?.toLowerCase() || "";
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted")) {
      throw new Error("Lỗi từ AI: Đã hết hạn mức sử dụng tạm thời. Vui lòng thử lại sau vài phút.");
    }

    throw new Error(`Lỗi từ AI: ${error.message || "Không thể kết nối đến Gemini API"}`);
  }
}

export async function generateSpeech(text: string): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  const pharmacistIntro = "Dưới đây là tư vấn từ trợ lý dược sĩ: ";
  // Hàm sanitizeTextForTTS giờ đã có cơ chế tự kiểm tra kiểu dữ liệu an toàn
  const cleanText = pharmacistIntro + sanitizeTextForTTS(text);

  try {
    const response = await ai.models.generateContent({
      model: AI_CONFIG.MODELS.TTS,
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null; 
  }
}
