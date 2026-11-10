import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  Calculator,
  Zap,
  Calendar,
  Activity,
  Percent,
  Coins,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const ToolsView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [activeTool, setActiveTool] = useState<'electricity' | 'age' | 'bmi' | 'gpa' | 'loan'>('electricity');

  // Electricity Bill Estimator state
  const [disco, setDisco] = useState('LESCO');
  const [units, setUnits] = useState('240');
  const [isProtected, setIsProtected] = useState(false);

  // Age Calculator state
  const [birthDate, setBirthDate] = useState('1998-05-14');

  // BMI state
  const [weightKg, setWeightKg] = useState('70');
  const [heightCm, setHeightCm] = useState('175');

  // GPA state
  const [obtainedMarks, setObtainedMarks] = useState('850');
  const [totalMarks, setTotalMarks] = useState('1100');

  // Loan / EMI state
  const [loanAmount, setLoanAmount] = useState('2000000');
  const [interestRate, setInterestRate] = useState('15');
  const [loanYears, setLoanYears] = useState('3');

  // Calculate Electricity Bill
  const calculateElectricity = () => {
    const u = parseFloat(units) || 0;
    let baseRate = 0;
    if (u <= 100) baseRate = 16.48;
    else if (u <= 200) baseRate = 22.95;
    else if (u <= 300) baseRate = 27.14;
    else if (u <= 700) baseRate = 35.24;
    else baseRate = 42.72;

    const energyCost = u * baseRate;
    const fpa = u * 2.80; // Fuel Price Adjustment estimate
    const electricityDuty = energyCost * 0.015;
    const tvFee = 35;
    const gst = energyCost * 0.18; // 18% sales tax

    const totalEstimated = energyCost + fpa + electricityDuty + tvFee + gst;
    return {
      energyCost: Math.round(energyCost),
      fpa: Math.round(fpa),
      gst: Math.round(gst),
      totalEstimated: Math.round(totalEstimated),
      perUnitAverage: u > 0 ? (totalEstimated / u).toFixed(2) : '0.00'
    };
  };

  // Calculate Age
  const calculateAge = () => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
      months--;
      days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    return { years, months, days };
  };

  // Calculate BMI
  const calculateBmi = () => {
    const w = parseFloat(weightKg) || 0;
    const h = (parseFloat(heightCm) || 0) / 100;
    if (w <= 0 || h <= 0) return { bmi: 0, status: 'Invalid' };
    const val = w / (h * h);
    let status = 'Normal Weight';
    if (val < 18.5) status = 'Underweight';
    else if (val >= 25 && val < 29.9) status = 'Overweight';
    else if (val >= 30) status = 'Obese';
    return { bmi: val.toFixed(1), status };
  };

  // Calculate Loan EMI
  const calculateEmi = () => {
    const p = parseFloat(loanAmount) || 0;
    const r = (parseFloat(interestRate) || 0) / (12 * 100);
    const n = (parseFloat(loanYears) || 0) * 12;
    if (p <= 0 || r <= 0 || n <= 0) {
      return { monthlyEmi: 0, totalPayment: 0, totalInterest: 0 };
    }
    const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    return {
      monthlyEmi: Math.round(emi),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalPayment - p)
    };
  };

  const elect = calculateElectricity();
  const age = calculateAge();
  const bmi = calculateBmi();
  const emi = calculateEmi();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Calculator className="w-4 h-4" />
          <span>{isUrdu ? 'روزمرہ آن لائن ٹولز' : 'Everyday Utilities'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'پاکستانی شہریوں کے لیے کارآمد آن لائن کیلکولیٹرز' : 'Smart Citizen Online Calculators & Estimators'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'بجلی کے بل کا تخمینہ، درست تاریخِ پیدائش، بی ایم آئی، اور بینک کار لون کی ماہانہ قسط'
            : 'DISCO power bill tariffs, exact age, health BMI, and bank financing EMI calculators.'}
        </p>
      </div>

      {/* Tool Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'electricity', labelEn: 'Electricity Bill', labelUr: 'بجلی بل تخمینہ', icon: Zap },
          { id: 'age', labelEn: 'Age Calculator', labelUr: 'عمر معلوم کریں', icon: Calendar },
          { id: 'bmi', labelEn: 'BMI Health', labelUr: 'بی ایم آئی انڈیکس', icon: Activity },
          { id: 'gpa', labelEn: 'Percentage / Marks', labelUr: 'فیصد و گریڈ', icon: Percent },
          { id: 'loan', labelEn: 'Loan / Car EMI', labelUr: 'بینک لون قسط', icon: Coins },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTool(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isUrdu ? tab.labelUr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tool Content */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        {/* Tool 1: Electricity Bill */}
        {activeTool === 'electricity' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>{isUrdu ? 'بجلی کے متوقع بل کا تخمینہ (NEPRA Slabs)' : 'Pakistan Electricity Bill Estimator'}</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {isUrdu
                  ? 'لیسکو، کے الیکٹرک، فیسکو، آئیسکو صارفین کے لیے نیپرا منظور شدہ ٹیرف سلیب اور ٹیکسز'
                  : 'Estimate monthly power cost based on unit consumption, slabs, FPA and 18% GST.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isUrdu ? 'بجلی کی تقسیم کار کمپنی (DISCO)' : 'Distribution Company (DISCO)'}
                  </label>
                  <select
                    value={disco}
                    onChange={(e) => setDisco(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold"
                  >
                    <option value="LESCO">LESCO (Lahore Electric Supply Company)</option>
                    <option value="KE">K-Electric (Karachi)</option>
                    <option value="IESCO">IESCO (Islamabad / Rawalpindi)</option>
                    <option value="FESCO">FESCO (Faisalabad)</option>
                    <option value="GEPCO">GEPCO (Gujranwala)</option>
                    <option value="MEPCO">MEPCO (Multan)</option>
                    <option value="PESCO">PESCO (Peshawar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isUrdu ? 'استعمال شدہ یونٹس (Units Consumed)' : 'Monthly Units Consumed'}
                  </label>
                  <input
                    type="number"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="e.g. 240"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-sm font-bold focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Estimate Calculation Breakdown */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-3">
                <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider block">
                  {isUrdu ? 'متوقع بل کا مکمل بریک ڈاؤن' : 'Bill Calculation Breakdown'}
                </span>
                <div className="text-3xl font-black text-gray-900 font-mono">
                  Rs. {elect.totalEstimated.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-emerald-200">
                  <div className="flex justify-between">
                    <span>Base Energy Cost:</span>
                    <span className="font-mono font-bold">Rs. {elect.energyCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fuel Price Adjustment (FPA):</span>
                    <span className="font-mono font-bold">Rs. {elect.fpa.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>General Sales Tax (18% GST):</span>
                    <span className="font-mono font-bold">Rs. {elect.gst.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800 pt-1 border-t border-emerald-200">
                    <span>Effective Rate per Unit:</span>
                    <span className="font-mono">Rs. {elect.perUnitAverage} / unit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tool 2: Age Calculator */}
        {activeTool === 'age' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-700" />
                <span>{isUrdu ? 'درست عمر معلوم کریں' : 'Precise Age Calculator'}</span>
              </h2>
            </div>

            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isUrdu ? 'تاریخِ پیدائش منتخب کریں' : 'Select Date of Birth'}
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold"
                />
              </div>

              {age && (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-2">
                  <span className="text-xs text-emerald-800 font-bold uppercase">
                    {isUrdu ? 'آپ کی کل عمر:' : 'Your Exact Age:'}
                  </span>
                  <div className="text-3xl font-black text-gray-900 font-mono">
                    {age.years} Years, {age.months} Months, {age.days} Days
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tool 3: BMI Calculator */}
        {activeTool === 'bmi' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-700" />
                <span>{isUrdu ? 'جسمانی وزن اور بی ایم آئی انڈیکس' : 'Body Mass Index (BMI) Calculator'}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Weight (in kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Height (in cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl text-center space-y-1 max-w-md">
              <span className="text-xs text-gray-500 font-bold">Your BMI Index</span>
              <div className="text-3xl font-black text-emerald-700 font-mono">{bmi.bmi}</div>
              <div className="text-xs font-bold text-gray-800 uppercase mt-1">{bmi.status}</div>
            </div>
          </div>
        )}

        {/* Tool 4: Marks Percentage */}
        {activeTool === 'gpa' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Percent className="w-5 h-5 text-emerald-700" />
                <span>{isUrdu ? 'امتحانی نمبرات اور فیصد معلوم کریں' : 'Academic Marks & Percentage Calculator'}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Marks Obtained</label>
                <input
                  type="number"
                  value={obtainedMarks}
                  onChange={(e) => setObtainedMarks(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Total Marks</label>
                <input
                  type="number"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-1 max-w-md">
              <span className="text-xs text-emerald-800 font-bold">Percentage</span>
              <div className="text-3xl font-black text-emerald-700 font-mono">
                {totalMarks ? ((parseFloat(obtainedMarks) / parseFloat(totalMarks)) * 100).toFixed(2) : 0}%
              </div>
            </div>
          </div>
        )}

        {/* Tool 5: Loan EMI */}
        {activeTool === 'loan' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-700" />
                <span>{isUrdu ? 'بینک کار اور ہوم لون کی ماہانہ قسط (EMI)' : 'Bank Loan & Car Financing EMI Calculator'}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Loan Amount (PKR)</label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Markup / Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tenure (Years)</label>
                <input
                  type="number"
                  value={loanYears}
                  onChange={(e) => setLoanYears(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-emerald-800 font-bold uppercase">Estimated Monthly Installment (EMI)</span>
                <div className="text-3xl font-black text-gray-900 font-mono mt-1">
                  Rs. {emi.monthlyEmi.toLocaleString()} / month
                </div>
              </div>
              <div className="text-xs text-gray-600 text-end">
                <div>Total Payment: <span className="font-bold font-mono">Rs. {emi.totalPayment.toLocaleString()}</span></div>
                <div>Total Interest: <span className="font-bold font-mono">Rs. {emi.totalInterest.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
