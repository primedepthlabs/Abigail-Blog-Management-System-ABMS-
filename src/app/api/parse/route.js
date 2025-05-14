import { Readability } from '@mozilla/readability';
import { htmlToText } from 'html-to-text';
import { JSDOM } from 'jsdom';
import { parse } from 'json2csv';
import puppeteer from 'puppeteer';

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
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(blogUrl, { waitUntil: 'networkidle2' });
    //
    const html = await page.content();
    await browser.close();

    const dom = new JSDOM(html, { url: blogUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.content) {
      throw new Error('No content fetched from the URL');
    }

    const tempDom = new JSDOM(article.content, { url: blogUrl });
    const imgElements = tempDom.window.document.querySelectorAll('img');

    for (let i = 0; i < imgElements.length; i++) {
      const img = imgElements[i];

      img.style.display = 'block';
      img.style.maxWidth = '100%';

      if (img.getAttribute('src')) {
        try {
          const imgSrc = img.getAttribute('src');
          const absoluteUrl = new URL(imgSrc, blogUrl).href;
          img.setAttribute('src', absoluteUrl);
        } catch (e) {
          console.error('Error processing image URL:', e);
        }
      }

      if (img.getAttribute('data-src') && !img.getAttribute('src')) {
        try {
          const dataSrc = img.getAttribute('data-src');
          const absoluteUrl = new URL(dataSrc, blogUrl).href;
          img.setAttribute('src', absoluteUrl);
        } catch (e) {
          console.error('Error processing data-src URL:', e);
        }
      }
    }

    const processedContent = tempDom.window.document.body.innerHTML;

    const imageUrls = Array.from(imgElements)
      .map((img) => img.getAttribute('src'))
      .filter(Boolean)
      .map((src) => {
        try {
          return new URL(src, blogUrl).href;
        } catch (e) {
          return src;
        }
      });

    const cleanContent = htmlToText(processedContent, {
      wordwrap: 130,
      selectors: [{ selector: 'a', options: { ignoreHref: true } }],
    });

    const formattedData = {
      title: article.title || 'No Title Available',
      content: cleanContent || 'No Content Found',
      author: article.byline || 'Author not Available',
      date: new Date().toISOString(),
      excerpt: article.excerpt || 'No excerpt Available',
      url: blogUrl,
      images: imageUrls,
    };

    const csv = parse([formattedData]);

    return new Response(
      JSON.stringify({
        csvData: csv,
        htmlContent: processedContent,
        title: article.title || 'No Title Available',
        author: article.byline || 'Author not Available',
        excerpt: article.excerpt || 'No excerpt Available',
        url: blogUrl,
        imageCount: imageUrls.length,
        images: imageUrls,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: 'Error parsing the URL', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
