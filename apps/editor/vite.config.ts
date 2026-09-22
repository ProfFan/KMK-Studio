import { fileURLToPath } from "node:url";
import { defineConfig, type Connect } from "vite";

const docsRoute: Connect.NextHandleFunction = (request, response, next) => {
  if (request.url?.split("?")[0] === "/docs") {
    response.writeHead(302, {
      Location: request.url.replace("/docs", "/docs/"),
    });
    response.end();
  } else next();
};

// A real docs/index.html also supports direct visits on static hosts.
// Mermaid is only imported by the documentation entry, never the editor.
export default defineConfig({
  plugins: [
    {
      name: "docs-directory-route",
      configureServer: (server) => {
        server.middlewares.use(docsRoute);
      },
      configurePreviewServer: (server) => {
        server.middlewares.use(docsRoute);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        studio: fileURLToPath(new URL("./index.html", import.meta.url)),
        docs: fileURLToPath(new URL("./docs/index.html", import.meta.url)),
      },
    },
  },
});
