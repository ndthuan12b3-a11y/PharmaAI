import { GoogleGenAI, Modality } from "@google/genai";

// ============================================================================
// 1. CẤU HÌNH & HẰNG SỐ (CONFIG & CONSTANTS)
// ============================================================================

const AI_CONFIG = {
  MODELS: {
    ANALYSIS: "gemini-3-flash-preview", 
    TTS: "gemini-2.5-flash-preview-tts" 
  },
  TEMPERATURE: 0.1, // Giữ độ chính xác cao nhất cho Y tế
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

// ============================================================================
// 2. TYPES & INTERFACES
// ============================================================================

declare const __GEMINI_API_KEY__: string | undefined;

export interface AnalysisResult {
  text: string;
  sources: string[];
}

export class MedicalAIError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "MedicalAIError";
  }
}

// ============================================================================
// 3. UTILITY FUNCTIONS & CACHING
// ============================================================================

// Bộ nhớ đệm giúp tiết kiệm API Quota (Lưu kết quả phân tích trùng lặp)
const analysisCache = new Map<string, AnalysisResult>();

const getApiKey = (): string => {
  try {
    if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
      return __GEMINI_API_KEY__;
    }
  } catch (e) {}
  
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new MedicalAIError("Hệ thống thiếu API Key.", "MISSING_API_KEY");
  return key;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new MedicalAIError("Không thể đọc file ảnh.", "FILE_READ_ERROR"));
  });
};

const sanitizeTextForTTS = (text: string): string => {
  return text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Xóa link markdown
    .replace(/[*#]/g, '')                     // Xóa ký tự in đậm, heading
    .replace(/\|/g, '. ')                     // Chuyển cột bảng thành ngắt nghỉ
    .replace(/---+/g, '')                     // Xóa viền bảng
    .replace(/\n\s*\n/g, '. ')                // Ngắt câu ở dòng trống
    .substring(0, AI_CONFIG.MAX_TTS_LENGTH);
};

// ============================================================================
// 4. MAIN SERVICES
// ============================================================================

export async function analyzePrescription(
  imageFile: File | null, 
  text: string, 
  patientProfile: string
): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  let base64Data = "";
  if (imageFile) {
    base64Data = await fileToBase64(imageFile);
  }

  // TẠO KHÓA CACHE: Nếu cùng ảnh, cùng câu hỏi, cùng hồ sơ -> Lấy từ bộ nhớ
  const cacheKey = `${text.length}_${base64Data.length}_${patientProfile.length}`;
  if (analysisCache.has(cacheKey)) {
    console.log("⚡ Đã tải kết quả từ Cache, không gọi API.");
    return analysisCache.get(cacheKey)!;
  }

  const profileContext = patientProfile ? `[HỒ SƠ SỨC KHỎE: ${patientProfile}]\n\n` : "";
  const prompt = `${profileContext}YÊU CẦU: "${text || "Phân tích đơn thuốc trong ảnh."}"
  \nLỆNH HỆ THỐNG: Sử dụng Google Search Tool để tra cứu Dược thư Quốc gia hoặc FDA nếu gặp biệt dược lạ hoặc cần đối chiếu tương tác thuốc.`;

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
        tools: [{ googleSearch: {} }] // Kích hoạt công cụ tra cứu
      },
    });

    if (!response.text) {
      throw new MedicalAIError("AI không thể phân tích, kết quả rỗng.", "EMPTY_RESPONSE");
    }

    // Trích xuất link nguồn tra cứu
    const sources: string[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri && !sources.includes(chunk.web.uri)) {
        sources.push(chunk.web.uri);
      }
    });

    const result: AnalysisResult = {
      text: response.text,
      sources: sources,
    };

    // Lưu vào cache để dùng cho lần sau
    analysisCache.set(cacheKey, result);

    return result;

  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    
    // BẮT LỖI QUOTA (429) HOẶC EXHAUSTED
    const errorMessage = error.message?.toLowerCase() || "";
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted")) {
      throw new MedicalAIError(
        "Đã hết hạn mức sử dụng AI tạm thời. Hệ thống đang quá tải, vui lòng thử lại sau vài phút.", 
        "QUOTA_EXCEEDED"
      );
    }

    if (error instanceof MedicalAIError) throw error;
    throw new MedicalAIError(`Lỗi hệ thống: ${error.message}`, "API_CONNECTION_FAILED");
  }
}

export async function generateSpeech(text: string): Promise<string | null> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const pharmacistIntro = "Dưới đây là tư vấn từ trợ lý dược sĩ: ";
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
  } catch (error: any) {
    console.error("TTS Error:", error);
    // Nếu hết Quota khi đọc giọng nói, chỉ log ra chứ không làm sập ứng dụng (vẫn hiện text bình thường)
    return null; 
  }
}
