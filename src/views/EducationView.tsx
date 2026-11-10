import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { EducationBoard, ExamResult } from '../types/index.ts';
import {
  GraduationCap,
  Search,
  Award,
  CheckCircle2,
  Printer,
  Download,
  Calendar,
  ExternalLink,
  BookOpen,
  FileText
} from 'lucide-react';

export const EducationView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [boards, setBoards] = useState<EducationBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState('BISE_LHR');
  const [examType, setExamType] = useState('matric');
  const [rollNumber, setRollNumber] = useState('');
  const [examYear, setExamYear] = useState('2026');
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/education/boards')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBoards(data.boards);
        }
      })
      .catch(console.error);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/education/results/search?board=${selectedBoard}&roll=${rollNumber.trim()}&year=${examYear}`);
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
      } else {
        setError(data.error || 'No result found for this Roll Number.');
      }
    } catch {
      setError('Connection error while querying education database.');
    } finally {
      setLoading(false);
    }
  };

  const sampleRolls = [
    { label: 'Muhammad Hammad (BISE Lahore)', roll: '102456', board: 'BISE_LHR' },
    { label: 'Ayesha Fatima (FBISE Islamabad)', roll: '204589', board: 'FBISE_ISB' },
    { label: 'Syed Bilal (BSEK Karachi)', roll: '301290', board: 'BSEK_KHI' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <GraduationCap className="w-4 h-4" />
            <span>{isUrdu ? 'تعلیمی پورٹل و امتحانی نتائج' : 'BISE Examinations Hub'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black">
            {isUrdu ? 'پاکستان کے تمام تعلیمی بورڈز کے نتائج 2026' : 'Pakistan Education Boards & Online Results 2026'}
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
            {isUrdu
              ? 'لاہور، کراچی، فیڈرل اسلام آباد، راولپنڈی، پشاور، ملتان، فیصل آباد اور کوئٹہ بورڈز کے میٹرک، انٹرمیڈیٹ اور 9ویں جماعت کے نتائج فوری آن لائن تصدیق کے ساتھ تلاش کریں۔'
              : 'Search Matric (10th), Intermediate (12th), and 9th class annual results with authentic subject-wise mark verification across all major boards.'}
          </p>
        </div>
      </div>

      {/* Result Search Form Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-gray-100 pb-4 mb-6">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-700" />
            <span>{isUrdu ? 'آن لائن رول نمبر کے ذریعے رزلٹ تلاش کریں' : 'Roll Number Result Search'}</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isUrdu ? 'اپنا بورڈ اور رول نمبر درج کر کے مکمل مارکس شیٹ حاصل کریں' : 'Select board, enter candidate roll number, and retrieve official marks certificate'}
          </p>
        </div>

        {/* Demo Fast Fill Buttons */}
        <div className="mb-6 p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-emerald-900">
            {isUrdu ? 'آزمائشی رول نمبر منتخب کریں:' : 'Try Verified Seed Roll Numbers:'}
          </span>
          {sampleRolls.map((sr, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedBoard(sr.board);
                setRollNumber(sr.roll);
              }}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 font-semibold transition-colors"
            >
              {sr.label} ({sr.roll})
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Board Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'تعلیمی بورڈ' : 'Select Board'}
            </label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            >
              {boards.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} - {isUrdu ? b.nameUr : b.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Type */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'امتحان کی قسم' : 'Examination Class'}
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            >
              <option value="matric">{isUrdu ? 'میٹرک (دسویں جماعت)' : 'Matric (10th Class) Annual'}</option>
              <option value="inter">{isUrdu ? 'انٹر (بارہویں جماعت)' : 'Intermediate (12th Class) Annual'}</option>
              <option value="9th">{isUrdu ? 'نویں جماعت (9th Class)' : '9th Class Annual'}</option>
              <option value="11th">{isUrdu ? 'گیارہویں جماعت (11th Class)' : '11th Class Annual'}</option>
            </select>
          </div>

          {/* Roll Number Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'رول نمبر' : 'Roll Number'}
            </label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              required
              placeholder="e.g. 102456"
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !rollNumber.trim()}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? (isUrdu ? 'تلاش جاری ہے...' : 'Searching...') : (isUrdu ? 'رزلٹ دیکھیں' : 'Check Result')}</span>
            </button>
          </div>
        </form>

        {/* Error Notification */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Official Marks Sheet Card */}
        {result && (
          <div className="mt-8 bg-white border-2 border-emerald-600 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  Official Result Card • {result.boardCode}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {isUrdu ? result.candidateNameUr : result.candidateNameEn}
                </h3>
                <p className="text-xs text-gray-500">
                  {isUrdu ? `ولدیت: ${result.fatherNameUr}` : `Father's Name: ${result.fatherNameEn}`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
                  <div className="text-[10px] text-emerald-800 font-bold uppercase">{isUrdu ? 'حاصل کردہ گریڈ' : 'Grade'}</div>
                  <div className="text-2xl font-black text-emerald-700">{result.grade}</div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl transition-colors no-print"
                  title="Print Result Card"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Candidate Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-gray-50 p-4 rounded-2xl">
              <div>
                <span className="text-gray-400 block">{isUrdu ? 'رول نمبر' : 'Roll Number'}</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{result.rollNumber}</span>
              </div>
              <div>
                <span className="text-gray-400 block">{isUrdu ? 'سال / سیشن' : 'Exam Session'}</span>
                <span className="font-bold text-gray-900">{result.year} Annual</span>
              </div>
              <div>
                <span className="text-gray-400 block">{isUrdu ? 'مجموعی نمبر' : 'Total Score'}</span>
                <span className="font-bold text-emerald-700 font-mono text-sm">
                  {result.marksObtained} / {result.totalMarks}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">{isUrdu ? 'حیثیت' : 'Status'}</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {result.status}
                </span>
              </div>
            </div>

            {/* Institution */}
            <div className="text-xs text-gray-600">
              <span className="font-bold text-gray-800">{isUrdu ? 'تعلیمی ادارہ:' : 'Institution:'} </span>
              <span>{isUrdu ? result.instituteUr : result.instituteEn}</span>
            </div>

            {/* Subject-wise Marks Table */}
            <div>
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                {isUrdu ? 'مضامین کے انفرادی نمبرات کی تفصیل' : 'Subject-Wise Marks Breakdown'}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-emerald-900 text-white font-bold">
                      <th className="p-3 text-start">{isUrdu ? 'مضمون' : 'Subject'}</th>
                      <th className="p-3 text-center">{isUrdu ? 'کل نمبر' : 'Total Marks'}</th>
                      <th className="p-3 text-center">{isUrdu ? 'حاصل کردہ نمبر' : 'Obtained Marks'}</th>
                      <th className="p-3 text-center">{isUrdu ? 'فیصد' : 'Percentage'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {result.subjectMarks.map((sub, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">
                          {isUrdu ? sub.subjectUr : sub.subjectEn}
                        </td>
                        <td className="p-3 text-center text-gray-500 font-mono">{sub.total}</td>
                        <td className="p-3 text-center font-bold text-emerald-700 font-mono">{sub.marks}</td>
                        <td className="p-3 text-center font-mono">
                          {Math.round((sub.marks / sub.total) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 text-center text-[11px] text-gray-400 border-t">
              Official digital copy verified by Khabarnama360 Educational Data Gateway.
            </div>
          </div>
        )}
      </div>

      {/* Boards Directory Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-gray-900">
          {isUrdu ? 'پاکستان کے تمام تعلیمی بورڈز کی باضابطہ ویب سائٹس' : 'Pakistan Educational Boards Directory'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((b) => (
            <div key={b.code} className="bg-white border border-gray-200 p-4 rounded-2xl shadow-xs hover:border-emerald-500 transition-colors flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {b.province}
                </span>
                <h4 className="font-bold text-sm text-gray-900 mt-1">
                  {isUrdu ? b.nameUr : b.nameEn}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">{b.city}, Pakistan</p>
              </div>
              <a
                href={b.website}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold hover:underline"
              >
                <span>{isUrdu ? 'بورڈ کی ویب سائٹ ملاحظہ کریں' : 'Visit Official Portal'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
