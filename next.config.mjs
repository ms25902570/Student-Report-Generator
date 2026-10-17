// The frontend talks to the Node.js backend (backend/server.js) through this proxy,
// so browser code can simply call /api/... on its own origin.
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
