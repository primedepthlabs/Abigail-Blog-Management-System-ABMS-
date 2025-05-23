import { OpenAI } from 'openai';
import supabase from '@/lib/supabaseClient';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import cheerio from 'cheerio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function for OpenAI API with retry logic
async function callOpenAIWithRetry(messages, maxTokens = 10000, temperature = 0.7, maxRetries = 3) {
  let retries = 0;
  let lastError = null;

  while (retries < maxRetries) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
      });
      return response;
    } catch (error) {
      lastError = error;
      console.log(`⚠️ OpenAI API error (attempt ${retries + 1}/${maxRetries}): ${error.message}`);

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, waitTime));
      retries++;
    }
  }

  // If we got here, all retries failed
  throw new Error(`OpenAI API failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

// Custom function to extract text from HTML
function customExtractTextFromHTML(html) {
  if (!html) return '';

  try {
    const $ = cheerio.load(html);

    // Remove scripts and styles
    $('script, style').remove();

    // Get the text content
    let text = $('body').text();

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  } catch (error) {
    console.error('Error extracting text from HTML:', error.message);
    return '';
  }
}

// Custom function to extract images from HTML
function customExtractImagesFromHTML(html, baseUrl = '') {
  if (!html) return [];

  try {
    const $ = cheerio.load(html);
    const images = [];

    $('img').each((_, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt') || '';
      const title = $(img).attr('title') || '';
      const width = parseInt($(img).attr('width') || '0', 10);
      const height = parseInt($(img).attr('height') || '0', 10);

      if (src) {
        // Convert relative URLs to absolute if baseUrl is provided
        let imgUrl = src;
        if (baseUrl && (src.startsWith('/') || !src.startsWith('http'))) {
          const urlObj = new URL(baseUrl);
          if (src.startsWith('/')) {
            imgUrl = `${urlObj.origin}${src}`;
          } else {
            imgUrl = `${urlObj.origin}/${src}`;
          }
        }

        images.push({
          url: imgUrl,
          alt,
          width,
          height,
          area: width * height,
          position: 'content',
          priority: 2,
          caption: title
        });
      }

      // Also check for srcset
      const srcset = $(img).attr('srcset');
      if (srcset) {
        const srcsetParts = srcset.split(',');
        for (const part of srcsetParts) {
          const [url, _] = part.trim().split(' ');
          if (url && !images.some(img => img.url === url)) {
            // Convert relative URLs to absolute if baseUrl is provided
            let imgUrl = url;
            if (baseUrl && (url.startsWith('/') || !url.startsWith('http'))) {
              const urlObj = new URL(baseUrl);
              if (url.startsWith('/')) {
                imgUrl = `${urlObj.origin}${url}`;
              } else {
                imgUrl = `${urlObj.origin}/${url}`;
              }
            }

            images.push({
              url: imgUrl,
              alt,
              width,
              height,
              area: width * height,
              position: 'srcset',
              priority: 1,
              caption: title
            });
          }
        }
      }
    });

    return images;
  } catch (error) {
    console.error('Error extracting images from HTML:', error.message);
    return [];
  }
}

// Parse RSS feed and return items
async function parseFeed(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch feed: ${res.status}`);
    }

    const xml = await res.text();
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const doc = dom.window.document;

    // Detect feed type (RSS, Atom, RDF)
    let feedType = 'unknown';
    if (doc.querySelector('rss')) {
      feedType = 'rss';
    } else if (doc.querySelector('feed')) {
      feedType = 'atom';
    } else if (doc.querySelector('rdf\\:RDF, RDF')) {
      feedType = 'rdf';
    }

    // Get feed metadata and items
    const feedData = {
      title: '',
      description: '',
      link: '',
      lastBuildDate: '',
      language: '',
      items: []
    };

    // Parse feed metadata based on feed type
    if (feedType === 'rss') {
      const channel = doc.querySelector('channel');
      if (channel) {
        feedData.title = channel.querySelector('title')?.textContent || '';
        feedData.description = channel.querySelector('description')?.textContent || '';
        feedData.link = channel.querySelector('link')?.textContent || '';
        feedData.lastBuildDate = channel.querySelector('lastBuildDate')?.textContent || '';
        feedData.language = channel.querySelector('language')?.textContent || '';
      }

      // Parse items
      feedData.items = Array.from(doc.querySelectorAll('item')).map((item) => {
        const children = Array.from(item.children);
        const itemData = {};

        // Extract standard RSS fields
        itemData.title = item.querySelector('title')?.textContent || '';
        itemData.link = item.querySelector('link')?.textContent || '';
        itemData.pubDate = item.querySelector('pubDate')?.textContent || '';
        itemData.description = item.querySelector('description')?.textContent || '';
        itemData.guid = item.querySelector('guid')?.textContent || '';
        itemData.categories = Array.from(item.querySelectorAll('category')).map(cat => cat.textContent);

        // Handle content with namespace
        const contentEncoded = item.querySelector('content\\:encoded') ||
          item.getElementsByTagNameNS('*', 'encoded')[0];

        if (contentEncoded) {
          itemData.content = contentEncoded.textContent || '';
        }

        // Handle media
        const mediaThumbnail = item.querySelector('media\\:thumbnail') ||
          item.getElementsByTagNameNS('*', 'thumbnail')[0];

        const mediaContent = item.querySelector('media\\:content') ||
          item.getElementsByTagNameNS('*', 'content')[0];

        if (mediaThumbnail || mediaContent) {
          itemData.media = {};

          if (mediaThumbnail) {
            itemData.media.thumbnail = mediaThumbnail.getAttribute('url');
          }

          if (mediaContent) {
            itemData.media.content = mediaContent.getAttribute('url');
          }
        }

        // Get all remaining elements as custom fields
        children.forEach(child => {
          const nodeName = child.nodeName.toLowerCase();
          if (!['title', 'link', 'pubdate', 'description', 'guid', 'category', 'content:encoded'].includes(nodeName)) {
            if (nodeName.includes(':')) {
              const [namespace, name] = nodeName.split(':');
              if (!itemData[namespace]) itemData[namespace] = {};
              itemData[namespace][name] = child.textContent;
            } else if (!itemData[nodeName]) {
              itemData[nodeName] = child.textContent;
            }
          }
        });

        return itemData;
      });
    } else if (feedType === 'atom') {
      // Atom feed handling
      feedData.title = doc.querySelector('feed > title')?.textContent || '';
      feedData.description = doc.querySelector('feed > subtitle')?.textContent || '';
      feedData.link = doc.querySelector('feed > link[rel="alternate"]')?.getAttribute('href') ||
        doc.querySelector('feed > link')?.getAttribute('href') || '';
      feedData.lastBuildDate = doc.querySelector('feed > updated')?.textContent || '';

      // Parse entries
      feedData.items = Array.from(doc.querySelectorAll('entry')).map((entry) => {
        const itemData = {};

        itemData.title = entry.querySelector('title')?.textContent || '';
        itemData.link = entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
          entry.querySelector('link')?.getAttribute('href') || '';
        itemData.pubDate = entry.querySelector('published')?.textContent ||
          entry.querySelector('updated')?.textContent || '';
        itemData.description = entry.querySelector('summary')?.textContent || '';
        itemData.content = entry.querySelector('content')?.textContent || '';
        itemData.id = entry.querySelector('id')?.textContent || '';

        return itemData;
      });
    } else if (feedType === 'rdf') {
      // RDF feed handling
      feedData.title = doc.querySelector('channel > title')?.textContent || '';
      feedData.description = doc.querySelector('channel > description')?.textContent || '';
      feedData.link = doc.querySelector('channel > link')?.textContent || '';

      // Parse items
      feedData.items = Array.from(doc.querySelectorAll('item')).map((item) => {
        const itemData = {};

        itemData.title = item.querySelector('title')?.textContent || '';
        itemData.link = item.querySelector('link')?.textContent || '';
        itemData.description = item.querySelector('description')?.textContent || '';

        // Handle Dublin Core metadata if present
        const dcCreator = item.querySelector('dc\\:creator') ||
          item.getElementsByTagNameNS('*', 'creator')[0];
        if (dcCreator) {
          itemData.creator = dcCreator.textContent;
        }

        const dcDate = item.querySelector('dc\\:date') ||
          item.getElementsByTagNameNS('*', 'date')[0];
        if (dcDate) {
          itemData.pubDate = dcDate.textContent;
        }

        return itemData;
      });
    }

    return feedData;
  } catch (error) {
    console.error(`Error parsing feed ${url}:`, error);
    throw error;
  }
}

