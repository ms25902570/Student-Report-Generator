'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CalendarIcon } from '@/components/Icons';
import { api } from '@/lib/api';
import { SUBJECTS, SYLLABUSES, formatLessonDate, studentLabel, todayIso } from '@/lib/constants';
import { saveDraft, setManualMode, setReportId, setReportSource } from '@/lib/session';

// UI_1: Create New Report
export default function CreateReportPage() {
  const router = useRouter();
  const [students, setStudents] = useState({ status: 'loading', list: [] });
  const [studentId, setStudentId] = useState('');
  const [syllabus, setSyllabus] = useState(SYLLABUSES[0]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  // Set on the client so the server-rendered HTML never disagrees about "today".
  useEffect(() => setDate(todayIso()), []);

  useEffect(() => {
    api('/api/students')
      .then(({ students: list }) => {
        setStudents({ status: 'ready', list });
        if (list[0]) setStudentId(String(list[0].id));
      })
      .catch((err) => setStudents({ status: 'error', list: [], message: err.message }));
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const student = students.list.find((s) => String(s.id) === studentId);
    if (!student) {
      setError('Please select a student.');
      return;
    }
    if (!date) {
      setError('Please select the lesson date.');
      return;
    }
    saveDraft({
      studentId: student.id,
      Student: studentLabel(student),
      Syllabus: syllabus,
      Subject: subject,
      lessonDate: date,
      'Lesson Date': formatLessonDate(date),
    });
    setManualMode(false);
    setReportSource(null);
    setReportId(null);
    router.push('/record');
  }

  const noStudents = students.status === 'ready' && students.list.length === 0;

  return (
    <form className="page-narrow" onSubmit={handleSubmit}>
      <h1>Create New Report</h1>

      <div className="field">
        <label htmlFor="student">Student</label>
        <select
          id="student"
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setError('');
          }}
          disabled={students.status !== 'ready' || noStudents}
        >
          {students.status === 'loading' && <option value="">Loading students…</option>}
          {students.status === 'error' && <option value="">Students could not be loaded</option>}
          {noStudents && <option value="">No students yet</option>}
          {students.list.map((student) => (
            <option key={student.id} value={student.id}>
              {studentLabel(student)}
            </option>
          ))}
        </select>
        {students.status === 'error' && (
          <div className="notice notice-error" role="alert">
            {students.message}
          </div>
        )}
        {noStudents && (
          <div className="notice notice-info">
            There are no students yet. <Link href="/students/new">Add a student</Link> first.
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="syllabus">Syllabus</label>
        <select id="syllabus" value={syllabus} onChange={(e) => setSyllabus(e.target.value)}>
          {SYLLABUSES.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="subject">Subject</label>
        <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECTS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="date">Lesson Date</label>
        <div className="date-field">
          <span>{formatLessonDate(date) || 'Select a date'}</span>
          <CalendarIcon size={18} />
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError('');
            }}
            onClick={(e) => e.currentTarget.showPicker?.()}
          />
        </div>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={students.status !== 'ready' || noStudents}>
        Continue →
      </button>
      <Link href="/history" className="btn btn-outline btn-block">
        Student History
      </Link>
    </form>
  );
}
