import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aiuniverse.app",
  appName: "AI Universe",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
