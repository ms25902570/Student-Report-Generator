import { SECTIONS, toLines } from '@/lib/constants';
import { SECTION_STYLE } from './Icons';

// The read-only report used by UI_3 and UI_6.
export default function ReportView({ report }) {
  return (
    <>
      <div className="report-head">
        <div>
          <h1>Student Progress Report</h1>
          <div className="muted">
            {report.Syllabus}: {report.Subject}
          </div>
        </div>
        <div className="meta">
          <div>Date: {report['Lesson Date']}</div>
          <div>Student: {report.Student}</div>
        </div>
      </div>

      <div className="section-grid">
        {SECTIONS.map((name) => {
          const { className, Icon } = SECTION_STYLE[name];
          const lines = toLines(report[name]);
          return (
            <section key={name} className={`section ${className}`}>
              <Icon size={22} />
              <div>
                <h3>{name}</h3>
                {name === 'Progress' ? (
                  <p>{lines.join(' ')}</p>
                ) : (
                  <ul>
                    {lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
