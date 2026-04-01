import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

const ANALYSIS_PROMPT = `You are an expert soccer coach analyzing a solo training video. Watch the ENTIRE video carefully from start to finish.

This video shows a player doing solo training. There are TWO different targets visible in the video:
1. A GOAL — a structure with a net where the player tries to score
2. A WALL or REBOUNDER — a flat surface where the ball bounces back to the player

YOUR JOB: Look at WHERE the ball goes after each kick to classify it correctly.

CLASSIFICATION RULES:
- SHOT: The player kicks the ball toward the GOAL (the structure with a net). Look for the net, goalposts, or crossbar. If the ball travels toward that structure, it is a SHOT regardless of power.
  - goal=true: The ball enters the net (goes past the goal line, hits the back netting)
  - goal=false: The ball misses (hits post, goes wide, goes over, saved, or doesn't reach)

- PASS: The player kicks the ball toward the WALL or REBOUNDER (a flat surface with no net). The ball bounces back. If you see the ball hit a flat surface and return toward the player, it is a PASS.
  - successful=true: Ball returns to within the player's control
  - successful=false: Ball bounces away or player can't control the return

HOW TO TELL THEM APART:
- Look at the TARGET. Goal has a net/frame. Wall is flat.
- Look at the RESULT. Shots go into a net or miss a net. Passes bounce back off a flat surface.
- The player may face different directions for shots vs passes — notice when they turn or reposition.
- There may be sections of the video dedicated to each drill.

COUNTING:
- Count each deliberate kick as ONE event
- Do NOT count: ball rolling, picking up the ball, dribbling touches, or minor touches while setting up
- Watch the FULL video start to finish

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{
  "duration": <estimated session duration in minutes>,
  "drills": [<detected drill names from: "Finishing Drill", "Shooting (Inside Box)", "Shooting (Outside Box)", "Wall Passes (1-touch)", "Wall Passes (2-touch)", "Long Passing", "Short Passing Combos", "Crossing & Finishing", "Free Kicks", "Rondo", "Dribbling Circuit", "Sprint Intervals">],
  "quickRating": <overall session quality 1-10>,
  "shooting": {
    "shotsTaken": <number of shots at goal>,
    "goals": <number that went into the net>,
    "leftFoot": { "shots": <number>, "goals": <number> },
    "rightFoot": { "shots": <number>, "goals": <number> },
    "confidence": "high|medium|low"
  },
  "passing": {
    "attempts": <number of wall passes>,
    "completed": <number where ball returned to player>,
    "keyPasses": 0,
    "confidence": "high|medium|low"
  },
  "fitness": {
    "rpe": <estimated exertion 1-10>,
    "sprints": 0,
    "distance": 0,
    "confidence": "low"
  },
  "sessionType": "Free",
  "notes": "<2-3 sentence summary of the session>",
  "overallConfidence": "high|medium|low"
}`;

export function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

export async function analyzeVideo(videoPath) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set. Add it to your .env file to enable video analysis.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Upload video file to Gemini
  logger.info('Uploading video to Gemini...', { videoPath });

  const ext = path.extname(videoPath).toLowerCase();
  const mimeTypes = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm', '.mkv': 'video/x-matroska' };
  const mimeType = mimeTypes[ext] || 'video/mp4';

  const videoFile = await ai.files.upload({
    file: videoPath,
    config: { mimeType },
  });

  // Wait for processing
  let file = await ai.files.get({ name: videoFile.name });
  while (file.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000));
    file = await ai.files.get({ name: file.name });
  }

  if (file.state === 'FAILED') {
    throw new Error('Gemini video processing failed');
  }

  logger.info('Video processed, sending to model...');

  // Try pro first, fall back to flash
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];
  let response = null;
  let lastError = null;

  for (const model of models) {
    try {
      logger.info(`Trying model: ${model}`);
      response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
      });
      break;
    } catch (err) {
      lastError = err;
      if (String(err).includes('RESOURCE_EXHAUSTED') || String(err).includes('429')) {
        logger.info(`${model} quota exceeded, trying fallback...`);
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    throw new Error(`All models failed. Last error: ${lastError?.message || lastError}`);
  }

  // Cleanup uploaded file
  try {
    await ai.files.delete({ name: file.name });
  } catch { /* ignore */ }

  // Parse response
  const text = response.text?.trim() || '';
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start >= 0 && end > start) {
      jsonStr = text.slice(start, end);
    }
  }

  try {
    const result = JSON.parse(jsonStr);
    logger.info('Video analysis complete', { confidence: result.overallConfidence });
    return result;
  } catch {
    logger.error('Failed to parse Gemini response as JSON', { text: text.slice(0, 500) });
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}
