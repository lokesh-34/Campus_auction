import { Question } from '../models/Question.js';
import { env } from '../config/env.js';

const TOPIC_SYNONYMS = {
  SIZE: [
    'size', 'sizes', 'dimension', 'dimensions', 'measurement', 'measurements', 'height',
    'width', 'length', 'depth', 'thickness', 'scale', 'cm', 'inch', 'inches', 'sqft',
    'meter', 'big', 'small', 'tall', 'wide', 'heavy', 'weight', 'kg', 'grams', 'mm'
  ],
  CONDITION: [
    'condition', 'working', 'works', 'flaw', 'flaws', 'scratch', 'scratches', 'dent',
    'dents', 'damage', 'damaged', 'defect', 'defects', 'tear', 'wear', 'functional',
    'broken', 'fine', 'ok'
  ],
  BATTERY: [
    'battery', 'charge', 'charger', 'charging', 'adapter', 'backup', 'health',
    'mah', 'cable', 'cord', 'wire', 'plug'
  ],
  AGE: [
    'age', 'old', 'used', 'usage', 'bought', 'purchase', 'purchased', 'year',
    'years', 'month', 'months', 'since', 'dated', 'lifetime'
  ],
  WARRANTY: [
    'warranty', 'guarantee', 'bill', 'invoice', 'receipt', 'box', 'packaging', 'package'
  ],
  PRICE: [
    'price', 'negotiable', 'negotiate', 'discount', 'cheap', 'cheaper', 'final',
    'lowest', 'least', 'bargain', 'reduce', 'reduction'
  ],
  COLOR: [
    'color', 'colour', 'shade', 'paint', 'black', 'white', 'blue', 'red', 'green', 'silver', 'grey', 'gray'
  ],
  AUTHENTIC: [
    'original', 'genuine', 'fake', 'copy', 'real', 'authentic', 'brand'
  ],
  ACCESSORIES: [
    'accessories', 'accessory', 'included', 'includes', 'attachment', 'attachments', 'extra', 'extras', 'freebies', 'case', 'cover'
  ],
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'will', 'would',
  'shall', 'should', 'may', 'might', 'must', 'it', 'its', 'this', 'that', 'these',
  'those', 'in', 'on', 'at', 'to', 'for', 'of', 'from', 'by', 'with', 'about',
  'and', 'or', 'but', 'if', 'what', 'whats', 'which', 'where', 'when', 'who',
  'whom', 'whose', 'why', 'how', 'please', 'pls', 'plz', 'tell', 'me', 'know',
  'want', 'give', 'any', 'there', 'here', 'some', 'much', 'many', 'item', 'product',
  'like', 'just', 'also'
]);

function stem(word) {
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  return word;
}

function tokenizeAndTag(text) {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const rawWords = clean.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const topics = new Set();
  const words = new Set();

  for (const raw of rawWords) {
    const s = stem(raw);
    let matchedTopic = null;
    for (const [topic, list] of Object.entries(TOPIC_SYNONYMS)) {
      if (list.includes(raw) || list.includes(s)) {
        topics.add(topic);
        matchedTopic = topic;
        break;
      }
    }
    if (!matchedTopic) {
      words.add(s);
    }
  }

  return { topics, words, rawWords, cleanText: clean.trim() };
}

/**
 * Calculates deterministic semantic matching score between a new question and an answered candidate.
 * @param {string} newQ
 * @param {string} candidateQ
 * @returns {{ match: boolean, confidence: number, reasoning: string }}
 */
export function calculateSemanticQuestionMatch(newQ, candidateQ) {
  const t1 = tokenizeAndTag(newQ);
  const t2 = tokenizeAndTag(candidateQ);

  if (t1.rawWords.length === 0 || t2.rawWords.length === 0) {
    return { match: false, confidence: 0, reasoning: 'Empty question tokens' };
  }

  // 1. Exact normalized phrase match
  if (t1.cleanText === t2.cleanText) {
    return { match: true, confidence: 1.0, reasoning: 'Exact verbatim question match' };
  }

  // 2. Topic Overlap Analysis
  let topicOverlapCount = 0;
  for (const top of t1.topics) {
    if (t2.topics.has(top)) topicOverlapCount++;
  }

  // If both questions have explicit topics and they conflict (e.g. COLOR vs SIZE)
  if (t1.topics.size > 0 && t2.topics.size > 0 && topicOverlapCount === 0) {
    return { match: false, confidence: 0, reasoning: 'Conflicting question topics' };
  }

  // If both share the primary topic intent (e.g. SIZE)
  if (topicOverlapCount > 0) {
    // If either question is concise (<= 3 content words, e.g. "size ?", "frame size", "whats the size")
    if (t1.rawWords.length <= 3 || t2.rawWords.length <= 3) {
      let wordOverlap = 0;
      for (const w of t1.words) {
        if (t2.words.has(w)) wordOverlap++;
      }
      return {
        match: true,
        confidence: wordOverlap > 0 ? 0.96 : 0.90,
        reasoning: 'Shared topic intent matching seller response',
      };
    }
  }

  // 3. Keyword Containment & Overlap
  let totalOverlap = topicOverlapCount;
  for (const w of t1.words) {
    if (t2.words.has(w)) totalOverlap++;
  }

  const minTokens = Math.min(t1.rawWords.length, t2.rawWords.length);
  const containment = minTokens > 0 ? totalOverlap / minTokens : 0;
  const dice = (2 * totalOverlap) / (t1.rawWords.length + t2.rawWords.length);

  // If most key terms of the shorter question are contained in the candidate question
  if (containment >= 0.75 && totalOverlap > 0) {
    return {
      match: true,
      confidence: Number(Math.max(containment * 0.9, dice).toFixed(2)),
      reasoning: 'High keyword and intent containment',
    };
  }

  return { match: false, confidence: 0, reasoning: 'Insufficient overlap' };
}

