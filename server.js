import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import url from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para todas las fuentes
app.use(cors());

// Proxy HLS
app.get('/', async (req, res) => {
    const m3u8Url = req.query.url;
    if (!m3u8Url) return res.status(400).send('Falta parámetro ?url=');

    try {
        const response = await fetch(m3u8Url);
        if (!response.ok) return res.status(500).send('Error al obtener M3U8');

        let text = await response.text();

        // Reescribir rutas relativas de .ts a través del proxy
        // Solo si no comienzan con http:// o https://
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        text = text.replace(/^(?!#)(.+\.ts)$/gm, (match) => {
            const absolute = url.resolve(baseUrl, match);
            return `${req.protocol}://${req.get('host')}/?url=${absolute}`;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(text);

    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el proxy HLS');
    }
});

// Proxy para cualquier archivo (segmentos .ts)
app.get('*', async (req, res) => {
    const fileUrl = req.query.url;
    if (!fileUrl) return res.status(400).send('Falta parámetro ?url=');

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) return res.status(500).send('Error al obtener el archivo');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        response.body.pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el proxy de archivos');
    }
});

app.listen(PORT, () => {
    console.log(`Proxy HLS listo en puerto ${PORT}`);
});
