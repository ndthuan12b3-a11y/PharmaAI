import React, { useState, useEffect } from 'react';
import { X, Lock, Globe, Plus, Trash2, Save, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';
import { Modal } from './Modal';
import { Card } from './Card';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: string[];
  setUrls: (urls: string[]) => void;
  onSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  urls, 
  setUrls, 
  onSave 
}) => {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setIsAuthorized(false);
      setError('');
    }
  }, [isOpen]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1002') {
      setIsAuthorized(true);
      setError('');
    } else {
      setError('Mật khẩu không chính xác. Vui lòng thử lại.');
    }
  };

  const addUrl = () => {
    if (!newUrl.trim()) return;
    if (!newUrl.startsWith('http')) {
      setError('URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    setUrls([...urls, newUrl.trim()]);
    setNewUrl('');
    setError('');
  };

  const removeUrl = (index: number) => {
    const newUrls = [...urls];
    newUrls.splice(index, 1);
    setUrls(newUrls);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cài đặt hệ thống">
      {!isAuthorized ? (
        <form onSubmit={handleLogin} className="space-y-6 py-4">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-sky-100 p-4 rounded-full text-sky-600">
              <Lock size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Yêu cầu xác thực</h3>
              <p className="text-sm text-slate-500">Vui lòng nhập mật khẩu để truy cập cài đặt nâng cao.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mật khẩu</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu (1002)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition"
              autoFocus
            />
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>

          <Button type="submit" className="w-full py-4 shadow-lg shadow-sky-100">
            Xác nhận truy cập
          </Button>
        </form>
      ) : (
        <div className="space-y-6 py-2">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700">
            <ShieldCheck size={20} />
            <p className="text-sm font-semibold">Đã xác thực quyền quản trị</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe size={16} className="text-sky-500" />
                Nguồn thông tin bổ sung (URLs)
              </h4>
              <p className="text-xs text-slate-500 mt-1">AI sẽ sử dụng nội dung từ các liên kết này để cung cấp câu trả lời chính xác hơn.</p>
            </div>

            <div className="flex gap-2">
              <input 
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/medical-info"
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                onKeyPress={(e) => e.key === 'Enter' && addUrl()}
              />
              <Button onClick={addUrl} icon={Plus} className="px-4">Thêm</Button>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {urls.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-xs text-slate-400">Chưa có nguồn thông tin nào được thêm.</p>
                </div>
              ) : (
                urls.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <span className="text-xs text-slate-600 truncate flex-1 mr-2">{url}</span>
                    <button 
                      onClick={() => removeUrl(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Hủy</Button>
            <Button onClick={onSave} icon={Save} className="flex-1 shadow-lg shadow-sky-100">Lưu cài đặt</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
