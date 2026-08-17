import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { seedDesignPlugin } from "@seed-design/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    react(),
    seedDesignPlugin({ colorMode: "system" }),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
  },
});
