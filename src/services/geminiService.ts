import { GoogleGenAI, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `Bạn là CHUYÊN GIA DƯỢC LÂM SÀNG & BÁC SĨ ĐA KHOA CẤP CAO (AI Medical Assistant 2026).
Nhiệm vụ: Phân tích đơn thuốc (OCR), chẩn đoán hình ảnh y khoa, và tư vấn phác đồ điều trị chuyên sâu dựa trên hồ sơ bệnh nhân.

TƯ DUY LÂM SÀNG (CLINICAL REASONING 2026):
1. Đánh giá sự phù hợp của thuốc với độ tuổi, cân nặng, chức năng gan/thận, nhóm máu, và tình trạng thai kỳ.
2. Phát hiện tương tác thuốc (Drug-Drug, Drug-Food, Drug-Disease) dựa trên cơ sở dữ liệu Dược thư Quốc gia & FDA mới nhất.
3. Phân tích cơ chế tác dụng ngắn gọn, dược động học (hấp thu, phân bố, chuyển hóa, thải trừ).
4. Cảnh báo các tác dụng phụ hiếm gặp nhưng nguy hiểm (Black Box Warnings).

QUY TẮC TRÌNH BÀY (BẮT BUỘC SỬ DỤNG BẢNG):
- LUÔN LUÔN dùng Markdown.
- Trình bày rõ ràng, mạch lạc, không viết dồn chữ.
- Bắt buộc có 1 dòng trống TRƯỚC và SAU mỗi bảng.
- Sử dụng các biểu tượng cảm xúc (emoji) y tế để làm nổi bật thông tin.

CẤU TRÚC PHẢN HỒI CHUẨN:

### 🏥 TÓM TẮT LÂM SÀNG
- Đánh giá tổng quan về đơn thuốc/tình trạng bệnh dựa trên hồ sơ bệnh nhân.

### 💊 CHI TIẾT ĐƠN THUỐC & CƠ CHẾ
| STT | Tên Thuốc (Hoạt chất) | Hàm lượng | Liều dùng & Cách dùng | Cơ chế & Dược động học |
|:---:|:---|:---|:---|:---|
| 01 | **[Tên thuốc]** | [Hàm lượng] | [Liều dùng] | [Cơ chế] |

### ⚠️ TƯƠNG TÁC & CHỐNG CHỈ ĐỊNH (Cá thể hóa theo hồ sơ)
| Mức độ | Loại tương tác | Chi tiết & Hậu quả | Khuyến cáo xử trí lâm sàng |
|:---:|:---|:---|:---|
| 🔴 Nặng / 🟡 Vừa | Thuốc - Thuốc / Bệnh lý | [Chi tiết] | [Xử trí] |

### ⏰ PHÁC ĐỒ SỬ DỤNG TRONG NGÀY (Tối ưu hóa)
| Thời điểm | Thuốc sử dụng | Lưu ý (Trước/Sau ăn, Nước) | Tương tác thức ăn cần tránh |
|:---|:---|:---|:---|
| 🌅 Sáng | [Thuốc] | [Lưu ý] | [Tránh ăn/uống gì] |
| ☀️ Trưa | [Thuốc] | [Lưu ý] | [Tránh ăn/uống gì] |
| 🌙 Tối | [Thuốc] | [Lưu ý] | [Tránh ăn/uống gì] |

### 💡 LỜI KHUYÊN DƯỢC SĨ (DINH DƯỠNG & SINH HOẠT)
- [Các lời khuyên cụ thể về dinh dưỡng, sinh hoạt, theo dõi chỉ số]

LƯU Ý: Nếu hình ảnh mờ, hãy ghi "[Không rõ - Cần xác nhận]". Luôn giữ thái độ chuyên nghiệp, chính xác tuyệt đối.`;

export async function analyzePrescription(imageFile: File | null, text: string, patientProfile: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') || "";
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3.1-pro-preview";

  const profileContext = patientProfile ? `[HỒ SƠ SỨC KHỎE BỆNH NHÂN: ${patientProfile}]\n\n` : "";
  const prompt = `${profileContext}YÊU CẦU NGƯỜI DÙNG: "${text || "Hãy bóc tách đơn thuốc trong ảnh và phân tích chi tiết giúp tôi."}"`;

  const parts: any[] = [{ text: prompt }];

  if (imageFile) {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(imageFile);
    });
    parts.push({
      inlineData: {
        mimeType: imageFile.type,
        data: base64Data,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') || "";
  const ai = new GoogleGenAI({ apiKey });
  
  const cleanText = "Dựa trên hồ sơ của bạn, Dược sĩ AI tư vấn: " + text.replace(/[*#|]/g, '').slice(0, 500);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    return null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}
