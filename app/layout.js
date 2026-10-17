import NavBar from '@/components/NavBar';
import './globals.css';

export const metadata = {
  title: 'AI Report Generator',
  description: 'AI-assisted student progress report generator',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <header className="app-header">
            <div className="container header-inner">
              <span className="brand">AI Report Generator</span>
              <NavBar />
            </div>
          </header>
          <main className="app-body container">{children}</main>
        </div>
      </body>
    </html>
  );
}
