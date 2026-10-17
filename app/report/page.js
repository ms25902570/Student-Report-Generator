'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PencilIcon } from '@/components/Icons';
import ReportView from '@/components/ReportView';
import { api } from '@/lib/api';
import { getReportId, getReportSource } from '@/lib/session';

const SOURCE_NOTE = {
  gemini: 'Generated with Gemini.',
  rules: 'Generated with the built-in keyword parser (no GEMINI_API_KEY is set).',
  'rules-fallback': 'Gemini could not be reached, so the built-in keyword parser was used.',
};

// UI_3: shows the report that was just generated (student_history table)
export default function ReportPage() {
  const [state, setState] = useState({ status: 'loading' });
  const [source, setSource] = useState(null);

  useEffect(() => {
    setSource(getReportSource());
    const id = getReportId();
    if (!id) {
      setState({ status: 'ready', report: null });
      return;
    }
    api(`/api/reports/${encodeURIComponent(id)}`)
      .then(({ report }) => setState({ status: 'ready', report }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="loading">
        <span className="spinner" /> Loading report…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="notice notice-error" role="alert">
        {state.message}
      </div>
    );
  }

  if (!state.report) {
    return (
      <>
        <p className="muted">No report has been generated yet.</p>
        <Link href="/" className="btn btn-primary btn-block">
          Create New Report
        </Link>
      </>
    );
  }

  return (
    <>
      <ReportView report={state.report} />
      {SOURCE_NOTE[source] && <p className="muted center">{SOURCE_NOTE[source]}</p>}
      <div className="actions">
        <Link href="/review" className="btn btn-outline">
          <PencilIcon size={16} /> Edit Report
        </Link>
      </div>
    </>
  );
}
