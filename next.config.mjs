/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Unique per Vercel deployment; baked into the client bundle so the running
    // tab knows which build it is. Compared against /api/version at runtime to
    // detect when a newer deploy has shipped. "dev" locally.
    NEXT_PUBLIC_DEPLOY_ID: process.env.VERCEL_URL || "dev",
  },
};

export default nextConfig;
