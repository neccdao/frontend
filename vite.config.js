import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import viteSentry from "vite-plugin-sentry";

const sentryConfig = {
  authToken: "56ad6e3e8420448bac5a0781263e6dddeded93f604634631924a7fc123c5836a",
  org: "necc-protocol",
  project: "frontend",
  deploy: {
    env: "production",
  },
  setCommits: {
    auto: true,
  },
  sourceMaps: {
    include: ["./dist/assets"],
    ignore: ["node_modules"],
    urlPrefix: "~/assets",
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [reactRefresh(), viteSentry(sentryConfig)],
});
