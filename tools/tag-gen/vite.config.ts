import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const localToolsEnv = loadEnv(mode, resolve(import.meta.dirname, ".."), "");

  return {
    define: {
      __TAG_GEN_DEFAULT_SECRETS__: JSON.stringify({
        feistelSecret: localToolsEnv.FEISTEL_SECRET_S01 ?? "",
        hmacSecret: localToolsEnv.TAG_HMAC_SECRET_S01 ?? "",
      }),
    },
    test: {
      include: ["test/**/*.test.ts"],
      environment: "node",
    },
  };
});
