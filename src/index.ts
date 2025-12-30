import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchAndScrape } from './scraper';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send({ status: 'ok', message: 'Perplexity Search API is running' });
});

app.post('/search', async (req, res) => {
    try {
        const { query, focusMode } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log(`[API] Received search request: ${query} (${focusMode})`);
        const result = await searchAndScrape(query, focusMode);

        res.json(result);
    } catch (error: any) {
        console.error('[API] Search failed:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Search server is running on http://localhost:${PORT}`);
});