// Process individual blog item
async function processItem(item, feedId, existingUrls) {
  try {
    // Skip if item has no link or if URL already exists
    if (!item.link || existingUrls.has(item.link)) {
      return { status: 'skipped', reason: 'URL already exists or no link' };
    }

    console.log(`📝 Processing: ${item.title?.substring(0, 30)}...`);

    // 1. Insert the blog URL into rss_feed_data
    const { data: rssItemData, error: rssItemError } = await supabase
      .from('rss_feed_data')
      .insert({
        feed_id: feedId,
        blog_url: item.link
      })
      .select('id');

    if (rssItemError) {
      console.error(`❌ Error inserting into rss_feed_data:`, rssItemError);
      return { status: 'error', error: rssItemError };
    }

    const rssItemId = rssItemData[0].id;

    // 2. Fetch full HTML content from the blog URL
    console.log(`🌐 Fetching full HTML from: ${item.link}`);
    let fullHtmlContent = '';
    let fullTextContent = '';
    let fullMarkdownContent = '';
    let pageTitle = '';
    let pageMetaDescription = '';
    let pageImages = [];
    let articleDate = item.pubDate || '';
    let articleHTML = '';
    let articleAuthor = '';

    try {
      const response = await axios.get(item.link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 15000
      });

      fullHtmlContent = response.data;

      // Parse the HTML with cheerio
      const $ = cheerio.load(fullHtmlContent);

      // Extract page title
      pageTitle = $('title').text().trim() || item.title || '';

      // Extract meta description
      pageMetaDescription = $('meta[name="description"]').attr('content') || '';

      // Try to extract author information
      const authorSelectors = [
        'meta[name="author"]',
        'meta[property="article:author"]',
        '.author',
        '.byline',
        '[rel="author"]',
        '[itemprop="author"]'
      ];

      for (const selector of authorSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          if (selector.startsWith('meta')) {
            articleAuthor = element.attr('content') || '';
            break;
          } else {
            articleAuthor = element.text().trim() || '';
            break;
          }
        }
      }

      // Try to extract publication date from the page
      if (!articleDate) {
        const dateSelectors = [
          'meta[property="article:published_time"]',
          'time',
          '.publish-date',
          '.post-date',
          '.entry-date',
          '[itemprop="datePublished"]'
        ];

        for (const selector of dateSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            if (selector.startsWith('meta')) {
              articleDate = element.attr('content');
              break;
            } else if (selector === 'time') {
              articleDate = element.attr('datetime') || element.text().trim();
              break;
            } else {
              articleDate = element.text().trim();
              break;
            }
          }
        }
      }

      // Extract main content
      const contentSelectors = [
        'article',
        '.post-content',
        '.entry-content',
        '.content',
        'main',
        '#content',
        '.post',
        '[itemprop="articleBody"]'
      ];

      let mainContentElement = null;
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          mainContentElement = element;
          articleHTML = element.html();
          fullTextContent = element.text().trim();
          break;
        }
      }

      // If no content found with selectors, get body text as fallback
      if (!fullTextContent) {
        fullTextContent = $('body').text().trim();
        articleHTML = $('body').html();
      }

      // Clean up the text
      fullTextContent = fullTextContent.replace(/\s+/g, ' ').trim();

      // Extract all images from the entire page
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        const srcset = $(img).attr('srcset');
        const alt = $(img).attr('alt') || '';
        const width = parseInt($(img).attr('width') || '0', 10);
        const height = parseInt($(img).attr('height') || '0', 10);
        const caption = $(img).attr('title') || $(img).next('figcaption').text().trim() || '';

        if (src) {
          let imgUrl = src;
          if (src.startsWith('/')) {
            const urlObj = new URL(item.link);
            imgUrl = `${urlObj.origin}${src}`;
          } else if (!src.startsWith('http')) {
            const urlObj = new URL(item.link);
            imgUrl = `${urlObj.origin}/${src}`;
          }

          let priority = 1;
          if (mainContentElement && $(mainContentElement).find(`img[src="${src}"]`).length > 0) {
            priority = 3;
          } else if ($(img).parents('article, .content, .post-content, .entry-content').length > 0) {
            priority = 2;
          }

          pageImages.push({
            url: imgUrl,
            alt,
            width,
            height,
            area: width * height,
            position: 'content',
            priority,
            caption
          });
        }

        if (srcset) {
          const srcsetParts = srcset.split(',');
          for (const part of srcsetParts) {
            const [url, _] = part.trim().split(' ');
            if (url && !pageImages.some(img => img.url === url)) {
              let imgUrl = url;
              if (url.startsWith('/')) {
                const urlObj = new URL(item.link);
                imgUrl = `${urlObj.origin}${url}`;
              } else if (!url.startsWith('http')) {
                const urlObj = new URL(item.link);
                imgUrl = `${urlObj.origin}/${url}`;
              }

              pageImages.push({
                url: imgUrl,
                alt,
                width,
                height,
                area: width * height,
                position: 'srcset',
                priority: 1,
                caption
              });
            }
          }
        }
      });

      // Check for Open Graph images
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        let imgUrl = ogImage;
        if (ogImage.startsWith('/')) {
          const urlObj = new URL(item.link);
          imgUrl = `${urlObj.origin}${ogImage}`;
        } else if (!ogImage.startsWith('http')) {
          const urlObj = new URL(item.link);
          imgUrl = `${urlObj.origin}/${ogImage}`;
        }

        pageImages.push({
          url: imgUrl,
          alt: pageTitle,
          position: 'og:image',
          priority: 4,
          caption: pageTitle
        });
      }

      // Twitter card image
      const twitterImage = $('meta[name="twitter:image"]').attr('content');
      if (twitterImage && twitterImage !== ogImage) {
        let imgUrl = twitterImage;
        if (twitterImage.startsWith('/')) {
          const urlObj = new URL(item.link);
          imgUrl = `${urlObj.origin}${twitterImage}`;
        } else if (!twitterImage.startsWith('http')) {
          const urlObj = new URL(item.link);
          imgUrl = `${urlObj.origin}/${twitterImage}`;
        }

        pageImages.push({
          url: imgUrl,
          alt: pageTitle,
          position: 'twitter:image',
          priority: 3.5,
          caption: pageTitle
        });
      }

      // Convert HTML content to Markdown
      if (articleHTML) {
        const $article = cheerio.load(articleHTML);
        let markdown = '';

        // Process headings
        for (let i = 1; i <= 6; i++) {
          $article(`h${i}`).each((_, el) => {
            const text = $article(el).text().trim();
            const hashes = '#'.repeat(i);
            $article(el).replaceWith(`\n\n${hashes} ${text}\n\n`);
          });
        }

        // Process paragraphs
        $article('p').each((_, el) => {
          const text = $article(el).text().trim();
          if (text) {
            $article(el).replaceWith(`\n\n${text}\n\n`);
          }
        });

        // Process links
        $article('a').each((_, el) => {
          const text = $article(el).text().trim();
          const href = $article(el).attr('href') || '';
          if (text && href) {
            $article(el).replaceWith(`[${text}](${href})`);
          }
        });

        // Process images
        $article('img').each((_, el) => {
          const src = $article(el).attr('src') || '';
          const alt = $article(el).attr('alt') || '';
          const title = $article(el).attr('title') || '';

          let imgUrl = src;
          if (src.startsWith('/')) {
            const urlObj = new URL(item.link);
            imgUrl = `${urlObj.origin}${src}`;
          } else if (src && !src.startsWith('http')) {
            const urlObj = new URL(item.link);
            imgUrl = `${urlObj.origin}/${src}`;
          }

          const titlePart = title ? ` "${title}"` : '';
          if (imgUrl) {
            $article(el).replaceWith(`\n\n![${alt}](${imgUrl}${titlePart})\n\n`);
          }
        });

        // Process lists
        $article('ul').each((_, el) => {
          $article(el).prepend('\n\n');
          $article(el).append('\n\n');
        });

        $article('ol').each((_, el) => {
          $article(el).prepend('\n\n');
          $article(el).append('\n\n');
        });

        $article('li').each((_, el) => {
          const text = $article(el).text().trim();
          const isInOrderedList = $article(el).parent().is('ol');

          if (isInOrderedList) {
            $article(el).replaceWith(`1. ${text}\n`);
          } else {
            $article(el).replaceWith(`* ${text}\n`);
          }
        });

        // Process blockquotes
        $article('blockquote').each((_, el) => {
          const text = $article(el).text().trim().split('\n').join('\n> ');
          $article(el).replaceWith(`\n\n> ${text}\n\n`);
        });

        // Process code blocks
        $article('pre').each((_, el) => {
          const text = $article(el).text().trim();
          $article(el).replaceWith(`\n\n\`\`\`\n${text}\n\`\`\`\n\n`);
        });

        $article('code').each((_, el) => {
          const text = $article(el).text().trim();
          if (!$article(el).parents('pre').length) {
            $article(el).replaceWith(`\`${text}\``);
          }
        });

        // Process horizontal rules
        $article('hr').each((_, el) => {
          $article(el).replaceWith('\n\n---\n\n');
        });

        // Get the processed content and clean it up
        markdown = $article.text()
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        fullMarkdownContent = markdown;
      }

      console.log(`✅ Successfully fetched and parsed HTML from ${item.link}`);
    } catch (fetchError) {
      console.error(`⚠️ Error fetching HTML from ${item.link}:`, fetchError.message);
    }

    // 3. Prepare item data for OpenAI extraction
    const description = item.description || '';
    const content = item.content || '';

    const descriptionText = customExtractTextFromHTML(description);
    const contentText = customExtractTextFromHTML(content);

    const descriptionImages = customExtractImagesFromHTML(description, item.link);
    const contentImages = customExtractImagesFromHTML(content, item.link);

    // Combine images from all sources
    let allImages = [
      ...(item.media?.thumbnail ? [{ url: item.media.thumbnail, position: 'media:thumbnail', priority: 2 }] : []),
      ...(item.media?.content ? [{ url: item.media.content, position: 'media:content', priority: 2 }] : []),
      ...descriptionImages,
      ...contentImages,
      ...pageImages
    ];

    // Remove duplicates by URL
    const uniqueImagesMap = new Map();
    allImages.forEach(img => {
      const existingImg = uniqueImagesMap.get(img.url);
      if (!existingImg ||
        (img.priority || 0) > (existingImg.priority || 0) ||
        ((img.priority || 0) === (existingImg.priority || 0) &&
          (img.area || 0) > (existingImg.area || 0))) {
        uniqueImagesMap.set(img.url, img);
      }
    });

    const uniqueImages = Array.from(uniqueImagesMap.values());

    // Prioritize images by position and area
    uniqueImages.sort((a, b) => {
      if ((b.priority || 0) !== (a.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0);
      }
      return (b.area || 0) - (a.area || 0);
    });

    // Get top 5 images
    const topImages = uniqueImages.slice(0, 5);

    const categories = item.categories || [];

    // Prepare complete blog data
    const blogData = {
      title: pageTitle || item.title || 'No Title',
      original_title: item.title || '',
      description_text: fullTextContent || descriptionText || contentText || pageMetaDescription || 'No Description',
      original_description: descriptionText || '',
      images: topImages.map(img => ({
        url: img.url,
        alt: img.alt || '',
        caption: img.caption || ''
      })),
      thumbnail: uniqueImages.length > 0 ? uniqueImages[0].url : '',
      url: item.link,
      pubDate: articleDate || item.pubDate || '',
      author: articleAuthor || item.creator || '',
      categories: categories,
      full_html_fetched: !!fullHtmlContent,
      meta_description: pageMetaDescription,
      markdown_content: fullMarkdownContent || '',
      source_domain: new URL(item.link).hostname
    };

    const rawItemJSON = JSON.stringify(blogData);

    const prompt = `
You are a professional blog content creator. Your task is to create a high-quality, engaging blog post from this RSS feed item.

Here's the detailed blog content data:
${rawItemJSON}

INSTRUCTIONS:
1. Create a polished, engaging blog post in markdown format
2. Include a compelling title that captures attention (H1 format)
3. Begin with an engaging introduction paragraph
4. Maintain the original intent and information from the source
5. Organize the content with appropriate headings (H2, H3) for better readability
6. Integrate the provided images at logical points in the content with proper captions
7. Add appropriate alt text for all images for accessibility
8. Include a brief conclusion that summarizes key points
9. Remove any unnecessary or redundant content like navigation elements, footers, etc.
10. Ensure the content flows naturally and reads professionally
11. If categories are available, incorporate them as tags at the end
12. Incorporate the original source and author as a reference at the end

IMPORTANT: Your output must be in perfect markdown format, ready to be displayed as a professional blog post. Focus on delivering valuable content without any website cruft or unnecessary elements.

Return ONLY the markdown blog content, with no extra commentary. It should be ready to display as-is. don't show "markdown" in the starting just show the tile as # title`;

    // 4. Use OpenAI to extract and enhance data
    let enhancedBlogMarkdown = '';
    try {
      const aiRes = await callOpenAIWithRetry([{ role: 'user', content: prompt }], 10000, 0.7);
      enhancedBlogMarkdown = aiRes.choices[0]?.message?.content || '';
      console.log(`🤖 OpenAI blog creation: ${enhancedBlogMarkdown.substring(0, 100)}...`);
    } catch (openAiError) {
      console.error(`❌ Failed to create blog with OpenAI:`, openAiError.message);

      // Fallback to basic markdown
      enhancedBlogMarkdown = `# ${blogData.title}\n\n`;

      if (blogData.pubDate) {
        enhancedBlogMarkdown += `*Published on: ${blogData.pubDate}*\n\n`;
      }

      if (blogData.author) {
        enhancedBlogMarkdown += `*By: ${blogData.author}*\n\n`;
      }

      if (blogData.images && blogData.images.length > 0) {
        const firstImage = blogData.images[0];
        enhancedBlogMarkdown += `![${firstImage.alt || 'Image'}](${firstImage.url})\n\n`;
      }

      enhancedBlogMarkdown += `${blogData.description_text.substring(0, 1000)}...\n\n`;
      enhancedBlogMarkdown += `[Read the full article](${blogData.url})\n\n`;

      if (blogData.categories && blogData.categories.length > 0) {
        enhancedBlogMarkdown += `**Categories:** ${blogData.categories.join(', ')}\n\n`;
      }
    }

    // 5. Humanize the generated blog
    let humanizedBlogMarkdown = enhancedBlogMarkdown;

    try {
      console.log(`🔄 Trying StealthGPT for humanization`);

      const requestBody = {
        prompt: enhancedBlogMarkdown,
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

      if (res.ok) {
        const result = await res.json();
        const stealthText = result.text || result.output || result.rephrased_text;

        if (stealthText) {
          console.log(`✅ StealthGPT succeeded`);
          humanizedBlogMarkdown = stealthText;
        }
      } else {
        console.log(`⚠️ StealthGPT failed, falling back to OpenAI`);

        const fallbackPrompt = `
Improve this blog post markdown to make it more engaging, conversational, and human-sounding while keeping the same structure and information:

${enhancedBlogMarkdown}

Only return the improved markdown, nothing else. Maintain all headings, images, and formatting.`;

        try {
          const fallbackRes = await callOpenAIWithRetry([{ role: 'user', content: fallbackPrompt }], 10000, 0.7);
          humanizedBlogMarkdown = fallbackRes.choices[0]?.message?.content || enhancedBlogMarkdown;
          console.log(`✅ OpenAI fallback succeeded`);
        } catch (fallbackError) {
          console.error(`❌ OpenAI fallback failed: ${fallbackError.message}`);
        }
      }
    } catch (err) {
      console.error(`❌ Humanization error:`, err.message);
    }

    // 6. Insert the comprehensive markdown into Humanize_Data
    const { error: humanizeError } = await supabase
      .from('Humanize_Data')
      .insert({
        humanize_Data: humanizedBlogMarkdown,
        rss_feed_data_column: rssItemId
      });

    if (humanizeError) {
      console.error(`❌ Error inserting into Humanize_Data:`, humanizeError);
      return { status: 'error', error: humanizeError, rssItemId };
    } else {
      console.log(`✅ Successfully processed item`);
      return { status: 'success', rssItemId };
    }

  } catch (itemError) {
    console.error(`❌ Error processing item:`, itemError);
    return { status: 'error', error: itemError };
  }
}

