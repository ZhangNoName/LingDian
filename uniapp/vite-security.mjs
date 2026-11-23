const OPEN_IN_EDITOR_ROUTE = "/__open-in-editor";

export function isOpenInEditorRequest(url) {
  const pathname = url?.split("?", 1)[0] ?? "";
  if (!pathname.startsWith(OPEN_IN_EDITOR_ROUTE)) return false;

  const boundary = pathname.at(OPEN_IN_EDITOR_ROUTE.length);
  return boundary === undefined || boundary === "/" || boundary === ".";
}

export function blockWindowsOpenInEditor(platform = process.platform) {
  return {
    name: "block-windows-open-in-editor",
    configureServer(server) {
      if (platform !== "win32") return;
      server.middlewares.use((request, response, next) => {
        if (!isOpenInEditorRequest(request.url)) {
          next();
          return;
        }
        response.statusCode = 404;
        response.end("Not found");
      });
    },
  };
}
