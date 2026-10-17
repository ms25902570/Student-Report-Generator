'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { BackIcon } from '@/components/Icons';
import ReportView from '@/components/ReportView';
import { api } from '@/lib/api';

function SavedReport() {
  const id = useSearchParams().get('id');
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!id) {
      setState({ status: 'ready', report: null });
      return;
    }
    api(`/api/reports/${encodeURIComponent(id)}`)
      .then(({ report }) => setState({ status: 'ready', report }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [id]);

  return (
    <>
      {state.status === 'loading' && (
        <div className="loading">
          <span className="spinner" /> Loading report…
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice notice-error" role="alert">
          {state.message}
        </div>
      )}

      {state.status === 'ready' &&
        (state.report ? (
          <ReportView report={state.report} />
        ) : (
          <p className="muted">This report could not be found in the student history.</p>
        ))}

      <div className="actions">
        <Link href="/history" className="btn btn-outline">
          <BackIcon size={16} /> Back to Student History
        </Link>
      </div>
    </>
  );
}

// UI_6: a saved report, selected by its id in the student_history table
export default function ViewReportPage() {
  return (
    <Suspense fallback={null}>
      <SavedReport />
    </Suspense>
  );
}
