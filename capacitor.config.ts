import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chrbec.pragbingo",
  appName: "OurEvent",
  webDir: "dist-capacitor",
  // Avoids a SwiftPM package identity collision for this plugin - see
  // https://github.com/capawesome-team/capacitor-firebase/issues/959
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/authentication": {
            symlink: true,
          },
        },
      },
    },
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com", "apple.com"],
    },
  },
};

export default config;
