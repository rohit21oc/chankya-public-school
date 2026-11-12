/**
 * Startup file for cPanel "Setup Node.js App" (MilesWeb / Phusion Passenger).
 * Passenger loads this file with require(), so it must be CommonJS; package.json uses "type": "module",
 * hence the .cjs extension. The real server is the bundle produced by `npm run build`.
 * It serves both the API (/api/*) and the built website from dist/, so one Node.js app runs everything.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./dist/server.cjs');
