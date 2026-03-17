import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Translation endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang = 'RU', sourceLang = 'IT' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for translation' });
    }

    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Translation server is not configured properly (missing API key).' });
    }

    const USE_FREE_API = apiKey.endsWith(':fx');
    const DEEPL_URL = USE_FREE_API 
      ? 'https://api-free.deepl.com/v2/translate' 
      : 'https://api.deepl.com/v2/translate';

    const response = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
        source_lang: sourceLang
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DeepL API Error:', data);
      return res.status(response.status).json({ error: data.message || 'Translation failed via DeepL' });
    }

    if (data.translations && data.translations.length > 0) {
      return res.json({ translation: data.translations[0].text });
    } else {
      return res.status(500).json({ error: 'Unexpected response format from DeepL' });
    }

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Failed to contact translation service.' });
  }
});

// Fallback to index.html for SPA if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running locally at http://localhost:${PORT}`);
});
