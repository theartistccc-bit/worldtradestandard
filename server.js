const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const prompt = req.body.prompt;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = message.content?.[0]?.text || '';
    res.json({ reply });

  } catch (error) {
    console.error('Anthropic error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'WorldTradeStandard backend online' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WTS backend running on port ${PORT}`));
