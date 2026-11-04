import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  // Bundled, ws breaks at runtime ("b.mask is not a function") — the Neon driver needs it as-is.
  serverExternalPackages: ['ws', '@neondatabase/serverless', '@prisma/adapter-neon'],
};

export default nextConfig;
