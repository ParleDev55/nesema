import { createRequire } from "module";
const require = createRequire(import.meta.url);

// PWA disabled — next-pwa's Workbox service worker intercepts Next.js App
// Router RSC navigation requests (RSC: 1 header) and caches the wrong
// response format, causing blank screens. Re-enable only after verifying
// App Router compatibility.
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