/**
 * Detects whether a new buyer question on an auction has already been answered by the seller.
 * Uses high-precision deterministic intent matching first, with AI generation when available.
 *
 * @param {string|ObjectId} listingId
 * @param {string} newQuestionText
 * @returns {Promise<{ matchedQuestionId: string, answerText: string, confidence: number, reasoning: string } | null>}
 */
export async function findDuplicateOrAnsweredMatch(listingId, newQuestionText) {
  if (!listingId || !newQuestionText || typeof newQuestionText !== 'string') {
    return null;
  }

  const cleanQuestion = newQuestionText.trim();
  if (cleanQuestion.length < 2) return null;

  // 1. Fetch answered questions belonging ONLY to this specific auction (same listingId)
  const answeredQuestions = await Question.find({
    listingId,
    status: 'ANSWERED',
    answerText: { $exists: true, $ne: null },
  })
    .select('_id questionText answerText answeredAt')
    .sort({ answeredAt: -1 })
    .limit(20);

  if (answeredQuestions.length === 0) {
    return null;
  }

  // 2. High-precision local intent & semantic matching
  for (const q of answeredQuestions) {
    const score = calculateSemanticQuestionMatch(cleanQuestion, q.questionText);
    if (score.match && score.confidence >= 0.8) {
      return {
        matchedQuestionId: q._id,
        answerText: q.answerText, // Verbatim original seller answer
        confidence: score.confidence,
        reasoning: score.reasoning,
      };
    }
  }

  // 3. Fallback to Gemini / Groq LLM if API key configured and reachable
  const geminiKey = env.GEMINI_API_KEY || env.AI_API_KEY;
  const groqKey = env.GROQ_API_KEY;

  if (groqKey) {
    try {
      const candidatesPayload = answeredQuestions.map((q) => ({
        id: q._id.toString(),
        asked: q.questionText,
        sellerAnswer: q.answerText,
      }));

      const prompt = `Student asked: "${cleanQuestion.replace(/"/g, '\\"')}".
Does any of these seller answers directly resolve it?
${JSON.stringify(candidatesPayload, null, 2)}
Respond with JSON only: {"hasMatch": boolean, "matchedQuestionId": string|null, "confidence": number, "reasoning": string}`;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 200,
          temperature: 0.1,
        }),
      });

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.hasMatch && parsed.matchedQuestionId && parsed.confidence >= 0.8) {
          const matched = answeredQuestions.find(
            (q) => q._id.toString() === parsed.matchedQuestionId.toString()
          );
          if (matched && matched.answerText) {
            return {
              matchedQuestionId: matched._id,
              answerText: matched.answerText,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning || 'AI semantically verified seller match',
            };
          }
        }
      }
    } catch {
      // Ignore network / offline error
    }
  } else if (geminiKey) {
    try {
      const candidatesPayload = answeredQuestions.map((q) => ({
        id: q._id.toString(),
        asked: q.questionText,
        sellerAnswer: q.answerText,
      }));

      const prompt = `Student question: "${cleanQuestion.replace(/"/g, '\\"')}".
Previous answered seller questions:
${JSON.stringify(candidatesPayload, null, 2)}
Determine if any existing seller answer directly resolves the question. Return JSON only: {"hasMatch": boolean, "matchedQuestionId": string|null, "confidence": number, "reasoning": string}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 250,
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);
        if (parsed.hasMatch && parsed.matchedQuestionId && parsed.confidence >= 0.8) {
          const matched = answeredQuestions.find(
            (q) => q._id.toString() === parsed.matchedQuestionId.toString()
          );
          if (matched && matched.answerText) {
            return {
              matchedQuestionId: matched._id,
              answerText: matched.answerText,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning || 'Gemini verified seller match',
            };
          }
        }
      }
    } catch {
      // Ignore network / offline error
    }
  }

  return null;
}
