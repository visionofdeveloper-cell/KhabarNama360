import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { JobListing } from '../types/index.ts';
import { Briefcase, Calendar, MapPin, Building, GraduationCap, CheckCircle2 } from 'lucide-react';

export const JobsView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setJobs(data.jobs);
        }
      })
      .catch(console.error);
  }, []);

  const filteredJobs = filterType === 'all'
    ? jobs
    : jobs.filter(j => j.organizationType.toLowerCase().includes(filterType.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Briefcase className="w-4 h-4" />
          <span>{isUrdu ? 'سرکاری و نجی نوکریاں' : 'Pakistan Career Portal'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'پاکستان میں سرکاری نوکریاں، ایف پی ایس سی، پی پی ایس سی اور نجی اسامیاں' : 'Latest Govt & Private Jobs in Pakistan 2026'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'وفاقی پبلک سروس کمیشن، اسٹیٹ بینک آف پاکستان، نیشنل بینک، اور آئی ٹی کمپنیوں کی نئی بھرتیوں کے اعلانات'
            : 'Explore verified vacancies, eligibility criteria, BPS scales, and online application deadlines.'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {['all', 'Govt', 'Banking', 'Private'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all capitalize ${
              filterType === type
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type === 'all' ? (isUrdu ? 'تمام اسامیاں' : 'All Openings') : type}
          </button>
        ))}
      </div>

      {/* Job Cards */}
      <div className="space-y-4">
        {filteredJobs.map((job) => (
          <div key={job.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs hover:border-emerald-500 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                  {job.organizationType}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {isUrdu ? job.cityUr : job.cityEn}
                </span>
              </div>

              <h3 className="text-lg font-black text-gray-900">
                {isUrdu ? job.titleUr : job.titleEn}
              </h3>

              <div className="text-xs text-gray-600 font-semibold">
                {isUrdu ? job.departmentUr : job.departmentEn}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                <div className="flex items-center gap-1">
                  <GraduationCap className="w-4 h-4 text-emerald-700" />
                  <span>{job.qualification}</span>
                </div>
                <div>Vacancies: <span className="font-bold text-gray-800">{job.vacancies}</span></div>
                <div>Salary / Scale: <span className="font-bold text-emerald-700">{job.salaryPkr}</span></div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0">
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-red-500" />
                <span>Deadline: <strong className="text-red-600">{job.deadline}</strong></span>
              </div>
              <button
                onClick={() => alert(isUrdu ? 'آن لائن درخواست فارم ڈائریکٹوریٹ پورٹل پر ری ڈائریکٹ کیا جا رہا ہے۔' : 'Redirecting to official job application portal...')}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                {isUrdu ? 'آن لائن درخواست دیں' : 'Apply Online'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
