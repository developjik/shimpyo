import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { seedDesignPlugin } from "@seed-design/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // 하위 경로 배포(developjik.github.io/shimpyo/) — 커스텀 도메인 연결 시 "/"로 변경
  base: "/shimpyo/",
  plugins: [
    react(),
    seedDesignPlugin({ colorMode: "system" }),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
  },
});
