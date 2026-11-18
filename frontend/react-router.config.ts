import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // SPA mode: the build is plain files (build/client) that a static host serves without a running server,
  // so the site never "sleeps" on free hosting. Every screen renders in the browser anyway (ClientOnly).
  ssr: false,
} satisfies Config;
