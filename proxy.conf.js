// Dev-server proxy: forwards /api/* to the Spring backend so the browser needs no CORS setup.
// Inside docker-compose the backend is reachable as http://backend:8080 (set via BACKEND_URL);
// when running `ng serve` directly on the host it falls back to localhost.
const target = process.env['BACKEND_URL'] || 'http://localhost:8080';

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'info',
  },
};
