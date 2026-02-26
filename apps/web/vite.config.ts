import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoBase = "/atlasform-config-engine/";
const base = process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? repoBase : "/");

export default defineConfig({
  plugins: [react()],
  base
});
