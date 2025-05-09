import Parser from '@postlight/parser';
import { parse } from 'json2csv';
import { htmlToText } from 'html-to-text';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const blogUrl = searchParams.get('url');

  if (!blogUrl) {
    return new Response(JSON.stringify({ error: 'Url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await Parser.parse(blogUrl);
    const images = result.content.match(/<img[^>]+src="([^">]+)"/g) || [];
    const imageUrls = images
      .map((imgTag) => {
        const match = imgTag.match(/src="([^">]+)"/);
        return match ? match[1] : null;
      })
      .filter((url) => url !== null);

    const sanitizedContent = htmlToText(result.content);

    const formattedData = {
      title: result.title || 'No Title Available',
      content: sanitizedContent || 'No Content Found',
      author: result.author || 'Author not Available',
      date: result.date || 'Date not Available',
      excerpt: result.excerpt || 'No excerpt Available',
      url: blogUrl,
      images: imageUrls.join('; '),
    };

    const csv = parse([formattedData]);

    return new Response(JSON.stringify({ csvData: csv }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error parsing the URL:', err);

    return new Response(
      JSON.stringify({ error: 'Error parsing the URL', details: err.message }),

      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
