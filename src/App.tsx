import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  UserCircle, 
  Menu, 
  Microchip, 
  User as UserMd, 
  Pill as Capsules, 
  Receipt as FileInvoiceDollar, 
  Loader2,
  X,
  Activity,
  ShieldAlert,
  Image as ImageIcon,
  Settings,
  Globe,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzePrescription, generateSpeech } from './services/geminiService';
import { db, auth, initAuth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  getDocs,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

// Reusable Components
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { Card } from './components/Card';
import { PatientProfileModal, PatientProfile } from './components/PatientProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Đã xảy ra lỗi không mong muốn.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes('insufficient permissions')) {
          displayMessage = "Lỗi phân quyền: Bạn không có quyền thực hiện thao tác này.";
        }
      } catch (e) {}

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
          <div className="bg-red-100 p-6 rounded-full text-red-600 mb-4">
            <AlertCircle size={48} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Rất tiếc!</h1>
          <p className="text-slate-600 mb-6 max-w-md">{displayMessage}</p>
          <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  audio?: string;
  timestamp?: any;
}

function AppContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile>(() => {
    const saved = localStorage.getItem('pharmaProfile');
    return saved ? JSON.parse(saved) : { age: '', weight: '', renalHepatic: '', allergy: '', conditions: '', bloodType: '', currentMeds: '', pregnancyStatus: 'Không' };
  });
  const [settingsUrls, setSettingsUrls] = useState<string[]>(() => {
    const saved = localStorage.getItem('pharmaUrls');
    return saved ? JSON.parse(saved) : [];
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Auth
  useEffect(() => {
    initAuth().then(user => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        // Fallback to local mode if auth fails
        setIsAuthReady(false);
        setAuthError('auth-disabled');
      }
    });
  }, []);

  // Sync Profile
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const path = `users/${userId}`;
    const unsub = onSnapshot(doc(db, path), (docSnap) => {
      if (docSnap.exists()) {
        setPatientProfile(docSnap.data() as PatientProfile);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
    return unsub;
  }, [isAuthReady, userId]);

  // Sync Settings
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const path = `users/${userId}/settings/config`;
    const unsub = onSnapshot(doc(db, path), (docSnap) => {
      if (docSnap.exists()) {
        setSettingsUrls(docSnap.data().urls || []);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
    return unsub;
  }, [isAuthReady, userId]);

  // Sync Messages
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const path = `users/${userId}/messages`;
    const q = query(collection(db, path), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
    return unsub;
  }, [isAuthReady, userId]);

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

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text || "Hãy phân tích hình ảnh đơn thuốc này.", timestamp: Date.now() };
    
    if (isAuthReady && userId) {
      const path = `users/${userId}/messages`;
      try {
        await addDoc(collection(db, path), { ...userMsg, timestamp: serverTimestamp() });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    } else {
      setMessages(prev => [...prev, userMsg]);
    }

    setInput('');
    const currentImage = image;
    setImage(null);
    setPreviewUrl(null);
    setIsAnalyzing(true);

    const profileString = `Tuổi: ${patientProfile.age}, Cân nặng: ${patientProfile.weight}kg, Nhóm máu: ${patientProfile.bloodType}, Thai kỳ: ${patientProfile.pregnancyStatus}, Chức năng Gan/Thận: ${patientProfile.renalHepatic}, Dị ứng: ${patientProfile.allergy}, Bệnh nền: ${patientProfile.conditions}, Đang dùng thuốc: ${patientProfile.currentMeds}`;

    try {
      const response = await analyzePrescription(currentImage, text, profileString, settingsUrls);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: response || "Không có phản hồi từ AI.", timestamp: Date.now() };
      
      const audioBase64 = await generateSpeech(aiMsg.text);
      if (audioBase64) {
        aiMsg.audio = audioBase64;
      }

      if (isAuthReady && userId) {
        const path = `users/${userId}/messages`;
        try {
          await addDoc(collection(db, path), { ...aiMsg, timestamp: serverTimestamp() });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      } else {
        setMessages(prev => [...prev, aiMsg]);
      }
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

  const saveProfile = async () => {
    localStorage.setItem('pharmaProfile', JSON.stringify(patientProfile));
    if (isAuthReady && userId) {
      const path = `users/${userId}`;
      try {
        await setDoc(doc(db, path), patientProfile);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
    setIsProfileOpen(false);
  };

  const saveSettings = async () => {
    localStorage.setItem('pharmaUrls', JSON.stringify(settingsUrls));
    if (isAuthReady && userId) {
      const path = `users/${userId}/settings/config`;
      try {
        await setDoc(doc(db, path), { urls: settingsUrls });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
    setIsSettingsOpen(false);
  };

  const clearChat = async () => {
    if (isAuthReady && userId) {
      const path = `users/${userId}/messages`;
      try {
        const snapshot = await getDocs(collection(db, path));
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    } else {
      setMessages([]);
    }
    setIsSidebarOpen(false);
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
            <div className="bg-gradient-to-br from-sky-400 to-sky-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-200">
              <Microchip size={20} />
            </div>
            <h1 className="text-xl font-bold gradient-text">PharmaAI 2026</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-3 mb-8">
          <Button 
            onClick={clearChat}
            className="w-full"
            icon={Plus}
          >
            Tư vấn mới
          </Button>

          <Button 
            onClick={() => setIsProfileOpen(true)}
            variant="outline"
            className="w-full"
            icon={UserCircle}
          >
            Hồ sơ cá nhân
          </Button>

          <Button 
            onClick={() => setIsSettingsOpen(true)}
            variant="outline"
            className="w-full"
            icon={Settings}
          >
            Cài đặt
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lịch sử tư vấn</p>
          <div className="space-y-2">
            {messages.length > 0 ? (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-semibold text-blue-700 truncate">
                Phiên tư vấn hiện tại
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa có lịch sử tư vấn</p>
            )}
          </div>
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
              <span className="text-sm font-bold text-slate-800">Phiên tư vấn AI</span>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-semibold uppercase flex items-center gap-1 ${isAuthReady ? 'text-green-500' : (authError === 'auth-disabled' ? 'text-slate-400' : 'text-amber-500')}`}>
                  {isAuthReady ? (
                    <>
                      <Wifi size={10} className="animate-pulse" /> Đồng bộ trực tuyến
                    </>
                  ) : authError === 'auth-disabled' ? (
                    <>
                      <WifiOff size={10} /> Chế độ ngoại tuyến
                    </>
                  ) : (
                    <>
                      <WifiOff size={10} /> Đang kết nối...
                    </>
                  )}
                </span>
                <span className="text-[10px] text-sky-500 font-semibold uppercase flex items-center gap-1 border-l border-slate-200 pl-3">
                  <Globe size={10} /> Kết nối Dược thư Quốc gia
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <section ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
          {authError === 'auth-disabled' && (
            <div className="max-w-2xl mx-auto mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div className="text-sm text-amber-800">
                <p className="font-bold mb-1">Tính năng đồng bộ đang bị tắt</p>
                <p>Dữ liệu hiện chỉ được lưu trên máy này. Để đồng bộ giữa các thiết bị, vui lòng bật <b>Anonymous Auth</b> trong Firebase Console.</p>
                <a 
                  href="https://console.firebase.google.com/project/metal-complex-472900-k6/authentication/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-amber-900 font-bold underline"
                >
                  Mở trang cài đặt ngay →
                </a>
              </div>
            </div>
          )}
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto mt-10 space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-block p-4 bg-white rounded-3xl shadow-xl shadow-sky-100 border border-sky-50">
                  <UserMd size={40} className="text-sky-500" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800">Dược sĩ Lâm sàng AI 2026</h2>
                <p className="text-slate-500 text-lg">Cung cấp thông tin thuốc chính xác dựa trên bằng chứng y khoa hiện đại nhất.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-sky-300 hover:bg-sky-50/50 transition-all"
                  onClick={() => setInput('Phân tích tương tác giữa [Tên thuốc 1] và [Tên thuốc 2]?')}
                >
                  <Capsules size={20} className="text-sky-500 mb-2 group-hover:scale-110 transition" />
                  <p className="text-sm font-semibold text-slate-700">Kiểm tra tương tác</p>
                  <p className="text-xs text-slate-400">Phát hiện các loại thuốc kỵ nhau</p>
                </Card>
                
                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-sky-300 hover:bg-sky-50/50 transition-all"
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
                  <FileInvoiceDollar size={20} className="text-sky-500 mb-2 group-hover:scale-110 transition" />
                  <p className="text-sm font-semibold text-slate-700">Đọc đơn thuốc bệnh viện</p>
                  <p className="text-xs text-slate-400">Bóc tách liều dùng từ ảnh chụp</p>
                </Card>

                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-sky-300 hover:bg-sky-50/50 transition-all"
                  onClick={() => setInput('Lên lịch uống thuốc cho bệnh nhân đang dùng: [Liệt kê các thuốc và liều lượng].')}
                >
                  <Activity size={20} className="text-sky-500 mb-2 group-hover:scale-110 transition" />
                  <p className="text-sm font-semibold text-slate-700">Lên lịch uống thuốc</p>
                  <p className="text-xs text-slate-400">Tối ưu hóa thời gian dùng thuốc</p>
                </Card>

                <Card 
                  variant="outline"
                  className="cursor-pointer group hover:border-sky-300 hover:bg-sky-50/50 transition-all"
                  onClick={() => setInput('Tư vấn sử dụng [Tên thuốc] an toàn cho phụ nữ có thai [Số tháng] đầu.')}
                >
                  <ShieldAlert size={20} className="text-sky-500 mb-2 group-hover:scale-110 transition" />
                  <p className="text-sm font-semibold text-slate-700">An toàn thai kỳ</p>
                  <p className="text-xs text-slate-400">Đánh giá nguy cơ theo FDA</p>
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
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        urls={settingsUrls}
        setUrls={setSettingsUrls}
        onSave={saveSettings}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
