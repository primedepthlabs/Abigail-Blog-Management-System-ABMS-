export async function POST(req) {
  try {
    const { input } = await req.json();

    const openaiRes = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'o4-mini',
          messages: [
            {
              role: 'system',
              content: 'Humanize the blog data like the Stealth GPT.',
            },
            { role: 'user', content: input },
          ],
        }),
      },
    );

    if (!openaiRes.ok) {
      const error = await openaiRes.text();
      return new Response(JSON.stringify({ error }), {
        status: openaiRes.status,
      });
    }

    const data = await openaiRes.json();
    const aiContent =
      data.choices?.[0]?.message?.content || 'No content generated';

    return new Response(JSON.stringify({ summary: aiContent }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
