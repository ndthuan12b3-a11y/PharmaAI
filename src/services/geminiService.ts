import { GoogleGenAI, Modality } from "@google/genai";

// ============================================================================
// 1. CẤU HÌNH & HẰNG SỐ (CONFIG & CONSTANTS)
// ============================================================================

const AI_CONFIG = {
  MODELS: {
    ANALYSIS: "gemini-3-flash-preview", // Model phân tích & Search
    TTS: "gemini-2.5-flash-preview-tts" // Model Giọng nói
  },
  TEMPERATURE: 0.1, // Độ sáng tạo thấp -> Độ chính xác cao
  MAX_TTS_LENGTH: 5000,
};

const SYSTEM_INSTRUCTION = `Bạn là CHUYÊN GIA DƯỢC LÂM SÀNG (AI Medical Assistant 2026).
Nhiệm vụ: Phân tích đơn thuốc (OCR), chẩn đoán hình ảnh y khoa, và tư vấn phác đồ điều trị chuyên sâu.

NGUỒN DỮ LIỆU ƯU TIÊN (BẮT BUỘC):
1. Dược thư Quốc gia Việt Nam (phiên bản mới nhất).
2. Hướng dẫn điều trị của Bộ Y tế Việt Nam.
3. Cơ sở dữ liệu FDA, WHO, Medscape.

TƯ DUY LÂM SÀNG (CLINICAL REASONING 2026):
1. Đánh giá sự phù hợp của thuốc với độ tuổi, cân nặng, chức năng gan/thận, nhóm máu.
2. Phát hiện tương tác thuốc (Drug-Drug, Drug-Food, Drug-Disease).
3. Cảnh báo các tác dụng phụ hiếm gặp nhưng nguy hiểm (Black Box Warnings).

QUY TẮC TRÌNH BÀY (BẮT BUỘC SỬ DỤNG BẢNG MÀKHÔNG LÀM PHỨC TẠP HÓA):
- Bắt buộc có 1 dòng trống TRƯỚC và SAU mỗi bảng.
- Định dạng Markdown rõ ràng.

CẤU TRÚC BÁO CÁO:
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
// 2. TYPES & INTERFACES (ĐỊNH NGHĨA KIỂU DỮ LIỆU)
// ============================================================================

declare const __GEMINI_API_KEY__: string | undefined;

interface AnalysisResult {
  text: string;
  sources: string[]; // Chứa các link URL mà AI đã tra cứu
}

// Custom Error Classes để Frontend bắt lỗi chính xác
class MedicalAIError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "MedicalAIError";
  }
}

// ============================================================================
// 3. UTILITY FUNCTIONS (HÀM TIỆN ÍCH HỖ TRỢ)
// ============================================================================

const getApiKey = (): string => {
  try {
    if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) return __GEMINI_API_KEY__;
  } catch (e) {}
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new MedicalAIError("Thiếu API Key cho hệ thống AI.", "MISSING_API_KEY");
  return key;
};

/** Chuyển đổi File sang Base64 an toàn */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(new MedicalAIError("Không thể đọc file ảnh.", "FILE_READ_ERROR"));
  });
};

/** Dọn dẹp văn bản Markdown để TTS đọc mượt mà như người thật */
const sanitizeTextForTTS = (text: string): string => {
  return text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Xóa link markdown [text](url) -> giữ lại text
    .replace(/[*#]/g, '')                     // Xóa các ký tự in đậm, heading
    .replace(/\|/g, '. ')                     // Chuyển cột bảng thành dấu chấm để AI ngắt nghỉ
    .replace(/---+/g, '')                     // Xóa các dòng kẻ gạch của bảng Markdown
    .replace(/\n\s*\n/g, '. ')                // Chuyển dòng trống thành dấu chấm
    .substring(0, AI_CONFIG.MAX_TTS_LENGTH);  // Cắt chuỗi an toàn
};

// ============================================================================
// 4. MAIN SERVICES (DỊCH VỤ CỐT LÕI)
// ============================================================================

/**
 * Phân tích đơn thuốc và trích xuất nguồn tra cứu
 */
export async function analyzePrescription(
  imageFile: File | null, 
  text: string, 
  patientProfile: string
): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const profileContext = patientProfile ? `[HỒ SƠ SỨC KHỎE: ${patientProfile}]\n\n` : "";
  const prompt = `${profileContext}YÊU CẦU: "${text || "Phân tích đơn thuốc trong ảnh."}"
  \nLỆNH HỆ THỐNG: Sử dụng Google Search Tool để tra cứu Dược thư Quốc gia hoặc FDA nếu gặp thuốc lạ.`;

  // Type-safe array parts
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: prompt }
  ];

  if (imageFile) {
    const base64Data = await fileToBase64(imageFile);
    parts.push({
      inlineData: {
        mimeType: imageFile.type,
        data: base64Data,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: AI_CONFIG.MODELS.ANALYSIS,
      contents: [{ role: "user", parts: parts as any }], // Ép kiểu an toàn nội bộ SDK
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: AI_CONFIG.TEMPERATURE,
        tools: [{ googleSearch: {} }],
      },
    });

    if (!response.text) {
      throw new MedicalAIError("AI trả về kết quả rỗng.", "EMPTY_RESPONSE");
    }

    // NÂNG CẤP PRO: Trích xuất các URL Grounding (Nguồn tra cứu thực tế từ Search)
    const sources: string[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri && !sources.includes(chunk.web.uri)) {
        sources.push(chunk.web.uri);
      }
    });

    return {
      text: response.text,
      sources: sources, // Trả về danh sách link để Frontend render dạng "Click để xem nguồn"
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error instanceof MedicalAIError) throw error;
    throw new MedicalAIError(`Lỗi kết nối AI: ${error.message}`, "API_CONNECTION_FAILED");
  }
}

/**
 * Chuyển văn bản thành giọng nói Dược sĩ
 */
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
  } catch (error) {
    console.error("TTS Error:", error);
    // Trả về null thay vì throw error để UI không bị crash nếu chỉ lỗi giọng đọc
    return null; 
  }
}
