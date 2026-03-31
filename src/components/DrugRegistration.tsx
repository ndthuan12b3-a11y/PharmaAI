import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle2, Pill, Info, Loader2, Camera, Upload, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';
import { Card } from './Card';
import { searchDrugNameByRegistrationNumber, extractRegistrationNumberFromImage } from '../services/geminiService';

const DRUG_GROUPS: Record<string, string> = {
  '1': 'Hóa dược',
  '2': 'Dược liệu',
  '3': 'Vắc xin',
  '4': 'Sinh phẩm',
  '5': 'Nguyên liệu làm thuốc',
  '6': 'Thuốc gia công',
  '7': 'Thuốc chuyển giao công nghệ',
};

const PRESCRIPTION_TYPES: Record<string, string> = {
  '0': 'Thuốc không kê đơn',
  '1': 'Thuốc kê đơn',
};

const SPECIAL_CONTROL_TYPES: Record<string, string> = {
  '0': 'Thuốc không kiểm soát đặc biệt',
  '1': 'Thuốc gây nghiện, chứa dược chất gây nghiện',
  '2': 'Thuốc hướng thần, chứa dược chất hướng thần',
  '3': 'Thuốc tiền chất, chứa tiền chất',
  '4': 'Thuốc độc',
  '5': 'Thuốc cấm dùng cho các bộ, ngành',
  '6': 'Thuốc phóng xạ',
};

// Mock data for drug names (Realistic Vietnamese 12-digit codes based on the rule)
const MOCK_DRUGS: Record<string, string> = {
  '893115837124': 'SCANAX 500MG',
};

interface AIDrugInfo {
  drugName: string;
  strength?: string;
  packaging?: string;
  manufacturer?: string;
  dosageForm?: string;
  activeIngredient?: string;
}

interface ParsedResult {
  countryCode: string;
  drugGroup: string;
  prescriptionType: string;
  specialControl: string;
  sequenceNumber: string;
  yearCode: string;
  drugName?: string;
  aiDrugInfo?: AIDrugInfo;
}

