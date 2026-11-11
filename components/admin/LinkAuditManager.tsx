import React, { useState } from 'react';
import { Link2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export const LinkAuditManager: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/admin/links/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) setReport(data.report);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-emerald-700" />
          <h3 className="text-lg font-bold text-gray-900">Broken Link & Redirect Audit</h3>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Scanning...' : 'Run Link Audit'}</span>
        </button>
      </div>

      {report ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-500">URLs Checked</p>
            <p className="text-2xl font-black text-gray-900">{report.urlsChecked}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs text-emerald-700">Working Links</p>
            <p className="text-2xl font-black text-emerald-800">{report.workingLinks}</p>
          </div>
          <div className="p-4 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs text-red-700">Broken Links</p>
            <p className="text-2xl font-black text-red-800">{report.brokenLinks}</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-amber-700">Temp Failures</p>
            <p className="text-2xl font-black text-amber-800">{report.temporaryFailures}</p>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Click "Run Link Audit" to verify all public routes, sitemaps, and RSS feeds.</span>
        </div>
      )}

      {report?.issuesRequiringReview?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Issues Requiring Review</span>
          </h4>
          {report.issuesRequiringReview.map((item: any, idx: number) => (
            <div key={idx} className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-900">
              {item.url} — Status {item.status} ({item.issue})
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
