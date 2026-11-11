import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle2, Inbox } from 'lucide-react';
import { LEGAL_PAGES } from '../../src/data/legalPages.ts';

export const LegalPagesManager: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/submissions')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSubmissions(d.submissions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            <h3 className="text-lg font-bold text-gray-900">Legal & Trust Pages ({LEGAL_PAGES.length})</h3>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full">
            English & Urdu RTL Active
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {LEGAL_PAGES.map((p) => (
            <div key={p.slug} className="p-3 border border-gray-100 rounded-xl bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">{p.titleEn}</p>
                <p className="text-xs text-gray-500">/en/{p.slug} • /ur/{p.slug}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Inbox className="w-5 h-5 text-emerald-700" />
          <h3 className="text-lg font-bold text-gray-900">Public Inbox (Contact, Corrections, Copyright, Advertisers)</h3>
        </div>
        {loading ? (
          <p className="text-xs text-gray-500">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <p className="text-xs text-gray-500">No public submissions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => (
              <div key={s.id} className="p-3 border border-gray-100 rounded-xl text-xs">
                <div className="flex items-center justify-between font-bold text-gray-900">
                  <span>[{s.type}] {s.subject}</span>
                  <span className="text-gray-400">{new Date(s.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-gray-600 mt-1">{s.name} ({s.email}) — {s.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
