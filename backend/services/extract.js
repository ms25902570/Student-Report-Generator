// Turns a lesson transcript into the four report sections.
// Uses Gemini when GEMINI_API_KEY is set, otherwise (or if the call fails)
// falls back to a keyword parser that follows the same rules.

const EMPTY = 'Not mentioned in the transcript.';

const SYSTEM_PROMPT = `You convert a tutor's spoken lesson summary into a student progress report.
The transcript comes from speech-to-text, so it may lack punctuation or contain small recognition errors.

Return four fields:
- progress: what was covered in the lesson (usually introduced by "covered").
- strengths: what the student understood or can do (usually introduced by "understood", "can identify").
- areasForImprovement: what the student struggles with or needs to practise (usually introduced by "but").
- nextSteps: homework and the plan for the next lesson (usually introduced by "Homework" or "Next lesson").

Rules:
- Use only information that is in the transcript. Never invent details.
- Write short, clear sentences. If a field has several points, put each on its own line separated by "\\n".
- Do not use bullet characters or markdown.
- If the transcript says nothing for a field, return exactly "${EMPTY}".`;

async function extractWithGemini(transcript, apiKey) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Transcript:\n${transcript}` }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              progress: { type: 'STRING' },
              strengths: { type: 'STRING' },
              areasForImprovement: { type: 'STRING' },
              nextSteps: { type: 'STRING' },
            },
            required: ['progress', 'strengths', 'areasForImprovement', 'nextSteps'],
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Gemini responded with ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
  if (!text) throw new Error('Gemini returned an empty response.');
  const parsed = JSON.parse(text);
  const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : EMPTY);

  return {
    Progress: clean(parsed.progress),
    Strengths: clean(parsed.strengths),
    'Areas for Improvement': clean(parsed.areasForImprovement),
    'Next Steps / Homework': clean(parsed.nextSteps),
  };
}

// Keywords that open each section. Works on unpunctuated speech-to-text output too.
const MARKERS = [
  { section: 'next', pattern: /\b(?:homework|next lesson|next steps?)\b/gi },
  { section: 'areas', pattern: /\bbut\b/gi },
  {
    section: 'strengths',
    pattern:
      /(?:\b(?:he|she|they|the student)\s+)?(?:\b(?:can|could|was able to|is able to)\s+)?\b(?:understood|understands|understand|identify|identifies|identified)\b/gi,
  },
  { section: 'progress', pattern: /\bcovered\b/gi },
];

function tidy(segment) {
  const text = segment
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.-]+/, '')
    .replace(/^(?:but|and)\b[\s,]*/i, '')
    .replace(/[\s,;:-]+$/, '')
    .replace(/\s+and$/i, '')
    .trim();
  if (!text) return '';
  const sentence = text[0].toUpperCase() + text.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function extractWithRules(transcript) {
  const text = transcript.replace(/\s+/g, ' ').trim();

  const marks = [];
  for (const { section, pattern } of MARKERS) {
    for (const match of text.matchAll(pattern)) marks.push({ section, index: match.index });
  }
  marks.sort((a, b) => a.index - b.index);

  const found = { progress: [], strengths: [], areas: [], next: [] };
  let current = 'progress';
  let start = 0;
  const close = (end) => {
    const piece = tidy(text.slice(start, end));
    if (piece) found[current].push(piece);
  };

  for (const mark of marks) {
    if (mark.index < start) continue;
    const sinceStart = text.slice(start, mark.index);
    // "but doesn't understand X" is still an area for improvement, not a strength.
    if (mark.section === 'strengths' && current === 'areas' && !/[.!?]/.test(sinceStart)) continue;
    // Keep "Today we covered ..." together as one progress sentence.
    if (mark.section === 'progress' && current === 'progress' && !/[.!?]/.test(sinceStart)) continue;
    close(mark.index);
    current = mark.section;
    start = mark.index;
  }
  close(text.length);

  const join = (items) => (items.length ? items.join('\n') : EMPTY);
  return {
    Progress: join(found.progress),
    Strengths: join(found.strengths),
    'Areas for Improvement': join(found.areas),
    'Next Steps / Homework': join(found.next),
  };
}

export async function extractReport(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      return { sections: await extractWithGemini(transcript, apiKey), source: 'gemini' };
    } catch (err) {
      console.error('Gemini extraction failed, using keyword parser instead:', err.message);
      return { sections: extractWithRules(transcript), source: 'rules-fallback' };
    }
  }
  return { sections: extractWithRules(transcript), source: 'rules' };
}
