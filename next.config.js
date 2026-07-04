/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Conservative, non-breaking security headers. (A strict script-src CSP is a
// recommended follow-up but needs in-browser tuning against Lottie/AOS/analytics.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  turbopack: {
    resolveAlias: {
      "@/": "./",              // <- 把 @/ 指向專案根目錄
      "@/models": "./models",  // <- 也可以針對特定資料夾設別名
      "@/lib": "./lib",
      // 看你專案結構再加
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig)
