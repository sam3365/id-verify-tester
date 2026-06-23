/** @type {import('next').NextConfig} */
const nextConfig = {
  // stripe uses Node built-ins — keep it server-side only
  serverExternalPackages: ["stripe"],
};

export default nextConfig;
