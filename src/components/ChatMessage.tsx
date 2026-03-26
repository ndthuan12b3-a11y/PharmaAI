import React, { useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlayCircle, CheckCircle2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  audio?: string;
}

interface ChatMessageProps {
  msg: Message;
  playAudio: (base64: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ msg, playAudio }) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (bubbleRef.current) {
      const canvas = await html2canvas(bubbleRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `don-thuoc-${msg.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex flex-col max-w-[90%] ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}>
        <div 
          ref={bubbleRef}
          className={`px-5 py-5 rounded-3xl ${msg.role === 'ai' ? 'chat-bubble-ai border border-slate-200' : 'chat-bubble-user'} shadow-md`}
        >
          <div className="markdown-body">
            {msg.role === 'ai' ? (
              <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
            ) : (
              msg.text
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {msg.audio && (
              <button 
                onClick={() => playAudio(msg.audio!)}
                className="text-[10px] font-bold uppercase text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition inline-flex items-center shadow-sm"
              >
                <PlayCircle size={14} className="mr-1" /> Nghe tư vấn
              </button>
            )}
            {msg.role === 'ai' && (
              <button 
                onClick={downloadImage}
                className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition inline-flex items-center shadow-sm"
              >
                <Download size={14} className="mr-1" /> Lưu đơn thuốc
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 px-2">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            {msg.role === 'ai' ? 'PharmaAI VIP' : 'Bệnh nhân'}
          </span>
          {msg.role === 'ai' && (
            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 text-[8px] font-black rounded uppercase flex items-center gap-1">
              <CheckCircle2 size={10} /> Chuẩn Y khoa
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
