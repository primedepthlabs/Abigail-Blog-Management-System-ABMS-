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

      console.log(
        `📰 Processing ${items.length} items with OpenAI extraction...`,
      );

      // Use OpenAI to extract and enhance data from each raw item
      const processedDataPromises = items.map(async (item, index) => {
        try {
          // Add delay between requests
          await new Promise((resolve) => setTimeout(resolve, index * 200));

          // Send the complete raw item to OpenAI
          const rawItemJSON = JSON.stringify(item);

          const prompt = `
Extract and enhance the following from this RSS feed item:
1. A clean, concise title
2. A well-written, engaging description (2-3 sentences)
3. The best image URL available

Raw RSS item data:
${rawItemJSON}

Respond ONLY in this exact JSON format:
{
  "title": "extracted title here",
  "description": "well-written description here",
  "image": "image URL here"
}`;

          const aiRes = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
          });

          const aiResponse = aiRes.choices[0]?.message?.content || '';
          console.log(
            `OpenAI extraction for item ${index + 1}: ${aiResponse.substring(
              0,
              100,
            )}...`,
          );

          try {
            // Parse the JSON response
            const extracted = JSON.parse(aiResponse);

            return {
              title: extracted.title || item.title || 'No Title',
              description:
                extracted.description ||
                item.description_text ||
                'No Description',
              image: extracted.image || item.thumbnail || 'No Image',
              link: item.url || 'No Link',
              source: sourceName,
              feed_url: cleanFeed.rss_feed_url || '',
            };
          } catch (parseError) {
            console.error(
              `Error parsing OpenAI response: ${parseError.message}`,
            );

            // Fallback to direct extraction
            return {
              title: item.title || 'No Title',
              description: item.description_text || 'No Description',
              image: item.thumbnail || 'No Image',
              link: item.url || 'No Link',
              source: sourceName,
              feed_url: cleanFeed.rss_feed_url || '',
            };
          }
        } catch (error) {
          console.error(
            `Error with OpenAI extraction for item ${index + 1}:`,
            error,
          );

          // Fallback to direct extraction
          return {
            title: item.title || 'No Title',
            description: item.description_text || 'No Description',
            image: item.thumbnail || 'No Image',
            link: item.url || 'No Link',
            source: sourceName,
            feed_url: cleanFeed.rss_feed_url || '',
          };
        }
      });

      // Wait for all items to be processed by OpenAI
      const enhancedData = await Promise.all(processedDataPromises);
      console.log(
        '📊 OpenAI Enhanced Data:',
        enhancedData.map((d) => ({
          title: d.title.substring(0, 30) + '...',
          description: d.description.substring(0, 30) + '...',
        })),
      );

      // Step 4: Humanize via StealthGPT with correct format
      // Step 4: Humanize via StealthGPT with OpenAI fallback
      const humanizedData = await Promise.all(
        enhancedData.map(async (data, index) => {
          try {
            // First try with StealthGPT
            console.log(`🔄 Trying StealthGPT for item ${index + 1}`);

            const requestBody = {
              prompt: data.description,
              rephrase: true,
            };

            const res = await fetch('https://stealthgpt.ai/api/stealthify', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.STEALTHGPT_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            // If StealthGPT succeeds, use its result
            if (res.ok) {
              const result = await res.json();
              const humanizedText =
                result.text || result.output || result.rephrased_text;

              if (humanizedText) {
                console.log(`✅ StealthGPT succeeded for item ${index + 1}`);
                return {
                  ...data,
                  description: humanizedText,
                };
              }
            }

            // If StealthGPT fails, use OpenAI as fallback
            console.log(
              `⚠️ StealthGPT failed, falling back to OpenAI for item ${
                index + 1
              }`,
            );

            const prompt = `Rewrite the following description in a more conversational, human tone while preserving all the information:

"${data.description}"

Only return the rewritten text, nothing else.`;

            const aiRes = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo', // Using 3.5 to save costs
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 250,
              temperature: 0.7,
            });

            const humanizedDescription =
              aiRes.choices[0]?.message?.content || data.description;
            console.log(`✅ OpenAI fallback succeeded for item ${index + 1}`);

            return {
              ...data,
              description: humanizedDescription,
            };
          } catch (err) {
            console.error(
              `❌ Humanization error for item ${index + 1}:`,
              err.message,
            );
            return data; // Return original data as last resort
          }
        }),
      );
      console.log('🧠 Humanized Data Summary:', humanizedData.length);

      const insertPayload = humanizedData.map((item) => {
        const markdown = `**Summary:** ${item.description}\n\n**Image:**\n![${item.title}](${item.image})`;
        return {
          humanize_Data: markdown,
          // Uncomment if you want to store these fields separately
          // title: item.title,
          // description: item.description,
          // image: item.image,
          // link: item.link,
          // source: item.source,
          // feed_url: item.feed_url,
        };
      });

      console.log('💾 Prepared Insert Payload:', insertPayload.length);

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

// GET API
export async function GET() {
  const { data, error } = await supabase
    .from('Humanize_Data')
    .select('humanize_Data')
    .order('id', { ascending: true });
  if (error) {
    console.error('supabase error', error);
    return new Response(JSON.stringify({ error: 'failed to fetch data' }), {
      status: 500,
    });
  }
  return new Response(JSON.stringify({ entries: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
