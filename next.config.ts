import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libera abrir o "npm run dev:celular" pelo IP da rede local (ex: http://192.168.0.10:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // esconde o botão "N" do Next que aparece no canto da tela durante o npm run dev
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
