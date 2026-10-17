'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircleIcon, PlusIcon, SearchIcon } from '@/components/Icons';
import { api } from '@/lib/api';

function matches(student, query) {
  const q = query.trim().toLowerCase();
  return !q || student.name.toLowerCase().includes(q) || student.studentCode.toLowerCase().includes(q);
}

function Students() {
  const justAdded = useSearchParams().get('added');
  const [state, setState] = useState({ status: 'loading', students: [] });
  const [search, setSearch] = useState('');

  useEffect(() => {
    api('/api/students')
      .then(({ students }) => setState({ status: 'ready', students }))
      .catch((err) => setState({ status: 'error', students: [], message: err.message }));
  }, []);

  const visible = state.students.filter((student) => matches(student, search));

  return (
    <>
      {justAdded && (
        <div className="saved" role="status">
          <CheckCircleIcon size={34} />
          <div>
            <strong>Student Added Successfully</strong>
            <span>{justAdded} has been saved to the student list.</span>
          </div>
        </div>
      )}

      <div className="history-head">
        <h2>Students</h2>
        <Link href="/students/new" className="btn btn-primary btn-small">
          <PlusIcon size={14} /> Add Student
        </Link>
      </div>

      <div className="toolbar">
        <label className="search">
          <SearchIcon size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name or ID"
            aria-label="Search by student name or ID"
          />
        </label>
      </div>

      {state.status === 'loading' && (
        <div className="loading">
          <span className="spinner" /> Loading students…
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice notice-error" role="alert">
          {state.message}
        </div>
      )}

      {state.status === 'ready' && (
        <p className="filter-status" aria-live="polite">
          {search.trim()
            ? `${visible.length} of ${state.students.length} students match “${search.trim()}”`
            : `${state.students.length} ${state.students.length === 1 ? 'student' : 'students'}`}
        </p>
      )}

      {state.status === 'ready' && visible.length === 0 && (
        <p className="muted">
          {state.students.length === 0 ? 'No students have been added yet.' : 'No students match your search.'}
        </p>
      )}

      {visible.length > 0 && (
        <div className="tile-grid">
          {visible.map((student) => (
            <article key={student.id} className="tile student-tile">
              <div className="avatar" aria-hidden="true">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div className="student-info">
                <div className="student">{student.name}</div>
                <div className="muted">Student ID: {student.studentCode}</div>
                <div className="muted">
                  {student.reportCount} {student.reportCount === 1 ? 'report' : 'reports'}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// Students: every student in the "student" table
export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <Students />
    </Suspense>
  );
}
