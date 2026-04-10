/**
 * Manus API Client — creates and polls deep-research scouting tasks.
 *
 * Manus API v2 docs: https://open.manus.im/docs
 * Base URL: https://api.manus.ai
 * Auth: x-manus-api-key header
 */

import { logger } from '../logger.js';

const MANUS_BASE = 'https://api.manus.ai';

// ── Prompt Template ──────────────────────────────
// Kept as a constant so it can be edited without code changes elsewhere.

const SCOUTING_PROMPT_TEMPLATE = `You are a professional youth soccer scouting analyst. Your job is to produce a detailed, structured scouting report on the following opponent club and team.

OPPONENT DETAILS:
- Club Name: {{clubName}}
- Competition Level: {{level}}
- Age Group: {{ageGroup}}
- Gender: {{gender}}
{{#if location}}- Location/Region: {{location}}{{/if}}
{{#if matchDate}}- Upcoming Match Date: {{matchDate}}{{/if}}

INSTRUCTIONS:
1. Research this club and team thoroughly using all available online sources (club websites, social media, tournament results, league standings, news articles, MaxPreps, GoalNation, TopDrawerSoccer, local media, etc.)
2. Produce a structured scouting dossier with the following sections. For EACH section, include a Confidence Rating from 1-5:
   - 5 = highly confident, multiple corroborating sources
   - 4 = confident, reliable source(s)
   - 3 = moderate confidence, limited but credible sources
   - 2 = low confidence, sparse data
   - 1 = very low confidence, mostly inference

REQUIRED SECTIONS:

## 1. Club Overview
Brief history, location, reputation, academy structure, notable alumni if any.

## 2. Recent Results
Last 5-10 match results if available. Win/loss/draw record for current season. Tournament performance.

## 3. Style of Play
Formation, tempo, possession vs direct, pressing behavior, transition style. Base this on observable patterns from results and any available match reports or video summaries.

## 4. Key Players
Name, position, and brief scouting notes on 3-5 standout players if identifiable. Jersey numbers if available.

## 5. Strengths
What this team does well. Be specific — e.g. "strong in aerial duels from set pieces" not just "good defense."

## 6. Weaknesses
Where this team is vulnerable. Again, be specific and actionable.

## 7. Set Pieces
Any known tendencies on corners, free kicks, throw-ins, penalty kicks.

## 8. Tactical Recommendations
3-5 specific, actionable recommendations for how to prepare against this opponent. These should be concrete enough that a youth coach can use them in a training session.

## 9. Source List
List every source you used (URLs preferred). Be transparent about what you found and what you couldn't find.

## 10. Confidence Ratings Summary
A table or list showing each section and its confidence rating (1-5). Include an overall confidence rating.

CRITICAL RULES:
- DO NOT fabricate or hallucinate any data. If you cannot find information for a section, explicitly state "Data not available" and explain what you searched for.
- DO NOT invent player names, scores, or statistics.
- If the club/team is obscure and little data exists, say so clearly and provide whatever partial information you can with appropriate low confidence ratings.
- Cite your sources inline where possible.
- Write for a youth soccer coach audience — be practical and actionable.

FORMAT: Return the report as clean Markdown with clear section headers.`;

