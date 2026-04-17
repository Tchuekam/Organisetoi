import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Routes
  app.post("/api/ai/generate-content", async (req, res) => {
    try {
      const { topic } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Génère 3 idées de contenu pour les réseaux sociaux sur le thème suivant : "${topic}". 
        Pour chaque idée, fournis :
        1. Un titre accrocheur
        2. Un type (Reel, Image, Story)
        3. Une catégorie (Informatif, Divertissant, Promotionnel)
        4. Un court script ou description.
        Réponds au format JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                titre: { type: Type.STRING },
                type: { type: Type.STRING },
                catégorie: { type: Type.STRING },
                script: { type: Type.STRING },
                description: { type: Type.STRING }
              }
            }
          }
        }
      });
      res.json(JSON.parse(response.text || "[]"));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/refine-caption", async (req, res) => {
    try {
      const { draft } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Améliore cette légende pour Instagram/TikTok pour la rendre plus engageante et professionnelle : "${draft}". Ajoute des hashtags pertinents.`,
      });
      res.json({ text: response.text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/market-insights", async (req, res) => {
    try {
      const { niche } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `En tant qu'expert en marketing digital spécialisé sur le marché africain (notamment le Cameroun), génère une analyse de marché pour la niche suivante : "${niche}".
        
        Fournis les informations au format JSON avec la structure suivante :
        {
          "viralTopics": [
            { "title": "Titre du sujet", "description": "Pourquoi ça marche en Afrique/Cameroun", "format": "Reel/Post/Story" }
          ],
          "trendingHashtags": ["#hashtag1", "#hashtag2"],
          "competitorAnalysis": [
            { "type": "Concurrent direct", "strategy": "Leur stratégie actuelle", "opportunity": "Comment faire mieux" }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              viralTopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    format: { type: Type.STRING }
                  }
                }
              },
              trendingHashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              competitorAnalysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    strategy: { type: Type.STRING },
                    opportunity: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/analyze-prospect", async (req, res) => {
    try {
      const { prospect } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Analyse ce prospect pour un Community Manager :
        Nom: ${prospect.name}
        Source: ${prospect.source}
        Notes: ${prospect.notes || 'N/A'}
        Date d'ajout: ${prospect.createdAt}
        
        Donne un score de potentiel de 0 à 100 et une recommandation stratégique courte (max 20 mots).
        Réponds en JSON: { "score": number, "recommendation": string }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              recommendation: { type: Type.STRING }
            }
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/outreach-messages", async (req, res) => {
    try {
      const { prospectName, niche, tone } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Génère une séquence de prospection pour ${prospectName} (Niche: ${niche}) avec un ton ${tone}.
        Marché: Cameroun/Afrique.
        Inclus:
        1. Message d'accroche (Initial)
        2. Relance 1 (J+2)
        3. Relance 2 (J+5)
        
        Réponds en JSON: 
        { 
          "initial": "...", 
          "followup1": "...", 
          "followup2": "..." 
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              initial: { type: Type.STRING },
              followup1: { type: Type.STRING },
              followup2: { type: Type.STRING }
            }
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { history, message } = req.body;
      const ai = getAi();
      const chat = ai.chats.create({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: `Tu es un expert en stratégie marketing digital, social media et growth hacking spécialisé dans les marchés africains (notamment Cameroun).
    
    OBJECTIF :
    Créer un calendrier éditorial professionnel, stratégique et automatisable pour une marque, bien plus avancé qu’un simple calendrier visuel.
    
    MISSION :
    Créer un calendrier éditorial complet avec des fonctionnalités avancées.
    
    STRUCTURE ATTENDUE :
    
    1. 📅 CALENDRIER MENSUEL STRUCTURÉ
    - Organisation par jour
    - Fréquence optimisée (pas juste poster tous les jours)
    - Types de contenus équilibrés (éducation, vente, storytelling, engagement, preuve sociale)
    
    2. 🧠 STRATÉGIE DERRIÈRE CHAQUE POST
    Pour chaque publication, inclure :
    - Objectif du post (engagement / conversion / branding)
    - Angle psychologique utilisé (FOMO, preuve sociale, curiosité, autorité…)
    - Hook (première phrase ultra captivante)
    - Call to action optimisé
    
    3. 📊 SYSTÈME DE PERFORMANCE
    - KPI à suivre pour chaque type de contenu
    - Méthode pour analyser ce qui fonctionne
    - Suggestions d’optimisation hebdomadaire
    
    4. 🔥 CONTENUS VIRAL & HIGH-CONVERTING
    - Idées de contenus viraux adaptés au Cameroun (slang local, culture)
    - Scripts de posts Facebook à fort engagement
    - Idées de reels / vidéos courtes
    
    5. 🧩 AUTOMATISATION & SCALING
    - Suggestions pour automatiser la création de contenu avec IA
    - Réutilisation intelligente du contenu (repurposing)
    - Organisation type Notion / Airtable
    
    6. 🎯 OFFRES & MONÉTISATION
    - Intégrer des offres irrésistibles (style Alex Hormozi)
    - Stratégie de promotion sans paraître “vendeur”
    - Calendrier de push commerciaux intelligent
    
    7. 🖼️ GUIDELINES VISUELLES
    - Types de visuels à utiliser (mockups, photos, UGC, avant/après)
    - Où placer des placeholders d’images
    - Direction artistique (luxury / minimal / bold)
    
    8. 📈 PLAN HEBDOMADAIRE + EXÉCUTION
    - Que faire chaque jour (posting + interaction + DM)
    - Routine du community manager
    
    FORMAT :
    - Clair, structuré, prêt à être utilisé directement
    - Inclure tableaux + listes + exemples concrets
    - Langage simple mais stratégique
    
    IMPORTANT :
    Ce calendrier doit être supérieur à un calendrier classique. Il doit agir comme un système de croissance complet pour la marque.`,
        },
        history: history as any,
      });
    
      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analytics: Aggregate stats
  app.get("/api/analytics/summary", (req, res) => {
    // Mock aggregation logic
    res.json({
      leadsPerSource: { WhatsApp: 10, Facebook: 15, Marketplace: 5 },
      conversionRate: 0.12,
      responseRate: 0.45
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
