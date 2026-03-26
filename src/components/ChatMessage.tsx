import React, { useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlayCircle, CheckCircle2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const messageRef = useRef<HTMLDivElement>(null);

  const exportPDF = async () => {
    if (!messageRef.current) return;
    
    try {
      const canvas = await html2canvas(messageRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PharmaAI_Report_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex flex-col max-w-[90%] ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}>
        <div ref={messageRef} className={`px-5 py-5 rounded-3xl ${msg.role === 'ai' ? 'chat-bubble-ai border border-slate-200' : 'chat-bubble-user'} shadow-md`}>
          <div className="markdown-body">
            {msg.role === 'ai' ? (
              <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
            ) : (
              msg.text
            )}
          </div>
          {msg.audio && (
            <button 
              onClick={() => playAudio(msg.audio!)}
              className="mt-4 text-[10px] font-bold uppercase text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition inline-flex items-center shadow-sm mr-2"
            >
              <PlayCircle size={14} className="mr-1" /> Nghe tư vấn
            </button>
          )}
          {msg.role === 'ai' && (
            <button 
              onClick={exportPDF}
              className="mt-4 text-[10px] font-bold uppercase text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-100 transition inline-flex items-center shadow-sm"
            >
              <Download size={14} className="mr-1" /> Xuất PDF
            </button>
          )}
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
