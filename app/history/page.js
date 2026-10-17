'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircleIcon, FileIcon, FlagIcon, PlusIcon, SearchIcon } from '@/components/Icons';
import { api } from '@/lib/api';
import { currentWeekIso, formatLessonDate, shortProgress, toLines } from '@/lib/constants';

const SEARCH_DELAY_MS = 250;

// Which reports are shown: this week (default), a chosen date range, or everything.
function describeFilter(filter) {
  if (filter.mode === 'all') return 'Showing all reports';
  const from = formatLessonDate(filter.from);
  const to = formatLessonDate(filter.to);
  const range = from && to ? `${from} – ${to}` : from ? `from ${from}` : `up to ${to}`;
  return filter.mode === 'week' ? `Showing this week (${range})` : `Showing ${range}`;
}

function History() {
  const justSaved = useSearchParams().get('saved') === '1';
  const [filter, setFilter] = useState(null); // { mode: 'week' | 'range' | 'all', from, to }
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ status: 'loading' });

  // The current week is worked out in the browser so it follows the user's own calendar.
  useEffect(() => setFilter({ mode: 'week', ...currentWeekIso() }), []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!filter) return;
    const params = new URLSearchParams();
    if (filter.mode !== 'all') {
      if (filter.from) params.set('from', filter.from);
      if (filter.to) params.set('to', filter.to);
    }
    if (search) params.set('search', search);

    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));
    api(`/api/reports?${params}`)
      .then(({ reports }) => !cancelled && setState({ status: 'ready', reports }))
      .catch((err) => !cancelled && setState({ status: 'error', message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [filter, search]);

  function applyRange(event) {
    event.preventDefault();
    if (!rangeFrom && !rangeTo) {
      setRangeError('Choose a start date, an end date, or both.');
      return;
    }
    if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
      setRangeError('The start date must be on or before the end date.');
      return;
    }
    setRangeError('');
    setFilter({ mode: 'range', from: rangeFrom, to: rangeTo });
  }

  function clearFilter() {
    setRangeFrom('');
    setRangeTo('');
    setRangeError('');
    setFilter({ mode: 'week', ...currentWeekIso() });
  }

  function showAll() {
    setRangeError('');
    setFilter({ mode: 'all' });
  }

  const reports = state.reports || [];

  return (
    <>
      {justSaved && (
        <div className="saved" role="status">
          <CheckCircleIcon size={34} />
          <div>
            <strong>Report Saved Successfully</strong>
            <span>The report has been saved to the student history.</span>
          </div>
        </div>
      )}

      <div className="history-head">
        <h2>Student History</h2>
        <Link href="/" className="btn btn-primary btn-small">
          <PlusIcon size={14} /> Add New Report
        </Link>
      </div>

      <div className="toolbar">
        <label className="search">
          <SearchIcon size={18} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by student name"
            aria-label="Search by student name"
          />
        </label>

        <form className="date-range" onSubmit={applyRange}>
          <label>
            <span>From</span>
            <input type="date" value={rangeFrom} max={rangeTo || undefined} onChange={(e) => setRangeFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={rangeTo} min={rangeFrom || undefined} onChange={(e) => setRangeTo(e.target.value)} />
          </label>
          <div className="date-range-actions">
            <button type="submit" className="btn btn-primary btn-small">
              Apply
            </button>
            <button type="button" className="btn btn-outline btn-small" onClick={clearFilter}>
              Clear filter
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={showAll}
              aria-pressed={filter?.mode === 'all'}
            >
              Show all
            </button>
          </div>
        </form>
      </div>

      {rangeError && (
        <div className="notice notice-error" role="alert">
          {rangeError}
        </div>
      )}

      {filter && (
        <p className="filter-status" aria-live="polite">
          {describeFilter(filter)}
          {search && <> · matching “{search}”</>}
          {state.status === 'ready' && <> · {reports.length} {reports.length === 1 ? 'report' : 'reports'}</>}
        </p>
      )}

      {state.status === 'loading' && !state.reports && (
        <div className="loading">
          <span className="spinner" /> Loading history…
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice notice-error" role="alert">
          {state.message}
        </div>
      )}

      {state.status === 'ready' && reports.length === 0 && (
        <p className="muted">
          {search || filter?.mode !== 'all' ? 'No reports match this filter.' : 'No reports have been saved yet.'}
        </p>
      )}

      {state.status !== 'error' && reports.length > 0 && (
        <div className={`tile-grid${state.status === 'loading' ? ' is-stale' : ''}`}>
          {reports.map((report) => (
            <article key={report.id} className="tile">
              <div className="tile-top">
                <span className="student">{report.Student}</span>
                <span className="badge">
                  {report.Syllabus}: {report.Subject}
                </span>
              </div>
              <div className="tile-date">{report['Lesson Date']}</div>
              <div className="tile-progress">{shortProgress(report.Progress)}</div>

              <div className="reminder">
                <FlagIcon size={20} />
                <div>
                  <h4>Next Steps / Homework</h4>
                  <ul>
                    {toLines(report['Next Steps / Homework']).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <Link href={`/history/view?id=${report.id}`} className="btn btn-outline btn-small">
                <FileIcon size={14} /> View Report
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// UI_5: Student History
export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <History />
    </Suspense>
  );
}
