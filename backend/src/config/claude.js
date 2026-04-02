const Anthropic = require('@anthropic-ai/sdk');

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('Missing ANTHROPIC_API_KEY environment variable. AI features may fail.');
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

module.exports = anthropic;