// Cron job handler
export async function GET(req) {
  try {
    // Add authentication check for cron job security
    // const authHeader = req.headers.get('authorization');
    // const cronSecret = process.env.CRON_SECRET;

    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    //     status: 401,
    //     headers: { 'Content-Type': 'application/json' },
    //   });
    // }

    console.log('🚀 Starting RSS feed cron job');

    // 1. Fetch all RSS feeds from the database
    const { data: rssFeeds, error: feedsError } = await supabase
      .from('rss_feeds')
      .select('id, feed_url');

    if (feedsError) {
      console.error('❌ Error fetching RSS feeds:', feedsError);
      throw new Error('Failed to fetch RSS feeds from database');
    }

    if (!rssFeeds || rssFeeds.length === 0) {
      console.log('📭 No RSS feeds found in database');
      return new Response(JSON.stringify({
        success: true,
        message: 'No RSS feeds to process'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${rssFeeds.length} RSS feeds to process`);

    // 2. Fetch all existing blog URLs from rss_feed_data
    const { data: existingData, error: existingError } = await supabase
      .from('rss_feed_data')
      .select('blog_url');

    if (existingError) {
      console.error('❌ Error fetching existing blog URLs:', existingError);
      throw new Error('Failed to fetch existing blog URLs');
    }

    // Create a Set of existing URLs for faster lookup
    const existingUrls = new Set(existingData?.map(item => item.blog_url) || []);
    console.log(`📊 Found ${existingUrls.size} existing blog URLs in database`);

    // 3. Parse all RSS feeds in parallel
    const feedParsingPromises = rssFeeds.map(async (feed) => {
      try {
        console.log(`🔄 Parsing feed: ${feed.feed_url}`);
        const feedData = await parseFeed(feed.feed_url);
        return {
          feedId: feed.id,
          feedUrl: feed.feed_url,
          items: feedData.items || [],
          error: null
        };
      } catch (error) {
        console.error(`❌ Error parsing feed ${feed.feed_url}:`, error);
        return {
          feedId: feed.id,
          feedUrl: feed.feed_url,
          items: [],
          error: error.message
        };
      }
    });

    const parsedFeeds = await Promise.all(feedParsingPromises);

    // 4. Collect all new items to process
    const itemsToProcess = [];
    let totalNewItems = 0;

    for (const parsedFeed of parsedFeeds) {
      if (parsedFeed.error) {
        console.warn(`⚠️ Skipping feed ${parsedFeed.feedUrl} due to error: ${parsedFeed.error}`);
        continue;
      }

      // Filter out items that already exist
      const newItems = parsedFeed.items.filter(item =>
        item.link && !existingUrls.has(item.link)
      );

      totalNewItems += newItems.length;

      // Add items with their feed ID
      newItems.forEach(item => {
        itemsToProcess.push({
          item,
          feedId: parsedFeed.feedId
        });
      });

      console.log(`📈 Feed ${parsedFeed.feedUrl}: ${newItems.length} new items out of ${parsedFeed.items.length} total`);
    }

    if (itemsToProcess.length === 0) {
      console.log('✅ No new items to process');
      return new Response(JSON.stringify({
        success: true,
        message: 'No new items to process',
        stats: {
          feedsChecked: rssFeeds.length,
          totalNewItems: 0,
          processed: 0,
          errors: 0
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`🎯 Processing ${itemsToProcess.length} new items in parallel`);

    // 5. Process all new items in parallel
    const processingPromises = itemsToProcess.map(({ item, feedId }) =>
      processItem(item, feedId, existingUrls)
    );

    const results = await Promise.all(processingPromises);

    // 6. Compile statistics
    const stats = {
      feedsChecked: rssFeeds.length,
      totalNewItems: itemsToProcess.length,
      processed: results.filter(r => r.status === 'success').length,
      errors: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };

    console.log('📊 Cron job completed:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🔥 Cron job error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}