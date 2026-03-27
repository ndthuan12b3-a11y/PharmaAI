import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlayCircle, CheckCircle2, Download, FileText } from 'lucide-react';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle,
  AlignmentType,
  HeadingLevel
} from 'docx';
import { saveAs } from 'file-saver';

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
  const exportToWord = async () => {
    const lines = msg.text.split('\n');
    const sections: any[] = [];

    // Header
    sections.push(
      new Paragraph({
        text: "PHARMAAI 2026 - BÁO CÁO TƯ VẤN DƯỢC",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Ngày tư vấn: ${new Date().toLocaleString('vi-VN')}`,
            italics: true,
            color: "666666",
          }),
        ],
        spacing: { after: 400 },
      })
    );

    let currentTable: string[][] = [];
    let inTable = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Handle Tables
      if (trimmedLine.startsWith('|')) {
        if (trimmedLine.includes('---')) continue; // Skip separator
        const cells = trimmedLine.split('|').filter(c => c.trim() !== '').map(c => c.trim());
        if (cells.length > 0) {
          currentTable.push(cells);
          inTable = true;
        }
        continue;
      } else if (inTable) {
        // End of table, create the Word table
        if (currentTable.length > 0) {
          const tableRows = currentTable.map((row, rowIndex) => {
            return new TableRow({
              children: row.map(cell => new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({
                    text: cell.replace(/\*\*/g, ''),
                    bold: rowIndex === 0 || cell.includes('**'),
                    size: 20,
                  })],
                })],
                shading: rowIndex === 0 ? { fill: "F0F9FF" } : undefined,
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
              })),
            });
          });

          sections.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
          sections.push(new Paragraph({ text: "" })); // Spacer
        }
        currentTable = [];
        inTable = false;
      }

      // Handle Headers
      if (trimmedLine.startsWith('###')) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('###', '').trim(),
                bold: true,
                color: "0284C7", // Sky 600
                size: 28,
              }),
            ],
            spacing: { before: 400, after: 200 },
          })
        );
      } else if (trimmedLine !== '') {
        // Handle normal text and bold
        const parts = trimmedLine.split(/(\*\*.*?\*\*)/g);
        const children = parts.map(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({
              text: part.replace(/\*\*/g, ''),
              bold: true,
              color: "1E293B", // Slate 800
            });
          }
          return new TextRun({
            text: part,
            color: "334155", // Slate 700
          });
        });

        sections.push(new Paragraph({ children, spacing: { after: 120 } }));
      }
    }

    // Footer
    sections.push(
      new Paragraph({ text: "", spacing: { before: 400 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Lưu ý: Thông tin mang tính chất tham khảo. Hãy luôn tham vấn bác sĩ trực tiếp.",
            italics: true,
            color: "EF4444", // Red 500
            size: 18,
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );

    const doc = new Document({
      sections: [{
        children: sections,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Tu-van-PharmaAI-${msg.id}.docx`);
  };

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex flex-col max-w-[90%] ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}>
        <div className={`px-5 py-5 rounded-3xl ${msg.role === 'ai' ? 'chat-bubble-ai border border-slate-200' : 'chat-bubble-user'} shadow-md`}>
          <div className="markdown-body">
            {msg.role === 'ai' ? (
              <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
            ) : (
              msg.text
            )}
          </div>
          {msg.role === 'ai' && (
            <div className="flex flex-wrap gap-2 mt-4">
              {msg.audio && (
                <button 
                  onClick={() => playAudio(msg.audio!)}
                  className="text-[10px] font-bold uppercase text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition inline-flex items-center shadow-sm"
                >
                  <PlayCircle size={14} className="mr-1" /> Nghe tư vấn
                </button>
              )}
              <button 
                onClick={exportToWord}
                className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition inline-flex items-center shadow-sm"
              >
                <FileText size={14} className="mr-1" /> Xuất File Word (VIP)
              </button>
            </div>
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
