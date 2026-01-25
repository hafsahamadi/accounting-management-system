/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // OBLIGATOIRE pour export statique
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
   reactStrictMode: true,
  // Ajoutez cette section pour exposer REACT_APP_API_URL au code côté client
  env: {
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    // Si vous aviez d'autres variables REACT_APP_ à exposer, ajoutez-les ici.
  },
}


export default nextConfig;