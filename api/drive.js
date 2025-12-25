
import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageBase64, filename, folderId } = req.body;

        if (!imageBase64 || !filename) {
            throw new Error('Dados incompletos');
        }

        // 1. Configuração de Autenticação (Service Account)
        // Requer variáveis de ambiente configuradas no Vercel/Server
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Fix para quebras de linha em ENV
        const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!clientEmail || !privateKey || !targetFolderId) {
            // Se não houver credenciais, retornamos 501 para o Frontend fazer fallback para download local
            return res.status(501).json({ 
                error: 'Credenciais de Drive não configuradas. Use fallback local.',
                code: 'NO_CREDENTIALS' 
            });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // 2. Converter Base64 para Stream
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const stream = Readable.from(buffer);

        // 3. Upload para o Drive
        const fileMetadata = {
            name: filename,
            parents: [targetFolderId],
        };

        const media = {
            mimeType: 'image/png', // Assumindo PNG do canvas
            body: stream,
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return res.status(200).json({ 
            success: true, 
            fileId: file.data.id, 
            link: file.data.webViewLink 
        });

    } catch (error) {
        console.error('Google Drive Upload Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
