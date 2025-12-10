import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import URL from "url";

const app = express();
app.use(cors());

app.get("/", async (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).send("Falta ?url=");

    try {
        const resp = await fetch(target);
        const contentType = resp.headers.get("content-type") || "";

        // Si es M3U8, reescribimos rutas relativas
        if (contentType.includes("application") && contentType.includes("mpeg")) {
            let text = await resp.text();

            const base = target.substring(0, target.lastIndexOf("/") + 1);

            // Reescribe las rutas .ts
            text = text.replace(/(.*\.ts)/g, (match) => {
                // Absolutas = no tocar
                if (match.startsWith("http://") || match.startsWith("https://")) return match;

                // Relativas → pasarlas por el proxy
                const tsURL = base + match;
                return `${req.protocol}://${req.get("host")}/?url=${encodeURIComponent(tsURL)}`;
            });

            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            return res.send(text);
        }

        // Si no es m3u8, devolvemos binario (TS, imágenes, etc.)
        const buffer = await resp.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        res.send(Buffer.from(buffer));

    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
});

// puerto dinámico para Koyeb
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server ON " + PORT));