export function DrugRegistration() {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    try {
      const extracted = await extractRegistrationNumberFromImage(file);
      if (extracted === "NONE") {
        setError("Không tìm thấy số đăng ký trong ảnh. Vui lòng thử lại hoặc nhập tay.");
      } else {
        setRegistrationNumber(extracted);
        // Tự động phân tích sau khi trích xuất thành công
        setTimeout(() => handleAnalyze(extracted), 500);
      }
    } catch (err) {
      setError("Lỗi khi xử lý ảnh.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyze = async (manualRegNumber?: string) => {
    const targetNumber = manualRegNumber || registrationNumber;
    setError(null);
    setResult(null);

    const cleanNumber = targetNumber.replace(/\s+/g, '');

    if (!/^\d+$/.test(cleanNumber)) {
      setError('Số đăng ký chỉ được chứa các chữ số.');
      return;
    }

    if (cleanNumber.length !== 12) {
      setError(`Số đăng ký phải có đúng 12 chữ số. Bạn đang nhập ${cleanNumber.length} chữ số.`);
      return;
    }

    setIsSearching(true);

    const countryCode = cleanNumber.slice(0, 3);
    const drugGroupCode = cleanNumber.slice(3, 4);
    const prescriptionCode = cleanNumber.slice(4, 5);
    const specialControlCode = cleanNumber.slice(5, 6);
    const sequenceNumber = cleanNumber.slice(6, 10);
    const yearCode = cleanNumber.slice(10, 12);

    const drugGroup = DRUG_GROUPS[drugGroupCode] || 'Không xác định';
    const prescriptionType = PRESCRIPTION_TYPES[prescriptionCode] || 'Không xác định';
    const specialControl = SPECIAL_CONTROL_TYPES[specialControlCode] || 'Không xác định';
    const drugName = MOCK_DRUGS[cleanNumber];

    try {
      const aiResponse = await searchDrugNameByRegistrationNumber(cleanNumber);
      let aiDrugInfo: AIDrugInfo | undefined;

      if (aiResponse !== "Không tìm thấy thông tin") {
        try {
          aiDrugInfo = JSON.parse(aiResponse);
        } catch (e) {
          console.error("Lỗi parse JSON từ AI:", e);
          // Fallback nếu AI không trả về JSON chuẩn
          aiDrugInfo = { drugName: aiResponse };
        }
      }
      
      setResult({
        countryCode,
        drugGroup,
        prescriptionType,
        specialControl,
        sequenceNumber,
        yearCode,
        drugName,
        aiDrugInfo,
      });
    } catch (err) {
      console.error("Lỗi khi tìm kiếm AI:", err);
      // Vẫn hiển thị kết quả phân tích cơ bản nếu AI lỗi
      setResult({
        countryCode,
        drugGroup,
        prescriptionType,
        specialControl,
        sequenceNumber,
        yearCode,
        drugName,
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm mb-6">
          <div className="bg-amber-100 p-2 rounded-xl text-amber-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-1">Lưu ý quan trọng (Trang web thử nghiệm)</h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              Đây là phiên bản thử nghiệm (Beta). Mọi thông tin tra cứu chỉ mang tính chất tham khảo và học thuật. 
              <strong> Tuyệt đối không sử dụng thông tin này để thay thế chỉ định của bác sĩ hoặc đưa ra quyết định y tế.</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <Search size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Tra cứu Số đăng ký thuốc</h2>
            <p className="text-slate-500">Phân tích cấu trúc số đăng ký thuốc theo quy định (12 chữ số)</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nhập số đăng ký thuốc (12 chữ số)
              </label>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="VD: 893115837124"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleAnalyze()}
                    disabled={isSearching || isExtracting}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <label className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isExtracting} />
                      {isExtracting ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                    </label>
                  </div>
                </div>
                <Button onClick={() => handleAnalyze()} icon={isSearching ? Loader2 : Search} className="px-8" disabled={isSearching || isExtracting}>
                  {isSearching ? 'Đang tìm...' : 'Phân tích'}
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {isExtracting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100"
                >
                  <Loader2 className="animate-spin" size={20} />
                  <p className="font-medium">Đang trích xuất số đăng ký từ ảnh...</p>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100"
                >
                  <AlertCircle size={20} />
                  <p className="font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-blue-600 bg-blue-50 p-4 rounded-xl border border-blue-100"
              >
                <Loader2 className="animate-spin" size={20} />
                <p className="font-medium">AI đang tìm kiếm tên thuốc trên Google...</p>
              </motion.div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-slate-700 mb-1">Dữ liệu mẫu để thử nghiệm:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li><code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600">893115837124</code></li>
                    <li><code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600">893110049200</code></li>
                    <li><code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600">893100042123</code></li>
                  </ul>
                  <p className="mt-2 text-xs text-slate-500 italic">* Hệ thống sẽ tự động dùng AI tìm kiếm tên thuốc thực tế trên Google nếu không có trong dữ liệu mẫu.</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <AnimatePresence>
          {result && !isSearching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Card className="p-6 border-green-100 shadow-green-900/5">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                  <div className="bg-green-100 p-3 rounded-full text-green-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Kết quả phân tích</h3>
                    <p className="text-slate-500 font-mono">{registrationNumber}</p>
                  </div>
                </div>

                {/* Smart Alerts */}
                {registrationNumber[5] !== '0' && (
                  <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
                    <div className="bg-red-100 p-2 rounded-xl text-red-600 shrink-0">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-red-900 mb-1">Cảnh báo Kiểm soát đặc biệt</h4>
                      <p className="text-sm text-red-700 leading-relaxed">
                        Đây là thuốc thuộc nhóm <strong>{result.specialControl}</strong>. 
                        Việc kinh doanh, kê đơn và sử dụng phải tuân thủ nghiêm ngặt các quy định về quản lý thuốc kiểm soát đặc biệt của Bộ Y tế.
                      </p>
                    </div>
                  </div>
                )}

                {result.aiDrugInfo && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
                    <div className="bg-blue-600 px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Pill className="text-white" size={20} />
                        <h3 className="text-white font-bold">Bảng thông tin thuốc </h3>
                      </div>
                      <div className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        Cập nhật 2026
                      </div>
                    </div>
                    
                    <div className="p-0">
                      <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-slate-100">
                          <InfoRow label="Tên thuốc" value={result.aiDrugInfo.drugName} isTitle />
                          <InfoRow label="Hoạt chất" value={result.aiDrugInfo.activeIngredient} />
                          <InfoRow label="Hàm lượng" value={result.aiDrugInfo.strength} isHighlight />
                          <InfoRow label="Quy cách" value={result.aiDrugInfo.packaging} />
                          <InfoRow label="Dạng bào chế" value={result.aiDrugInfo.dosageForm} />
                          <InfoRow label="Cơ sở sản xuất" value={result.aiDrugInfo.manufacturer} />
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!result.aiDrugInfo && result.drugName && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        DỮ LIỆU MẪU
                      </div>
                      <h3 className="text-lg font-bold text-emerald-900">Tên thuốc</h3>
                    </div>
                    <p className="text-2xl font-black text-emerald-700 tracking-tight">
                      {result.drugName}
                    </p>
                  </div>
                )}

                {/* Thông tin quan trọng (Highlighted Sections) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col items-center text-center">
                    <div className="bg-indigo-600 text-white p-2 rounded-xl mb-3">
                      <Pill size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Mã nhóm thuốc (1 chữ số)</p>
                    <p className="text-lg font-black text-indigo-900 leading-tight">
                      {registrationNumber[3]} - {result.drugGroup}
                    </p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col items-center text-center">
                    <div className="bg-emerald-600 text-white p-2 rounded-xl mb-3">
                      <CheckCircle2 size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Mã phân loại thuốc kê đơn (1 chữ số)</p>
                    <p className="text-lg font-black text-emerald-900 leading-tight">
                      {registrationNumber[4]} - {result.prescriptionType}
                    </p>
                  </div>

                  <div className={`rounded-2xl p-5 flex flex-col items-center text-center border ${
                    registrationNumber[5] !== '0' 
                      ? 'bg-rose-50 border-rose-100' 
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className={`${
                      registrationNumber[5] !== '0' ? 'bg-rose-600' : 'bg-slate-600'
                    } text-white p-2 rounded-xl mb-3`}>
                      <ShieldAlert size={20} />
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                      registrationNumber[5] !== '0' ? 'text-rose-400' : 'text-slate-400'
                    }`}>Mã phân loại thuốc kiểm soát đặc biệt (1 chữ số)</p>
                    <p className={`text-lg font-black leading-tight ${
                      registrationNumber[5] !== '0' ? 'text-rose-900' : 'text-slate-900'
                    }`}>
                      {registrationNumber[5]} - {result.specialControl}
                    </p>
                  </div>
                </div>

                {/* Compact Visual Breakdown */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
                  <div className="text-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Sơ đồ phân tích mã số</h3>
                  </div>
                  <div className="flex items-center justify-center gap-1 font-mono text-3xl md:text-4xl font-bold tracking-wider">
                    <span className="text-blue-600" title="Mã nước sản xuất">{result.countryCode}</span>
                    <span className="text-slate-300 mx-1">.</span>
                    <span className="text-indigo-600" title="Mã nhóm thuốc">{registrationNumber[3]}</span>
                    <span className="text-slate-300 mx-1">.</span>
                    <span className="text-emerald-600" title="Mã phân loại thuốc kê đơn">{registrationNumber[4]}</span>
                    <span className="text-slate-300 mx-1">.</span>
                    <span className="text-rose-600" title="Mã phân loại thuốc kiểm soát đặc biệt">{registrationNumber[5]}</span>
                    <span className="text-slate-300 mx-1">.</span>
                    <span className="text-amber-600" title="Mã thứ tự cấp">{result.sequenceNumber}</span>
                    <span className="text-slate-300 mx-1">.</span>
                    <span className="text-purple-600" title="Mã năm cấp">{result.yearCode}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Nước sản xuất</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Nhóm thuốc</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Kê đơn</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Kiểm soát đặc biệt</span>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-1/3">Thành phần</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-20">Mã số</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Giải thích chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <TableRow 
                        label="Mã nước sản xuất (3 chữ số)" 
                        code={result.countryCode} 
                        value={result.countryCode === '893' ? 'Việt Nam (Theo mã Quốc gia)' : 'Theo mã Quốc gia'} 
                        dotColor="bg-blue-500"
                      />
                      <TableRow 
                        label="Mã nhóm thuốc (1 chữ số)" 
                        code={registrationNumber[3]} 
                        value={result.drugGroup} 
                        dotColor="bg-indigo-500"
                      />
                      <TableRow 
                        label="Mã phân loại thuốc kê đơn (1 chữ số)" 
                        code={registrationNumber[4]} 
                        value={result.prescriptionType} 
                        dotColor="bg-emerald-500"
                        isWarning={result.prescriptionType === 'Thuốc kê đơn'}
                      />
                      <TableRow 
                        label="Mã phân loại thuốc kiểm soát đặc biệt (1 chữ số)" 
                        code={registrationNumber[5]} 
                        value={result.specialControl} 
                        dotColor="bg-rose-500"
                        isDanger={registrationNumber[5] !== '0'}
                      />
                      <TableRow 
                        label="Mã thứ tự cấp (4 chữ số)" 
                        code={result.sequenceNumber} 
                        value="Số thứ tự cấp trong năm" 
                        dotColor="bg-amber-500"
                      />
                      <TableRow 
                        label="Mã năm cấp (2 chữ số)" 
                        code={result.yearCode} 
                        value="2 chữ số cuối của năm cấp" 
                        dotColor="bg-purple-500"
                      />
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Policy & Footer Info */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-500">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Chính sách cơ bản</h4>
              <ul className="text-xs space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                  Dữ liệu được tổng hợp từ các nguồn công khai và hỗ trợ bởi trí tuệ nhân tạo (AI).
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                  Chúng tôi không lưu trữ thông tin cá nhân hay hình ảnh tải lên của người dùng.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                  Hệ thống đang trong quá trình hoàn thiện, độ chính xác có thể thay đổi tùy theo chất lượng dữ liệu.
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Cảnh báo người dùng</h4>
              <p className="text-xs leading-relaxed">
                Nếu bạn phát hiện sai sót trong quá trình phân tích hoặc có góp ý về tính năng, vui lòng liên hệ đội ngũ phát triển. 
                Mọi hành vi sử dụng dữ liệu sai mục đích y tế chúng tôi hoàn toàn không chịu trách nhiệm.
              </p>
              <div className="mt-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  PHIÊN BẢN THỬ NGHIỆM ĐANG HOẠT ĐỘNG
                </div>
                <div className="text-[10px] text-slate-400">
                  Phát triển bởi: <strong>Nguyễn Đức Thuận</strong> (alanwalkert2002@gmail.com)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, isTitle = false, isHighlight = false }: { label: string; value?: string; isTitle?: boolean; isHighlight?: boolean }) {
  if (!value) return null;
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-6 py-4 bg-slate-50/50 w-1/3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </td>
      <td className="px-6 py-4">
        <span className={`
          ${isTitle ? 'text-xl font-black text-blue-700 tracking-tight' : 'text-sm font-medium text-slate-700'}
          ${isHighlight ? 'bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold' : ''}
        `}>
          {value}
        </span>
      </td>
    </tr>
  );
}

function TableRow({ 
  label, 
  code, 
  value, 
  dotColor,
  isWarning = false,
  isDanger = false
}: { 
  label: string; 
  code: string; 
  value: string; 
  dotColor: string;
  isWarning?: boolean;
  isDanger?: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
          <span className="text-sm font-medium text-slate-600">{label}</span>
        </div>
      </td>
      <td className="px-6 py-4 font-mono font-bold text-slate-800">{code}</td>
      <td className="px-6 py-4">
        <span className={`text-sm font-semibold px-2 py-1 rounded-md ${
          isDanger ? 'bg-red-50 text-red-700' : 
          isWarning ? 'bg-amber-50 text-amber-700' : 
          'text-slate-800'
        }`}>
          {value}
        </span>
      </td>
    </tr>
  );
}
