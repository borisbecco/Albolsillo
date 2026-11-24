import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdfkit lee sus fuentes (AFM) del disco: se carga desde node_modules sin empaquetar.
  serverExternalPackages: ["pdfkit", "imapflow", "mailparser", "tesseract.js"],
};

export default nextConfig;
