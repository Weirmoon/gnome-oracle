import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const music = path.join(root, "public/music");
export default defineConfig({
  root: path.join(root, "native"),
  publicDir: path.join(root, "public"),
  plugins: [react()],
  resolve: { alias: [
    { find: "next/link", replacement: path.join(root, "native/shims/link.tsx") },
    { find: "next/dynamic", replacement: path.join(root, "native/shims/dynamic.tsx") },
    { find: "next/navigation", replacement: path.join(root, "native/shims/navigation.ts") },
    { find: "@", replacement: root },
  ] },
  define: { __GNOME_MUSIC__: JSON.stringify(fs.existsSync(music) ? fs.readdirSync(music).filter(f => /\.(mp3|ogg|wav|m4a|aac|flac)$/i.test(f)).sort().map(f => `/music/${encodeURIComponent(f)}`) : []) },
  server: { host: "0.0.0.0", port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: { outDir: path.join(root, "dist-native"), emptyOutDir: true, target: "es2022" },
  clearScreen: false,
});