function buildPrompt(formData) {
  let prompt = SCOUTING_PROMPT_TEMPLATE;
  prompt = prompt.replace('{{clubName}}', formData.clubName || 'Unknown');
  prompt = prompt.replace('{{level}}', formData.level || 'Unknown');
  prompt = prompt.replace('{{ageGroup}}', formData.ageGroup || 'Unknown');
  prompt = prompt.replace('{{gender}}', formData.gender || 'Unknown');

  if (formData.location) {
    prompt = prompt.replace('{{#if location}}', '').replace('{{/if}}', '');
    prompt = prompt.replace('{{location}}', formData.location);
  } else {
    prompt = prompt.replace(/\{\{#if location\}\}.*?\{\{\/if\}\}/s, '');
  }

  if (formData.matchDate) {
    prompt = prompt.replace('{{#if matchDate}}', '').replace('{{/if}}', '');
    prompt = prompt.replace('{{matchDate}}', formData.matchDate);
  } else {
    prompt = prompt.replace(/\{\{#if matchDate\}\}.*?\{\{\/if\}\}/s, '');
  }

  return prompt;
}

// ── API Functions ────────────────────────────────

// Manus API calls should never hang a request handler. Abort after 60s.
const MANUS_TIMEOUT_MS = 60 * 1000;

async function fetchWithTimeout(url, options = {}, timeoutMs = MANUS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Manus API request timed out after ${timeoutMs / 1000}s`);
      timeoutErr.code = 'MANUS_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function isConfigured() {
  return !!process.env.MANUS_API_KEY;
}

/**
 * Create a scouting task on Manus.
 * Returns { taskId, taskUrl, creditUsage }
 */
export async function createScoutingTask(formData) {
  if (!process.env.MANUS_API_KEY) {
    throw new Error('MANUS_API_KEY not set. Add it to your .env file.');
  }

  const prompt = buildPrompt(formData);
  const title = `Scouting Report: ${formData.clubName} (${formData.ageGroup} ${formData.gender})`;

  logger.info('Creating Manus scouting task', { club: formData.clubName, level: formData.level });

  const res = await fetchWithTimeout(`${MANUS_BASE}/v2/task.create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-manus-api-key': process.env.MANUS_API_KEY,
    },
    body: JSON.stringify({
      message: { content: prompt },
    }),
  });

  const data = await res.json();

  if (!res.ok || data.ok === false) {
    const errMsg = data.error?.message || data.error || `Manus API error: ${res.status}`;
    logger.error('Manus task creation failed', { error: errMsg, status: res.status });
    throw new Error(errMsg);
  }

  logger.info('Manus task created', { taskId: data.task_id, creditUsage: data.credit_usage });

  return {
    taskId: data.task_id,
    taskUrl: data.task_url || null,
    creditUsage: data.credit_usage || 0,
  };
}

/**
 * Get the result of a Manus task.
 * Returns { status, output, creditUsage }
 * status: 'pending' | 'running' | 'completed' | 'failed'
 */
export async function getTaskResult(taskId) {
  if (!process.env.MANUS_API_KEY) {
    throw new Error('MANUS_API_KEY not set.');
  }

  logger.info('Polling Manus task', { taskId });

  // Step 1: Get task status from task.detail (with timeout)
  const statusRes = await fetchWithTimeout(`${MANUS_BASE}/v2/task.detail?task_id=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { 'x-manus-api-key': process.env.MANUS_API_KEY },
  });
  const statusData = await statusRes.json();

  if (!statusRes.ok || statusData.ok === false) {
    const errMsg = statusData.error?.message || statusData.error || `Manus API error: ${statusRes.status}`;
    logger.error('Manus task poll failed', { taskId, error: errMsg });
    throw new Error(errMsg);
  }

  const task = statusData.task || statusData;
  const rawStatus = task.status || 'pending';
  // Map: completed/stopped → completed, failed/error → failed
  const status = (rawStatus === 'completed' || rawStatus === 'stopped') ? 'completed'
    : (rawStatus === 'failed' || rawStatus === 'error') ? 'failed'
    : rawStatus;

  // Step 2: If completed, fetch output from task.listMessages
  let reportContent = null;
  if (status === 'completed') {
    try {
      const msgRes = await fetchWithTimeout(`${MANUS_BASE}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: { 'x-manus-api-key': process.env.MANUS_API_KEY },
      });
      const msgData = await msgRes.json();

      if (msgData.ok && msgData.messages) {
        // Find assistant messages with content (the report)
        const assistantMsgs = msgData.messages
          .filter(m => m.type === 'assistant_message' && m.assistant_message?.content)
          .map(m => m.assistant_message.content);

        // The longest assistant message is typically the final report
        if (assistantMsgs.length > 0) {
          reportContent = assistantMsgs.sort((a, b) => b.length - a.length)[0];
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch Manus messages', { taskId, error: err.message });
    }
  }

  logger.info('Manus task polled', { taskId, status, hasOutput: !!reportContent, contentLength: reportContent?.length });

  return {
    status,
    output: reportContent,
    creditUsage: task.credit_usage || statusData.credit_usage || 0,
  };
}
