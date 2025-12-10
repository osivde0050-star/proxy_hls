import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/", async (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).send("Falta ?url=");

    try {
        const resp = await fetch(target, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*"
            }
        });

        const contentType = resp.headers.get("content-type") || "";

        // Si es M3U8 → reescribir rutas
        if (contentType.includes("mpegurl") || contentType.includes("mpeg")) {
            let text = await resp.text();

            // BASE URL del m3u8 original
            const base = target.substring(0, target.lastIndexOf("/") + 1);
            const proxyBase = `${req.protocol}://${req.get("host")}/?url=`;

            // Reescribir solo archivos .ts (relativos)
            text = text.replace(/^(?!#)(.*\.ts.*)$/gm, line => {
                line = line.trim();

                // Si ya es absoluta → no toca
                if (line.startsWith("http://") || line.startsWith("https://"))
                    return line;

                // Generar URL absoluta original
                const absolute = base + line;

                // Pasar por el proxy
                return proxyBase + encodeURIComponent(absolute);
            });

            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            return res.send(text);
        }

        // Si NO es m3u8 → devolver binario (segmentos TS)
        const buffer = Buffer.from(await resp.arrayBuffer());
        res.setHeader("Content-Type", contentType);
        return res.send(buffer);

    } catch (err) {
        return res.status(500).send("Proxy error: " + err.message);
    }
});

// Puerto dinámico para Koyeb
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy HLS activo en puerto " + PORT));

