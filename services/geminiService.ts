
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getSquareAnalysis(team1: string, team2: string, rowNums: number[], colNums: number[]) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `I am running a Super Bowl Squares game between ${team1} (Rows) and ${team2} (Columns). 
      The randomized numbers for ${team1} are: ${rowNums.join(', ')}.
      The randomized numbers for ${team2} are: ${colNums.join(', ')}.
      
      Give me a short, fun, 2-paragraph "expert analysis" of which square combinations (e.g., Row X, Col Y) are statistically the 'gold mines' based on historical NFL scores, and which ones are the 'safeties' (unlikely to win). 
      Keep it professional yet engaging, like an NFL broadcaster.`,
      config: {
        temperature: 0.8,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis failed", error);
    return "The analyst is currently grabbing a hot dog. Please try again later!";
  }
}
