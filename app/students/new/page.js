'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BackIcon, PlusIcon } from '@/components/Icons';
import { api } from '@/lib/api';

// Add Student: saves a new row to the "student" table
export default function AddStudentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please enter the student name.');
      return;
    }
    if (!studentCode.trim()) {
      setError('Please enter the student ID.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { student } = await api('/api/students', { method: 'POST', body: { name, studentCode } });
      router.push(`/students?added=${encodeURIComponent(student.name)}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="page-narrow" onSubmit={handleSubmit} noValidate>
      <h1>Add Student</h1>
      <p className="subtitle">The student will appear in the Create New Report list.</p>

      <div className="field">
        <label htmlFor="name">Student Name</label>
        <input
          id="name"
          className="input"
          value={name}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="e.g. Kavindu Perera"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="studentCode">Student ID</label>
        <input
          id="studentCode"
          className="input"
          value={studentCode}
          maxLength={20}
          autoComplete="off"
          onChange={(e) => {
            setStudentCode(e.target.value.toUpperCase());
            setError('');
          }}
          placeholder="e.g. S004"
          required
        />
        <p className="hint">Letters, numbers and hyphens. Each student ID must be unique.</p>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
        {saving ? <span className="spinner" /> : <PlusIcon size={16} />}
        {saving ? 'Saving…' : 'Add Student'}
      </button>
      <Link href="/students" className="btn btn-outline btn-block">
        <BackIcon size={16} /> Back to Students
      </Link>
    </form>
  );
}
