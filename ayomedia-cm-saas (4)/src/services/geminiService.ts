import axios from 'axios';

export const generateContentIdeas = async (topic: string) => {
  try {
    const response = await axios.post('/api/ai/generate-content', { topic });
    return response.data;
  } catch (err) {
    console.error("AI content generation error:", err);
    return [];
  }
};

export const refineCaption = async (draft: string) => {
  try {
    const response = await axios.post('/api/ai/refine-caption', { draft });
    return response.data.text;
  } catch (err) {
    console.error("AI caption refinement error:", err);
    return draft;
  }
};

export const generateMarketInsights = async (niche: string) => {
  try {
    const response = await axios.post('/api/ai/market-insights', { niche });
    return response.data;
  } catch (err) {
    console.error("AI market insights error:", err);
    return null;
  }
};

export const analyzeProspect = async (prospect: any) => {
  try {
    const response = await axios.post('/api/ai/analyze-prospect', { prospect });
    return response.data;
  } catch (err) {
    console.error("AI prospect analysis error:", err);
    return { score: 50, recommendation: "Analyse indisponible" };
  }
};

export const generateOutreachMessages = async (prospectName: string, niche: string, tone: string) => {
  try {
    const response = await axios.post('/api/ai/outreach-messages', { prospectName, niche, tone });
    return response.data;
  } catch (err) {
    console.error("AI outreach messages error:", err);
    return null;
  }
};

export const chatWithGemini = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string) => {
  try {
    const response = await axios.post('/api/ai/chat', { history, message });
    return response.data.text;
  } catch (err) {
    console.error("AI chat error:", err);
    return "Désolé, une erreur est survenue lors de la communication avec l'IA.";
  }
};
