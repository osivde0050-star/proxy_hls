import http from "http";
import https from "https";
import url from "url";

const PORT = process.env.PORT || 3000;

function rewriteM3U8(content, baseUrl, proxyBase) {
  const lines = content.split("\n");
  const out = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // Líneas que no son URLs
    if (
      trimmed.startsWith("#") ||
      trimmed === ""
    ) {
      out.push(trimmed);
      continue;
    }

    // Si es URL absoluta → No reescribir
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      out.push(`${proxyBase}?url=${encodeURIComponent(trimmed)}`);
      continue;
    }

    // Es relativa → convertir a absoluta usando baseUrl
    const absoluteUrl = new URL(trimmed, baseUrl).toString();

    // Pasarla por el proxy también
    out.push(`${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`);
  }

  return out.join("\n");
}

http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let target = parsed.query.url;

  if (!target) {
    res.writeHead(400);
    return res.end("Falta ?url=");
  }

  const proxyBase = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  console.log("Proxy:", target);

  const client = target.startsWith("https://") ? https : http;

  client.get(
    target,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Android 11)",
        "Accept": "*/*",
      },
    },
    (resp) => {
      const type = resp.headers["content-type"] || "";

      // Si es M3U8, reescribirlo
      if (type.includes("application/vnd.apple.mpegurl") || target.endsWith(".m3u8")) {
        let data = "";
        resp.on("data", (chunk) => (data += chunk));
        resp.on("end", () => {
          const rewritten = rewriteM3U8(
            data,
            target,
            proxyBase
          );

          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
          });
          res.end(rewritten);
        });
        return;
      }

      // Si NO es m3u8 → pasar bytes (segmentos TS, AAC, JPG...)
      res.writeHead(resp.statusCode, resp.headers);
      resp.pipe(res);
    }
  ).on("error", (err) => {
    res.writeHead(500);
    res.end("Error: " + err.toString());
  });
}).listen(PORT, () => {
  console.log("Proxy HLS activo en puerto", PORT);
});
