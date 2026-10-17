'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'New Report', match: (path) => ['/', '/record', '/report', '/review'].includes(path) },
  { href: '/students', label: 'Students', match: (path) => path.startsWith('/students') },
  { href: '/history', label: 'History', match: (path) => path.startsWith('/history') },
];

export default function NavBar() {
  const pathname = usePathname() || '/';
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map(({ href, label, match }) => (
        <Link key={href} href={href} className="nav-link" aria-current={match(pathname) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
