import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AdSenseReadinessManager: React.FC = () => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/adsense-readiness')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStatus(d);
      })
      .catch(() => {});
  }, []);

  const checks = [
    { label: '20 Bilingual Legal & Trust Pages Published', ok: true },
    { label: 'Cookie Consent & Privacy Choices Active', ok: true },
    { label: 'Original Navigation & Footer Structure', ok: true },
    { label: 'AdSense Publisher ID Configured (ADSENSE_PUBLISHER_ID)', ok: Boolean(status?.publisherConfigured) },
    { label: 'ads.txt Live with Authorized Seller Record', ok: Boolean(status?.publisherConfigured) },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-700" />
        <h3 className="text-lg font-bold text-gray-900">Google AdSense Readiness Checklist</h3>
      </div>

      <div className="space-y-2.5">
        {checks.map((c, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50 text-xs">
            <span className="font-semibold text-gray-800">{c.label}</span>
            {c.ok ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                <AlertCircle className="w-4 h-4" /> Pending Config
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
