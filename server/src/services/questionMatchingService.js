import { Question } from '../models/Question.js';
import { env } from '../config/env.js';

/**
 * Clean text and tokenize into meaningful lowercase words (filtering common stop words).
 * @param {string} text
 * @returns {Set<string>}
 */
function extractKeywords(text) {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'it', 'this', 'that',
    'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'do', 'does',
    'did', 'can', 'could', 'will', 'would', 'have', 'has', 'had', 'please'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(words);
}

/**
 * Simple keyword overlap similarity score between two texts (0 to 1).
 * @param {string} text1
 * @param {string} text2
 * @returns {number}
 */
function calculateKeywordSimilarity(text1, text2) {
  const words1 = extractKeywords(text1);
  const words2 = extractKeywords(text2);

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersectionCount = 0;
  for (const w of words1) {
    if (words2.has(w)) intersectionCount++;
  }

  // Sørensen–Dice coefficient
  return (2 * intersectionCount) / (words1.size + words2.size);
}

/**
 * Detects whether a new buyer question on an auction has already been answered by the seller.
 * Uses Google Gemini 1.5 Flash for semantic comparison, with strict safety guardrails.
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
  if (cleanQuestion.length < 3) return null;

  // 1. Fetch answered questions belonging ONLY to this specific auction (same listingId)
  const answeredQuestions = await Question.find({
    listingId,
    status: 'ANSWERED',
    answerText: { $exists: true, $ne: null },
  })
    .select('_id questionText answerText answeredAt')
    .sort({ answeredAt: -1 })
    .limit(15); // Cost & token optimization: evaluate top relevant candidate entries

  if (answeredQuestions.length === 0) {
    return null;
  }

  const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY;

  // 2. Call Gemini 1.5 Flash for semantic duplicate detection
  if (apiKey) {
    try {
      const candidatesPayload = answeredQuestions.map((q) => ({
        id: q._id.toString(),
        asked: q.questionText,
        sellerAnswer: q.answerText,
      }));

      const prompt = `You are an expert Q&A deduplication and matching system for CampusBid, a university auction platform.
A student is asking a question about an auction listing.

New student question:
"${cleanQuestion.replace(/"/g, '\\"')}"

Here are previous answered questions provided by the seller for this EXACT auction:
${JSON.stringify(candidatesPayload, null, 2)}

TASK:
Determine if any of the seller's previous answers directly, factually, and completely resolve the student's new question.

STRICT SAFETY RULES:
1. ONLY match if the seller's existing answer directly answers the new question with high certainty.
2. If the new question asks for details not covered in the seller's previous response, or if the match is ambiguous or uncertain, you MUST return hasMatch: false.
3. NEVER invent or hallucinate answers. You can only identify if an existing seller answer resolves it.
4. Confidence must be a float between 0.0 and 1.0. Only set confidence >= 0.85 if the match is unambiguous.

Return ONLY a valid JSON object matching this schema:
{
  "hasMatch": boolean,
  "matchedQuestionId": string or null,
  "confidence": number,
  "reasoning": string
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
        // Strip markdown fences if present
        const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        if (
          parsed.hasMatch &&
          parsed.matchedQuestionId &&
          typeof parsed.confidence === 'number' &&
          parsed.confidence >= 0.8
        ) {
          // Safeguard: Verify that the matched ID strictly exists in our database results for this auction
          const matched = answeredQuestions.find(
            (q) => q._id.toString() === parsed.matchedQuestionId.toString()
          );

          if (matched && matched.answerText) {
            return {
              matchedQuestionId: matched._id,
              answerText: matched.answerText, // Verbatim original seller answer
              confidence: parsed.confidence,
              reasoning: parsed.reasoning || 'Semantically matched with an existing seller answer.',
            };
          }
        }
      }
    } catch (err) {
      console.warn('Gemini duplicate question matching fallback:', err.message);
    }
  }

  // 3. Fallback: High-confidence keyword / semantic token similarity
  // Useful for offline tests or when API is unavailable
  for (const q of answeredQuestions) {
    const similarity = calculateKeywordSimilarity(cleanQuestion, q.questionText);
    if (similarity >= 0.75) {
      return {
        matchedQuestionId: q._id,
        answerText: q.answerText, // Verbatim original seller answer
        confidence: Number(similarity.toFixed(2)),
        reasoning: 'High keyword similarity with an existing answered question.',
      };
    }
  }

  return null;
}
