import supabase from '@/lib/supabaseClient';

export async function POST(req) {
  try {
    const { input, id } = await req.json();

    const inputText = typeof input === 'string' ? input : JSON.stringify(input);

    if (!inputText || !id) {
      return new Response(
        JSON.stringify({ error: 'Invalid input or id provided' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const response = await fetch('https://stealthgpt.ai/api/stealthify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': process.env.STEALTHGPT_API_KEY,
      },
      body: JSON.stringify({
        prompt: inputText,
        rephrase: true,
        tone: 'Standard',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('StealthGPT API error:', errorText);
      return new Response(JSON.stringify({ error: 'StealthGPT failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stealthData = await response.json();
    if (!stealthData.result) {
      console.error(
        'StealthGPT API returned unexpected response format:',
        stealthData,
      );
      return new Response(
        JSON.stringify({ error: 'Invalid response from StealthGPT' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const humanizedContent = stealthData.result;

    const { data: saveData, error: supabaseError } = await supabase
      .from('Humanize_Data')
      .insert([
        {
          Webhook_Id: id,
          humanize_Data: humanizedContent,
        },
      ]);

    if (supabaseError) {
      console.error('Supabase insert error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to store humanized data' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ summary: humanizedContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Server Error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
//
//
//
export async function GET(req) {
  try {
    // You can remove the check for the 'id' query parameter if you no longer want to use it
    const { data, error } = await supabase
      .from('Humanize_Data')
      .select('*'); // This fetches all records without filtering by ID

    if (error) {
      console.error('Supabase fetch error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'No data found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Server Error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
