import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Request logger
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  app.post("/api/analyze", async (req, res) => {
    console.log("Received request to /api/analyze");
    try {
      const { imageBase64, mimeType, text, patientProfile } = req.body;
      
      if (!imageBase64 && !text) {
        console.warn("Empty request body");
        return res.status(400).json({ error: "Request body is empty" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      console.log("Calling Gemini API...");
      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      const profileContext = patientProfile ? `[HỒ SƠ SỨC KHỎE BỆNH NHÂN: ${patientProfile}]\n\n` : "";
      const prompt = `${profileContext}YÊU CẦU NGƯỜI DÙNG: "${text || "Hãy bóc tách đơn thuốc trong ảnh và phân tích chi tiết giúp tôi."}"`;

      const parts: any[] = [{ text: prompt }];
      if (imageBase64 && mimeType) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: imageBase64,
          },
        });
      }

      const result = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
        },
      });

      console.log("Gemini API call successful");
      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Server API Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/speech", async (req, res) => {
    console.log("Received request to /api/speech");
    try {
      const { text } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const cleanText = "Dựa trên hồ sơ của bạn, Dược sĩ AI tư vấn: " + text.replace(/[*#|]/g, '').slice(0, 500);

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
      res.json({ audio: base64Audio });
    } catch (error: any) {
      console.error("Server Speech Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Error handler for JSON parsing or other middleware errors
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express Middleware Error:", err);
    res.status(err.status || 500).json({ error: err.message || "Middleware Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
