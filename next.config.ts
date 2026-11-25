import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdfkit lee sus fuentes (AFM) del disco: se carga desde node_modules sin empaquetar.
  serverExternalPackages: ["pdfkit", "imapflow", "mailparser", "tesseract.js"],
  // Encabezados de seguridad en todas las respuestas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No se puede meter la app dentro de otra página (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La app no usa cámara, micrófono ni ubicación.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // Siempre por HTTPS (Railway ya lo sirve así).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
