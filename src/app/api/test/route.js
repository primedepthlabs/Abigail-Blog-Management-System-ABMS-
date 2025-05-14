import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

import supabase from '@/lib/supabaseClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const response = await request.json();
    const payload = Array.isArray(response) ? response : [response];

    console.log(
      '✅ Webhook Payload received:',
      JSON.stringify(payload, null, 2),
    );

    if (!Array.isArray(payload)) {
      console.error('❌ Invalid payload: Expected array.');
      return new Response('Invalid payload structure', { status: 400 });
    }

    for (const event of payload) {
      if (event.type !== 'feed_update' || !event.feed) {
        console.log('⚠️ Skipping non-feed_update event:', event.type);
        continue;
      }

      // Extract feed data without `id`
      const { id, ...cleanFeed } = event.feed;
      console.log('🧼 Cleaned Feed (without id):', cleanFeed);

      // Extract source name from feed title if possible
      const sourceName =
        cleanFeed.title?.split('|')?.[1]?.trim() || 'News Source';

      // Optional: Save cleaned feed in Supabase
      const { data: feedInsert, error: feedError } = await supabase
        .from('Webhook_Raw_Data')
        .insert([{ webhook_raw_data: event }]);

      if (feedError) {
        console.error('❌ Supabase Feed Insert Error:', feedError);
      } else {
        console.log('✅ Feed inserted:', feedInsert);
      }

      const items = event.data?.items_new || [];

      if (!items.length) {
        console.log('ℹ️ No new items found.');
        continue;
      }

      console.log(`📰 Processing ${items.length} items...`);

      // Extract data from items directly instead of using GPT to parse
      const extractedData = items.map((item) => {
        return {
          title: item.title || 'No Title',
          description: item.description_text || 'No Description',
          image: item.thumbnail || 'No Image',
          link: item.url || 'No Link',
          source: sourceName,
          feed_url: cleanFeed.rss_feed_url || '',
        };
      });

      console.log('📤 Extracted Items:', extractedData);

      // Use GPT to enhance descriptions if they're too short
      const enhancedDataPromises = extractedData.map(async (data) => {
        if (data.description && data.description.length < 100) {
          try {
            const prompt = `Based on this title: "${data.title}", please generate a more detailed summary in 2-3 sentences. Make it informative and engaging:`;

            const aiRes = await openai.chat.completions.create({
              model: 'gpt-4',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 200,
              temperature: 0.7,
            });

            const enhancedDescription =
              aiRes.choices[0]?.message?.content || data.description;
            return {
              ...data,
              description: enhancedDescription,
            };
          } catch (error) {
            console.error('Error enhancing description with OpenAI:', error);
            return data;
          }
        }
        return data;
      });

      const enhancedData = await Promise.all(enhancedDataPromises);

      // Step 4: Humanize via StealthGPT
      const humanizedData = await Promise.all(
        enhancedData.map(async (data) => {
          try {
            const res = await fetch('https://stealthgpt.ai/api/stealthify', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.STEALTHGPT_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ input: data }),
            });

            const result = await res.json();

            return {
              title: result.humanized_title || data.title,
              description: result.humanized_description || data.description,
              image: data.image,
              link: data.link,
              source: data.source,
              feed_url: data.feed_url,
            };
          } catch (err) {
            console.error('❌ StealthGPT error:', err);
            return data;
          }
        }),
      );

      console.log('🧠 Humanized Data:', humanizedData);

      const insertPayload = humanizedData.map((item) => {
        const markdown = `**Summary:** ${item.description}\n\n**Image:**\n![${item.title}](${item.image})`;
        return {
          humanize_Data: markdown,
          // title: item.title,
          // description: item.description,
          // image: item.image,
          // link: item.link,
          // source: item.source,
          // feed_url: item.feed_url,
          // Store only description + image in markdown format
        };
      });

      console.log('💾 Prepared Insert Payload:', insertPayload);
      //
      // supabase data insertion
      const { data, error } = await supabase
        .from('Humanize_Data')
        .insert(insertPayload);

      if (error) {
        console.error('❌ Supabase insert error:', error);
        return new Response('Failed to save webhook data', { status: 500 });
      }

      console.log(`✅ Successfully inserted ${humanizedData.length} records`);
    }

    return NextResponse.json({
      success: true,
      message: 'Data saved successfully',
    });
  } catch (err) {
    console.error('🔥 Webhook Handler Fatal Error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
//
//
// GET API
export async function GET() {
  const { data, error } = await supabase
    .from('Humanize_Data')
    .select('humanize_Data')
    .order('id', { ascending: true });
  if (error) {
    console.error('supabase error', error);
    return new Response(JSON.stringify({ error: 'failed to feetch data' }), {
      status: 500,
    });
  }
  return new Response(JSON.stringify({ entries: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
