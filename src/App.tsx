import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  UserCircle, 
  Menu, 
  Microchip, 
  User as UserMd, 
  Pill as Capsules, 
  Receipt as FileInvoiceDollar, 
  Search,
  BookOpen,
  History,
  Settings,
  HelpCircle,
  Stethoscope,
  X,
  ShieldAlert,
  Activity,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzePrescription, generateSpeech } from './services/geminiService';

// Reusable Components
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { Card } from './components/Card';
import { PatientProfileModal, PatientProfile } from './components/PatientProfileModal';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  audio?: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [patientProfile, setPatientProfile] = useState<PatientProfile>(() => {
    const saved = localStorage.getItem('pharmaProfile');
    return saved ? JSON.parse(saved) : { age: '', weight: '', renalHepatic: '', allergy: '', conditions: '', bloodType: '', currentMeds: '', pregnancyStatus: 'Không' };
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Global Paste Listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'vi-VN';
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const handleSend = async (textOverride?: any) => {
    const text = typeof textOverride === 'string' ? textOverride : input;
    if (typeof text !== 'string' || (!text.trim() && !image)) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text || "Hãy phân tích hình ảnh đơn thuốc này." };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentImage = image;
    setImage(null);
    setPreviewUrl(null);
    setIsAnalyzing(true);

    const profileString = `Tuổi: ${patientProfile.age}, Cân nặng: ${patientProfile.weight}kg, Nhóm máu: ${patientProfile.bloodType}, Thai kỳ: ${patientProfile.pregnancyStatus}, Chức năng Gan/Thận: ${patientProfile.renalHepatic}, Dị ứng: ${patientProfile.allergy}, Bệnh nền: ${patientProfile.conditions}, Đang dùng thuốc: ${patientProfile.currentMeds}`;

    try {
      const response = await analyzePrescription(currentImage, text, profileString);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: response || "Không có phản hồi từ AI." };
      
      const audioBase64 = await generateSpeech(aiMsg.text);
      if (audioBase64) {
        aiMsg.audio = audioBase64;
      }

      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error("Full Error Object:", error);
      let errorMsg = "Đã xảy ra lỗi khi kết nối với AI.";
      
      if (error.message) {
        if (error.message.includes('MISSING_API_KEY')) {
          errorMsg = "Lỗi: Chưa tìm thấy API Key. Vui lòng thêm biến GEMINI_API_KEY vào Vercel và Redeploy.";
        } else if (error.message.includes('API key')) {
          errorMsg = "Lỗi: Khóa API của bạn bị Google từ chối (Không hợp lệ). Vui lòng kiểm tra lại mã GEMINI_API_KEY đã nhập chính xác chưa.";
        } else if (error.message.includes('quota')) {
          errorMsg = "Lỗi: Đã hết hạn mức sử dụng AI (Quota exceeded). Vui lòng thử lại sau.";
        } else {
          errorMsg = `Lỗi hệ thống: ${error.message}`;
        }
      } else if (typeof error === 'string') {
        errorMsg = `Lỗi: ${error}`;
      } else {
        errorMsg = "Lỗi không xác định khi gọi AI. Vui lòng kiểm tra Console log.";
      }
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: errorMsg }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const saveProfile = () => {
    localStorage.setItem('pharmaProfile', JSON.stringify(patientProfile));
    setIsProfileOpen(false);
  };

  const playAudio = (base64: string) => {
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audio.play();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setImage(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[100] w-72 glass-panel border-r border-sky-100 p-6 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Stethoscope size={20} />
            </div>
            <h1 className="text-xl font-bold gradient-text">Dược Sĩ AI</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-3 mb-8">
          <Button 
            onClick={() => { setMessages([]); setIsSidebarOpen(false); }}
            className="w-full justify-start px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all"
            icon={Plus}
          >
            Tư vấn mới
          </Button>

          <Button 
            onClick={() => setIsProfileOpen(true)}
            variant="outline"
            className="w-full justify-start px-4 py-3 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 transition-all"
            icon={UserCircle}
          >
            Hồ sơ bệnh nhân
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Công cụ chính</p>
            <button 
              onClick={() => { setInput('Tra cứu thông tin thuốc trong Dược thư Quốc gia: '); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors group"
            >
              <BookOpen size={18} className="text-slate-400 group-hover:text-blue-500" />
              Tra cứu Dược thư
            </button>
            <button 
              onClick={() => { setInput('Kiểm tra tương tác thuốc giữa: '); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors group"
            >
              <ShieldAlert size={18} className="text-slate-400 group-hover:text-blue-500" />
              Kiểm tra tương tác
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-2">Lịch sử tư vấn</p>
            <div className="space-y-1 px-2">
              {messages.length > 0 ? (
                <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl text-xs font-medium text-blue-700 flex items-center gap-2">
                  <History size={14} />
                  Phiên hiện tại
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic px-2">Chưa có lịch sử</p>
              )}
            </div>
          </div>
        </nav>

        <div className="pt-6 mt-6 border-t border-slate-100 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
            <Settings size={18} />
            Cài đặt
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
            <HelpCircle size={18} />
            Trợ giúp
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex flex-col relative min-w-0"
      >
        {/* Drag Overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[200] bg-sky-500/20 backdrop-blur-md border-4 border-dashed border-sky-400 m-4 rounded-3xl flex flex-col items-center justify-center text-sky-700"
            >
              <div className="bg-white p-8 rounded-full shadow-2xl mb-4">
                <ImageIcon size={64} className="animate-bounce" />
              </div>
              <p className="text-2xl font-bold">Thả ảnh đơn thuốc vào đây</p>
              <p className="text-sky-600">PharmaAI sẽ tự động bóc tách dữ liệu</p>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 glass-panel border-b border-sky-100 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">Dược Sĩ Lâm Sàng AI</span>
              <span className="text-[10px] text-blue-600 font-semibold uppercase flex items-center gap-1">
                <BookOpen size={10} /> Kết nối Dược thư Quốc gia
              </span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <section ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto mt-10 space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-block p-5 bg-white rounded-3xl shadow-xl shadow-blue-100 border border-blue-50">
                  <Stethoscope size={48} className="text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Hệ thống Dược sĩ Lâm sàng AI</h2>
                <p className="text-slate-500 text-lg max-w-lg mx-auto">Tư vấn sử dụng thuốc an toàn, hiệu quả dựa trên Dược thư Quốc gia Việt Nam và hồ sơ bệnh nhân.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-blue-300 hover:bg-blue-50/50 transition-all p-6 border-slate-200"
                  onClick={() => setInput('Tra cứu thông tin chi tiết thuốc [Tên thuốc] trong Dược thư Quốc gia Việt Nam?')}
                >
                  <BookOpen size={24} className="text-blue-500 mb-3 group-hover:scale-110 transition" />
                  <p className="text-base font-bold text-slate-800">Tra cứu Dược thư</p>
                  <p className="text-sm text-slate-500">Thông tin chính thống từ Dược thư Quốc gia</p>
                </Card>

                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-blue-300 hover:bg-blue-50/50 transition-all p-6 border-slate-200"
                  onClick={() => setInput('Kiểm tra tương tác thuốc giữa [Thuốc A] và [Thuốc B] trên bệnh nhân này?')}
                >
                  <ShieldAlert size={24} className="text-blue-500 mb-3 group-hover:scale-110 transition" />
                  <p className="text-base font-bold text-slate-800">Kiểm tra tương tác</p>
                  <p className="text-sm text-slate-500">Phát hiện tương kỵ và cảnh báo an toàn</p>
                </Card>
                
                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-blue-300 hover:bg-blue-50/50 transition-all p-6 border-slate-200"
                  onClick={() => {
                    setInput('Hãy bóc tách đơn thuốc trong ảnh và phân tích chi tiết giúp tôi.');
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImage(file);
                        setPreviewUrl(URL.createObjectURL(file));
                      }
                    };
                    input.click();
                  }}
                >
                  <FileInvoiceDollar size={24} className="text-blue-500 mb-3 group-hover:scale-110 transition" />
                  <p className="text-base font-bold text-slate-800">Phân tích đơn thuốc</p>
                  <p className="text-sm text-slate-500">OCR bóc tách dữ liệu từ ảnh chụp đơn thuốc</p>
                </Card>

                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-blue-300 hover:bg-blue-50/50 transition-all p-6 border-slate-200"
                  onClick={() => setInput('Tư vấn sử dụng thuốc an toàn cho bệnh nhân có bệnh nền: [Tên bệnh].')}
                >
                  <Activity size={24} className="text-blue-500 mb-3 group-hover:scale-110 transition" />
                  <p className="text-base font-bold text-slate-800">Tư vấn bệnh nền</p>
                  <p className="text-sm text-slate-500">Cá thể hóa phác đồ theo tình trạng bệnh</p>
                </Card>
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} playAudio={playAudio} />
            ))}
            {isAnalyzing && (
              <div className="flex justify-start animate-fadeIn">
                <div className="chat-bubble-ai border border-sky-100 px-5 py-4 rounded-3xl shadow-md flex items-center gap-3">
                  <Loader2 size={18} className="text-sky-600 animate-spin" />
                  <span className="text-sm font-medium text-slate-600">AI đang phân tích dữ liệu lâm sàng...</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Input Area */}
        <ChatInput 
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isAnalyzing={isAnalyzing}
          image={image}
          setImage={setImage}
          previewUrl={previewUrl}
          setPreviewUrl={setPreviewUrl}
          isListening={isListening}
          startListening={startListening}
          stopListening={stopListening}
        />
      </main>

      {/* Profile Modal */}
      <PatientProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={patientProfile}
        setProfile={setPatientProfile}
        onSave={saveProfile}
      />
    </div>
  );
}
