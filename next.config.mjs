// Cabeçalhos de segurança aplicados a todas as respostas.
// Referência: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
// ("Without Nonces"). Em desenvolvimento o React precisa de 'unsafe-eval'.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

// HSTS: obriga HTTPS por 2 anos. Navegadores ignoram este cabeçalho em
// conexões HTTP, então não atrapalha o uso local com `npm run start:local`.
if (!isDev) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Downloads de anexos definem a própria CSP (sandbox).
        source: "/((?!api/v1/attachments/).*)",
        headers: securityHeaders,
      },
      {
        source: "/api/v1/attachments/:id",
        headers: securityHeaders.filter(
          (header) => header.key !== "Content-Security-Policy",
        ),
      },
      {
        // O link de redefinição leva o token na URL: não vazar via Referer.
        source: "/redefinir-senha",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
