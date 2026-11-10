import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        // Spring's /ws has no allowed origins configured -> rejects
        // localhost:5173. Pretend the handshake comes from the backend itself.
        configure: (proxy) => {
          proxy.on("proxyReqWs", (proxyReq) => {
            proxyReq.setHeader("origin", "http://localhost:8080");
          });
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
