'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PencilIcon, SECTION_STYLE } from '@/components/Icons';
import { api } from '@/lib/api';
import { SECTIONS } from '@/lib/constants';
import { getReportId, isManualMode, loadDraft, setManualMode, setReportId } from '@/lib/session';

const EMPTY_SECTIONS = Object.fromEntries(SECTIONS.map((name) => [name, '']));

// UI_4: Review Report
// Normally edits the report that was just generated. In manual mode (microphone denied)
// it creates a new record from the UI_1 inputs and the text typed here.
export default function ReviewPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | ready | empty
  const [manualDraft, setManualDraft] = useState(null);
  const [reportId, setReportIdState] = useState(null);
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [editing, setEditing] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const draft = loadDraft();
    if (isManualMode() && draft) {
      setManualDraft(draft);
      setStatus('ready');
      return;
    }
    const id = getReportId();
    if (!id) {
      setStatus('empty');
      return;
    }
    api(`/api/reports/${encodeURIComponent(id)}`)
      .then(({ report }) => {
        setReportIdState(report.id);
        setSections(Object.fromEntries(SECTIONS.map((name) => [name, report[name] || ''])));
        setStatus('ready');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('empty');
      });
  }, []);

  async function handleSave() {
    const missing = SECTIONS.find((name) => !sections[name].trim());
    if (missing) {
      setError(`Please fill in "${missing}" before saving.`);
      setEditing(missing);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (manualDraft) {
        const { report } = await api('/api/reports', { method: 'POST', body: { ...manualDraft, ...sections } });
        setManualMode(false);
        setReportId(report.id);
      } else {
        await api(`/api/reports/${reportId}`, { method: 'PUT', body: sections });
      }
      router.push('/history?saved=1');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="loading page-medium">
        <span className="spinner" /> Loading report…
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="page-medium">
        {error ? (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        ) : (
          <p className="muted">There is no report to review yet.</p>
        )}
        <Link href="/" className="btn btn-primary btn-block">
          Create New Report
        </Link>
      </div>
    );
  }

  return (
    <div className="page-medium">
      <h1>Review Report</h1>
      <p className="subtitle">You can edit the sections before approving.</p>

      {manualDraft && (
        <div className="notice notice-info">
          <strong>Manual entry</strong>
          The microphone is unavailable, so please type each section for {manualDraft.Student},{' '}
          {manualDraft.Subject}, {manualDraft['Lesson Date']}.
        </div>
      )}

      {SECTIONS.map((name) => {
        const { Icon } = SECTION_STYLE[name];
        const isEditing = editing === name;
        return (
          <div key={name} className={`review-card${isEditing ? ' is-editing' : ''}`}>
            <div className="review-card-head">
              <span className="title">
                <Icon size={18} /> {name}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setEditing(isEditing ? null : name)}
                disabled={saving}
              >
                {isEditing ? (
                  'Done'
                ) : (
                  <>
                    <PencilIcon size={14} /> Edit
                  </>
                )}
              </button>
            </div>
            <textarea
              aria-label={name}
              rows={3}
              value={sections[name]}
              readOnly={!isEditing}
              placeholder={isEditing ? `Type the ${name.toLowerCase()} here…` : 'Click Edit to add text.'}
              onChange={(e) => {
                setSections({ ...sections, [name]: e.target.value });
                setError('');
              }}
            />
          </div>
        );
      })}

      <label className="check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>
          {manualDraft
            ? 'I have reviewed this report and confirm it is accurate.'
            : 'I have reviewed this AI-generated report and confirm it is accurate.'}
        </span>
      </label>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!confirmed || saving}
        onClick={handleSave}
      >
        {saving && <span className="spinner" />}
        {saving ? 'Saving…' : 'Approve & Save'}
      </button>
    </div>
  );
}
