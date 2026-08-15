export interface Env {
  AI?: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
}

const FALLBACK_TAXONOMY_TAGS = [
  'Lou Gehrig',
  'Yankees',
  'Baseball History',
  'Fan Club Archive',
  'Historical Record'
];

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;
    const body = await request.json().catch(() => ({})) as { contentText?: string; title?: string };
    const text = body.contentText || body.title || '';

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'Text input required for AI tagging' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (context.env.AI) {
      try {
        const aiResult = await context.env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: 'Extract 3-5 keywords/tags from the text as a JSON array of strings.' },
            { role: 'user', content: text },
          ],
        });
        return new Response(JSON.stringify({ tags: aiResult, source: 'workers-ai' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (aiErr) {
        console.warn('Workers AI offline or quota exceeded, using taxonomy fallback:', aiErr);
      }
    }

    return new Response(
      JSON.stringify({
        tags: FALLBACK_TAXONOMY_TAGS,
        source: 'taxonomy-fallback',
        note: 'Workers AI unavailable or quota exceeded; fallback tags applied.',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
