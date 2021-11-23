import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import viteSentry from "vite-plugin-sentry";

const sentryConfig = {
  authToken: "0015463a69284d88ac6c762ce40bf9bab595c1b7abb14f0db7ae479199869d88",
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
  plugins: [reactRefresh(), viteSentry(sentryConfig)],
});
