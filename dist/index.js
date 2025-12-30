"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const scraper_1 = require("./scraper");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.send({ status: 'ok', message: 'Perplexity Search API is running' });
});
app.post('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { query, focusMode } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }
        console.log(`[API] Received search request: ${query} (${focusMode})`);
        const result = yield (0, scraper_1.searchAndScrape)(query, focusMode);
        res.json(result);
    }
    catch (error) {
        console.error('[API] Search failed:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
}));
app.listen(PORT, () => {
    console.log(`Search server is running on http://localhost:${PORT}`);
});
