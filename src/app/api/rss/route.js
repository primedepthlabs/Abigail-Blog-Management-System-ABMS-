import { JSDOM } from 'jsdom';
import { OpenAI } from 'openai';
import { marked } from 'marked';
import supabase from '@/lib/supabaseClient';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Initialize DeepSeek API client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'sk-7cea9a49d17642c193d15edb2ebd659e',
  baseURL: 'https://api.deepseek.com/v1'
});

const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
  },
  error: (message, error) => {
    console.error(
      `[ERROR] ${new Date().toISOString()} - ${message}`,
      error || '',
    );
  },
  success: (message, data) => {
    console.log(
      `[SUCCESS] ${new Date().toISOString()} - ${message}`,
      data || '',
    );
  },
};

// Function to convert markdown to HTML
function markdownToHtml(markdown) {
  try {
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });
    return marked(markdown);
  } catch (error) {
    logger.error('Error converting markdown to HTML:', error);
    return markdown.replace(/\n/g, '<br>');
  }
}

// Extract title from markdown
function extractTitle(markdown) {
  const lines = markdown.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.substring(2).trim();
    }
  }
  return 'Blog Post';
}

// SHOPIFY FUNCTIONS - Dynamic configuration
async function getBlogId(shopifyConfig) {
  try {
    const response = await fetch(
      `https://${shopifyConfig.shopDomain}/admin/api/2023-10/blogs.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyConfig.accessToken,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch blogs: ${response.status}`);
    }

    const data = await response.json();
    if (data.blogs && data.blogs.length > 0) {
      logger.info(
        `Using Shopify blog: ${data.blogs[0].title} (ID: ${data.blogs[0].id}) on ${shopifyConfig.name}`,
      );
      return data.blogs[0].id;
    }
    throw new Error('No blogs found');
  } catch (error) {
    logger.error(`Error getting blog ID for ${shopifyConfig.name}:`, error);
    throw error;
  }
}

async function createShopifyBlogPost(humanizedMarkdown, blogData = {}, shopifyConfig) {
  try {
    const blogId = await getBlogId(shopifyConfig);
    const title = extractTitle(humanizedMarkdown);
    const htmlContent = markdownToHtml(humanizedMarkdown);

    // Create excerpt (first 150 characters of text)
    const plainText = humanizedMarkdown
      .replace(/^#.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

    const excerpt =
      plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;

    // Prepare tags
    const tags =
      blogData.categories && blogData.categories.length > 0
        ? blogData.categories.join(', ') + ', RSS Feed, Auto-Generated'
        : 'RSS Feed, Auto-Generated';

    const articleData = {
      article: {
        title: title,
        body_html: htmlContent,
        summary: excerpt,
        tags: tags,
        published: false,
        author: shopifyConfig.defaultAuthor || blogData.author || 'RSS Bot',
        created_at: blogData.pubDate
          ? new Date(blogData.pubDate).toISOString()
          : new Date().toISOString(),
      },
    };

    // Add featured image if available
    if (blogData.thumbnail) {
      articleData.article.image = {
        src: blogData.thumbnail,
        alt: title,
      };
    }

    logger.info(`Creating Shopify blog post on ${shopifyConfig.name}: "${title}"`);

    const response = await fetch(
      `https://${shopifyConfig.shopDomain}/admin/api/2023-10/blogs/${blogId}/articles.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyConfig.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(articleData),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Shopify API error: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const result = await response.json();
    logger.success(`Created Shopify blog post on ${shopifyConfig.name}: ${result.article.id}`);

    return {
      success: true,
      platform: 'shopify',
      destination: shopifyConfig.name,
      destinationId: shopifyConfig.id,
      articleId: result.article.id,
      title: result.article.title,
      handle: result.article.handle,
      url: `https://${shopifyConfig.shopDomain.replace(
        '.myshopify.com',
        '',
      )}/blogs/${result.article.blog_id}/${result.article.handle}`,
      publishedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Failed to create Shopify blog post on ${shopifyConfig.name}:`, error);
    return {
      success: false,
      platform: 'shopify',
      destination: shopifyConfig.name,
      destinationId: shopifyConfig.id,
      error: error.message,
      publishedAt: new Date().toISOString(),
    };
  }
}

// WORDPRESS FUNCTIONS - Dynamic configuration
async function createWordPressBlogPost(humanizedMarkdown, blogData = {}, wpConfig) {
  try {
    const title = extractTitle(humanizedMarkdown);
    const htmlContent = markdownToHtml(humanizedMarkdown);

    logger.info(`Creating WordPress blog post on ${wpConfig.name}: "${title}"`);

    // Create excerpt from markdown
    const plainText = humanizedMarkdown
      .replace(/^#.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

    const excerpt =
      plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText;

    const wpAuth = Buffer.from(`${wpConfig.username}:${wpConfig.password}`).toString('base64');

    const wpPayload = {
      title: title,
      content: htmlContent,
      status: wpConfig.defaultStatus || 'publish',
      excerpt: excerpt,
      author: 1, // Default author ID
      categories: wpConfig.defaultCategory ? [wpConfig.defaultCategory] : [1],
      tags: wpConfig.tags || [],
      meta: {
        _wp_original_source: blogData.url || '',
        _wp_original_author: blogData.author || '',
        _wp_publication_date: blogData.pubDate || new Date().toISOString(),
        _wp_rss_source: 'Auto-Generated from RSS Feed',
        _wp_destination: wpConfig.name,
      },
    };

    logger.info(`WordPress payload created for ${wpConfig.name}`, {
      title: wpPayload.title,
      contentLength: wpPayload.content?.length || 0,
      status: wpPayload.status,
      originalSource: blogData.url,
    });

    const wpRes = await fetch(wpConfig.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${wpAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wpPayload),
    });

    const wpData = await wpRes.json();

    if (!wpRes.ok) {
      logger.error(`WordPress API error for ${wpConfig.name}:`, {
        status: wpRes.status,
        statusText: wpRes.statusText,
        response: wpData,
      });

      return {
        success: false,
        platform: 'wordpress',
        destination: wpConfig.name,
        destinationId: wpConfig.id,
        error: wpData.message || `WordPress API error: ${wpRes.status}`,
        publishedAt: new Date().toISOString(),
      };
    }

    logger.success(`Successfully published to WordPress ${wpConfig.name}`, {
      wp_post_id: wpData.id,
      wp_url: wpData.link || 'N/A',
    });

    return {
      success: true,
      platform: 'wordpress',
      destination: wpConfig.name,
      destinationId: wpConfig.id,
      postId: wpData.id,
      title: wpData.title?.rendered || title,
      url: wpData.link,
      slug: wpData.slug,
      publishedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Failed to create WordPress blog post on ${wpConfig.name}:`, error);
    return {
      success: false,
      platform: 'wordpress',
      destination: wpConfig.name,
      destinationId: wpConfig.id,
      error: error.message,
      publishedAt: new Date().toISOString(),
    };
  }
}

// Helper function for DeepSeek API with retry logic
async function callDeepSeekWithRetry(
  messages,
  maxTokens = 10000,
  temperature = 0.2,
  maxRetries = 3,
) {
  let retries = 0;
  let lastError = null;

  while (retries < maxRetries) {
    try {
      const response = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: messages,
        temperature: temperature,
      });
      return response;
    } catch (error) {
      lastError = error;
      logger.error(
        `DeepSeek API error (attempt ${retries + 1}/${maxRetries}): ${error.message}`,
      );

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      retries++;
    }
  }

  throw new Error(
    `DeepSeek API failed after ${maxRetries} attempts. Last error: ${lastError.message}`,
  );
}

// Custom function to extract text from HTML
function customExtractTextFromHTML(html) {
  if (!html) return '';

  try {
    const $ = cheerio.load(html);
    $('script, style').remove();
    let text = $('body').text();
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    logger.error('Error extracting text from HTML:', error.message);
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
          caption: title,
        });
      }
    });

    return images;
  } catch (error) {
    logger.error('Error extracting images from HTML:', error.message);
    return [];
  }
}

// UPDATED processItem function with MULTI-DESTINATION publishing
async function processItem(
  item,
  index,
  totalItems,
  feedId,
  publishingDestinations,
  shouldHumanize = true,
) {
  try {
    if (!item.link) {
      logger.info(`Skipping item ${index} - no link available`);
      return { status: 'error', error: 'No link available' };
    }

    logger.info(
      `Processing item ${index + 1}/${totalItems} with DeepSeek: ${item.title?.substring(
        0,
        30,
      )}... ${shouldHumanize ? '(with humanization)' : '(raw only)'}`,
    );

    // 1. Insert the blog URL into rss_feed_data
    const { data: rssItemData, error: rssItemError } = await supabase
      .from('rss_feed_data')
      .insert({
        feed_id: feedId,
        blog_url: item.link,
      })
      .select('id');

    if (rssItemError) {
      logger.error(`Error inserting into rss_feed_data:`, rssItemError);
      return { status: 'error', error: rssItemError };
    }

    const rssItemId = rssItemData[0].id;

    // 2. Fetch full HTML content from the blog URL
    logger.info(`Fetching full HTML from: ${item.link}`);
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
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 15000,
      });

      fullHtmlContent = response.data;
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
        '[itemprop="author"]',
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
          '[itemprop="datePublished"]',
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
        '[itemprop="articleBody"]',
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

      if (!fullTextContent) {
        fullTextContent = $('body').text().trim();
        articleHTML = $('body').html();
      }

      fullTextContent = fullTextContent.replace(/\s+/g, ' ').trim();

      // Extract all images from the entire page
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        const alt = $(img).attr('alt') || '';
        const width = parseInt($(img).attr('width') || '0', 10);
        const height = parseInt($(img).attr('height') || '0', 10);
        const caption =
          $(img).attr('title') || $(img).next('figcaption').text().trim() || '';

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
          if (
            mainContentElement &&
            $(mainContentElement).find(img).length > 0
          ) {
            priority = 3;
          } else if (
            $(img).parents('article, .content, .post-content, .entry-content')
              .length > 0
          ) {
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
            caption,
          });
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
          caption: pageTitle,
        });
      }

      // Convert HTML content to Markdown - Simple custom implementation
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
            $article(el).replaceWith(
              `\n\n![${alt}](${imgUrl}${titlePart})\n\n`,
            );
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

        markdown = $article
          .text()
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        fullMarkdownContent = markdown;
      }

      logger.success(`Successfully fetched and parsed HTML from ${item.link}`);
    } catch (fetchError) {
      logger.error(
        `Error fetching HTML from ${item.link}:`,
        fetchError.message,
      );
    }

    // 3. Prepare item data for DeepSeek extraction
    const description = item.description || '';
    const content = item.content || '';

    const descriptionText = customExtractTextFromHTML(description);
    const contentText = customExtractTextFromHTML(content);

    const descriptionImages = customExtractImagesFromHTML(
      description,
      item.link,
    );
    const contentImages = customExtractImagesFromHTML(content, item.link);

    // Combine images from all sources
    let allImages = [
      ...(item.media?.thumbnail
        ? [
          {
            url: item.media.thumbnail,
            position: 'media:thumbnail',
            priority: 2,
          },
        ]
        : []),
      ...(item.media?.content
        ? [{ url: item.media.content, position: 'media:content', priority: 2 }]
        : []),
      ...descriptionImages,
      ...contentImages,
      ...pageImages,
    ];

    // Remove duplicates by URL
    const uniqueImagesMap = new Map();
    allImages.forEach((img) => {
      const existingImg = uniqueImagesMap.get(img.url);
      if (
        !existingImg ||
        (img.priority || 0) > (existingImg.priority || 0) ||
        ((img.priority || 0) === (existingImg.priority || 0) &&
          (img.area || 0) > (existingImg.area || 0))
      ) {
        uniqueImagesMap.set(img.url, img);
      }
    });

    const uniqueImages = Array.from(uniqueImagesMap.values());
    uniqueImages.sort((a, b) => {
      if ((b.priority || 0) !== (a.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0);
      }
      return (b.area || 0) - (a.area || 0);
    });

    const topImages = uniqueImages.slice(0, 5);
    const categories = item.categories || [];

    // Prepare complete blog data
    const blogData = {
      title: pageTitle || item.title || 'No Title',
      original_title: item.title || '',
      description_text:
        fullTextContent ||
        descriptionText ||
        contentText ||
        pageMetaDescription ||
        'No Description',
      original_description: descriptionText || '',
      images: topImages.map((img) => ({
        url: img.url,
        alt: img.alt || '',
        caption: img.caption || '',
      })),
      thumbnail: uniqueImages.length > 0 ? uniqueImages[0].url : '',
      url: item.link,
      pubDate: articleDate || item.pubDate || '',
      author: articleAuthor || item.creator || '',
      categories: categories,
      full_html_fetched: !!fullHtmlContent,
      meta_description: pageMetaDescription,
      markdown_content: fullMarkdownContent || '',
      source_domain: new URL(item.link).hostname,
    };

    const rawItemJSON = JSON.stringify(blogData);

    // Enhanced prompt for DeepSeek
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

IMPORTANT: Your output must be in perfect markdown format, ready to be displayed as a professional blog post. Focus on delivering valuable content without any website cruft or unnecessary elements.

Return ONLY the markdown blog content, with no extra commentary. It should be ready to display as-is. Don't show "markdown" in the starting just show the title as # title`;

    // 4. Use DeepSeek to extract and enhance data
    let enhancedBlogMarkdown = '';
    try {
      const systemMessage = {
        role: 'system',
        content: `You are a professional technical blogger. Produce a polished, SEO-friendly blog post in Markdown. Guidelines:
    - Use H1 for the title, H2 for main sections, H3 for subsections.
    - Separate paragraphs with a blank line.
    - Insert images in context; provide alt text and optional captions.
    - Maintain an engaging, authoritative tone.
    - Include an introduction, body with logical headings, and a concise conclusion.
    - Do not include any HTML or raw JSON; only Markdown.`
      };
      const aiRes = await callDeepSeekWithRetry(
        [systemMessage, { role: 'user', content: prompt }],
        16000,
      );
      enhancedBlogMarkdown = aiRes.choices[0]?.message?.content || '';
      logger.info(
        `DeepSeek blog creation: ${enhancedBlogMarkdown.substring(0, 100)}...`,
      );
    } catch (deepSeekError) {
      logger.error(`Failed to create blog with DeepSeek:`, deepSeekError.message);

      // If DeepSeek fails, create a basic markdown blog from available data
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

      enhancedBlogMarkdown += `${blogData.description_text.substring(0, 10000)}...\n\n`;

      if (blogData.categories && blogData.categories.length > 0) {
        enhancedBlogMarkdown += `**Categories:** ${blogData.categories.join(', ')}\n\n`;
      }
    }

    // 5. Humanize the generated blog with DeepSeek
    let humanizedBlogMarkdown = enhancedBlogMarkdown;

    if (shouldHumanize) {
      try {
        logger.info(`Using DeepSeek for humanization for item ${index + 1}`);

        const humanizePrompt = `
Improve this blog post markdown to make it more engaging, conversational, and human-sounding while keeping the same structure and information:

${enhancedBlogMarkdown}

Make it sound more natural and less AI-generated. Use varied sentence structures, add personality, and make it flow better while maintaining all the technical accuracy and information. Only return the improved markdown, nothing else.`;

        const humanizeRes = await callDeepSeekWithRetry(
          [{ role: 'user', content: humanizePrompt }],
          10000,
          0.7,
        );
        humanizedBlogMarkdown = humanizeRes.choices[0]?.message?.content || enhancedBlogMarkdown;
        logger.success(`DeepSeek humanization succeeded for item ${index + 1}`);
      } catch (humanizeError) {
        logger.error(`DeepSeek humanization failed: ${humanizeError.message}`);
      }
    }

    // 6. Insert the comprehensive markdown into Humanize_Data
    const { data: humanizeData, error: humanizeError } = await supabase
      .from('Humanize_Data')
      .insert({
        humanize_Data: humanizedBlogMarkdown,
        rss_feed_data_column: rssItemId,
      })
      .select('id');

    if (humanizeError) {
      logger.error(`Error inserting into Humanize_Data:`, humanizeError);
      return { status: 'error', error: humanizeError, rssItemId };
    }

    const humanizeDataId = humanizeData[0].id;

    // 7. MULTI-DESTINATION PUBLISHING
    logger.info(
      `Publishing to ${publishingDestinations.shopify.length} Shopify stores and ${publishingDestinations.wordpress.length} WordPress sites`,
    );

    const publishingResults = {
      shopify: [],
      wordpress: [],
    };

    // Publish to all selected Shopify stores in parallel
    if (publishingDestinations.shopify.length > 0) {
      const shopifyPromises = publishingDestinations.shopify.map(shopifyConfig =>
        createShopifyBlogPost(humanizedBlogMarkdown, blogData, shopifyConfig)
      );
      const shopifyResults = await Promise.all(shopifyPromises);
      publishingResults.shopify = shopifyResults;
    }

    // Publish to all selected WordPress sites in parallel
    if (publishingDestinations.wordpress.length > 0) {
      const wpPromises = publishingDestinations.wordpress.map(wpConfig =>
        createWordPressBlogPost(humanizedBlogMarkdown, blogData, wpConfig)
      );
      const wpResults = await Promise.all(wpPromises);
      publishingResults.wordpress = wpResults;
    }

    // 8. Update database with all publication results
    const updateData = {
      publishing_results: JSON.stringify(publishingResults),
      total_shopify_published: publishingResults.shopify.filter(r => r.success).length,
      total_wordpress_published: publishingResults.wordpress.filter(r => r.success).length,
      total_destinations: publishingDestinations.shopify.length + publishingDestinations.wordpress.length,
      published_at: new Date().toISOString(),

      // Legacy compatibility - set first successful result to old fields
      published_to_shopify: publishingResults.shopify.some(r => r.success),
      shopify_article_id: publishingResults.shopify.find(r => r.success)?.articleId || null,
      shopify_url: publishingResults.shopify.find(r => r.success)?.url || null,
      shopify_handle: publishingResults.shopify.find(r => r.success)?.handle || null,
      shopify_created_at: publishingResults.shopify.find(r => r.success)?.publishedAt || null,
      shopify_error: publishingResults.shopify.find(r => !r.success)?.error || null,

      wp_published: publishingResults.wordpress.some(r => r.success),
      wp_post_id: publishingResults.wordpress.find(r => r.success)?.postId || null,
      wp_url: publishingResults.wordpress.find(r => r.success)?.url || null,
      wp_slug: publishingResults.wordpress.find(r => r.success)?.slug || null,
      wp_published_at: publishingResults.wordpress.find(r => r.success)?.publishedAt || null,
      wp_error: publishingResults.wordpress.find(r => !r.success)?.error || null,
    };

    await supabase
      .from('Humanize_Data')
      .update(updateData)
      .eq('id', humanizeDataId);

    // Calculate success metrics
    const totalSuccess = publishingResults.shopify.filter(r => r.success).length +
      publishingResults.wordpress.filter(r => r.success).length;
    const totalAttempts = publishingResults.shopify.length + publishingResults.wordpress.length;

    logger.success(`Successfully processed item ${index + 1} - Published to ${totalSuccess}/${totalAttempts} destinations`);

    return {
      status: 'success',
      rssItemId,
      publishingResults,
      totalSuccess,
      totalAttempts,
      humanized: shouldHumanize,
      aiProvider: 'DeepSeek'
    };
  } catch (itemError) {
    logger.error(`Error processing item ${index}:`, itemError);
    return { status: 'error', error: itemError.message || 'Unknown error' };
  }
}

// Process and humanize feed content with multi-destination publishing
async function processFeedContent(feedData, feedId, publishingDestinations, selectedIndices = null) {
  const results = {
    total: feedData.items.length,
    processed: 0,
    errors: 0,
    humanized: 0,
    skipped: 0,
    shopifyPublished: 0,
    wordpressPublished: 0,
    totalDestinations: publishingDestinations.shopify.length + publishingDestinations.wordpress.length,
    destinationResults: {
      shopify: publishingDestinations.shopify.map(config => ({
        name: config.name,
        destinationId: config.id,
        published: 0,
        errors: 0
      })),
      wordpress: publishingDestinations.wordpress.map(config => ({
        name: config.name,
        destinationId: config.id,
        published: 0,
        errors: 0
      })),
    },
    rss_feed_data_ids: [],
    aiProvider: 'DeepSeek'
  };

  logger.info(
    `Processing ${feedData.items.length} items to ${results.totalDestinations} destinations with DeepSeek${selectedIndices
      ? ` (${selectedIndices.length} selected for humanization)`
      : ' (all humanized)'
    }`,
  );

  // Create an array of promises for each item
  const processingPromises = feedData.items.map((item, index) => {
    const shouldHumanize = selectedIndices ? selectedIndices.includes(index) : true;
    return processItem(item, index, feedData.items.length, feedId, publishingDestinations, shouldHumanize);
  });

  // Execute all promises in parallel
  const itemResults = await Promise.all(processingPromises);

  // Collect results
  itemResults.forEach((result) => {
    if (result.status === 'success') {
      results.processed++;
      results.rss_feed_data_ids.push(result.rssItemId);

      if (result.humanized) {
        results.humanized++;
      } else {
        results.skipped++;
      }

      // Count successes by destination
      if (result.publishingResults) {
        result.publishingResults.shopify.forEach((shopifyResult) => {
          const destIndex = results.destinationResults.shopify.findIndex(
            d => d.destinationId === shopifyResult.destinationId
          );
          if (destIndex !== -1) {
            if (shopifyResult.success) {
              results.shopifyPublished++;
              results.destinationResults.shopify[destIndex].published++;
            } else {
              results.destinationResults.shopify[destIndex].errors++;
            }
          }
        });

        result.publishingResults.wordpress.forEach((wpResult) => {
          const destIndex = results.destinationResults.wordpress.findIndex(
            d => d.destinationId === wpResult.destinationId
          );
          if (destIndex !== -1) {
            if (wpResult.success) {
              results.wordpressPublished++;
              results.destinationResults.wordpress[destIndex].published++;
            } else {
              results.destinationResults.wordpress[destIndex].errors++;
            }
          }
        });
      }
    } else {
      results.errors++;
      if (result.rssItemId) {
        results.rss_feed_data_ids.push(result.rssItemId);
      }
    }
  });

  return results;
}

// RSS Feed parsing function
function parseRSSFeed(xml) {
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  const doc = dom.window.document;

  // Detect feed type
  let feedType = 'unknown';
  if (doc.querySelector('rss')) {
    feedType = 'rss';
  } else if (doc.querySelector('feed')) {
    feedType = 'atom';
  } else if (doc.querySelector('rdf\\:RDF, RDF')) {
    feedType = 'rdf';
  }

  const feedData = {
    title: '',
    description: '',
    link: '',
    lastBuildDate: '',
    language: '',
    items: [],
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

      // Standard RSS elements
      itemData.title = item.querySelector('title')?.textContent || '';
      itemData.link = item.querySelector('link')?.textContent || '';
      itemData.pubDate = item.querySelector('pubDate')?.textContent || '';
      itemData.description = item.querySelector('description')?.textContent || '';
      itemData.guid = item.querySelector('guid')?.textContent || '';
      itemData.categories = Array.from(item.querySelectorAll('category')).map((cat) => cat.textContent);

      // Handle content:encoded
      const contentEncoded =
        item.querySelector('content\\:encoded') ||
        item.getElementsByTagNameNS('*', 'encoded')[0];

      if (contentEncoded) {
        itemData.content = contentEncoded.textContent || '';
      }

      // Handle media elements
      const mediaThumbnail =
        item.querySelector('media\\:thumbnail') ||
        item.getElementsByTagNameNS('*', 'thumbnail')[0];

      const mediaContent =
        item.querySelector('media\\:content') ||
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

      // Process remaining elements
      const processedElements = new Set([
        'title', 'link', 'pubdate', 'description', 'guid', 'category', 'content:encoded'
      ]);

      children.forEach((child) => {
        const nodeName = child.nodeName.toLowerCase();

        if (processedElements.has(nodeName)) {
          return;
        }

        if (nodeName.includes(':')) {
          const [namespace, name] = nodeName.split(':');

          if (!itemData[namespace] || typeof itemData[namespace] !== 'object') {
            itemData[namespace] = {};
          }

          if (typeof itemData[namespace] === 'object' && !Array.isArray(itemData[namespace])) {
            itemData[namespace][name] = child.textContent || '';
          }
        } else {
          if (!itemData.hasOwnProperty(nodeName)) {
            itemData[nodeName] = child.textContent || '';
          }
        }
      });

      return itemData;
    });
  } else if (feedType === 'atom') {
    feedData.title = doc.querySelector('feed > title')?.textContent || '';
    feedData.description = doc.querySelector('feed > subtitle')?.textContent || '';
    feedData.link =
      doc.querySelector('feed > link[rel="alternate"]')?.getAttribute('href') ||
      doc.querySelector('feed > link')?.getAttribute('href') || '';
    feedData.lastBuildDate = doc.querySelector('feed > updated')?.textContent || '';

    feedData.items = Array.from(doc.querySelectorAll('entry')).map((entry) => {
      const itemData = {};

      itemData.title = entry.querySelector('title')?.textContent || '';
      itemData.link =
        entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
        entry.querySelector('link')?.getAttribute('href') || '';
      itemData.pubDate =
        entry.querySelector('published')?.textContent ||
        entry.querySelector('updated')?.textContent || '';
      itemData.description = entry.querySelector('summary')?.textContent || '';
      itemData.content = entry.querySelector('content')?.textContent || '';
      itemData.id = entry.querySelector('id')?.textContent || '';
      itemData.authors = Array.from(entry.querySelectorAll('author')).map((author) => {
        return {
          name: author.querySelector('name')?.textContent || '',
          email: author.querySelector('email')?.textContent || '',
        };
      });

      return itemData;
    });
  } else if (feedType === 'rdf') {
    feedData.title = doc.querySelector('channel > title')?.textContent || '';
    feedData.description = doc.querySelector('channel > description')?.textContent || '';
    feedData.link = doc.querySelector('channel > link')?.textContent || '';

    feedData.items = Array.from(doc.querySelectorAll('item')).map((item) => {
      const itemData = {};

      itemData.title = item.querySelector('title')?.textContent || '';
      itemData.link = item.querySelector('link')?.textContent || '';
      itemData.description = item.querySelector('description')?.textContent || '';

      const dcCreator =
        item.querySelector('dc\\:creator') ||
        item.getElementsByTagNameNS('*', 'creator')[0];
      if (dcCreator) {
        itemData.creator = dcCreator.textContent;
      }

      const dcDate =
        item.querySelector('dc\\:date') ||
        item.getElementsByTagNameNS('*', 'date')[0];
      if (dcDate) {
        itemData.pubDate = dcDate.textContent;
      }

      return itemData;
    });
  }

  return feedData;
}

// GET function
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  // If url param provided, fetch and parse that feed
  if (url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch feed: ${res.status}`);
      }

      const xml = await res.text();
      const feedData = parseRSSFeed(xml);

      return new Response(JSON.stringify(feedData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      logger.error('RSS fetch error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // If no URL param, return stored humanized blog data
  try {
    logger.info('Fetching humanized blog data from database');

    const { data: humanizedBlogs, error } = await supabase
      .from('Humanize_Data')
      .select(
        `
        id,
        humanize_Data,
        created_at,
        publishing_results,
        total_shopify_published,
        total_wordpress_published,
        total_destinations,
        published_at,
        shopify_article_id,
        shopify_url,
        shopify_handle,
        published_to_shopify,
        shopify_created_at,
        shopify_error,
        wp_post_id,
        wp_url,
        wp_slug,
        wp_published,
        wp_published_at,
        wp_error,
        rss_feed_data_column,
        rss_feed_data:rss_feed_data_column (
          id,
          blog_url,
          feed_id,
          rss_feeds:feed_id (
            id,
            feed_url
          )
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error fetching humanized blogs:', error);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transform data for frontend
    const transformedData = humanizedBlogs.map((item) => {
      const publishingResults = item.publishing_results ? JSON.parse(item.publishing_results) : null;

      return {
        id: item.id,
        humanize_Data: item.humanize_Data,
        created_at: item.created_at,
        publishing_status: {
          shopify: {
            published: item.published_to_shopify || false,
            article_id: item.shopify_article_id,
            url: item.shopify_url,
            handle: item.shopify_handle,
            published_at: item.shopify_created_at,
            error: item.shopify_error,
          },
          wordpress: {
            published: item.wp_published || false,
            post_id: item.wp_post_id,
            url: item.wp_url,
            slug: item.wp_slug,
            published_at: item.wp_published_at,
            error: item.wp_error,
          },
        },
        multi_destination_results: publishingResults,
        total_destinations: item.total_destinations || 0,
        total_shopify_published: item.total_shopify_published || 0,
        total_wordpress_published: item.total_wordpress_published || 0,
        source_info: {
          rss_item_id: item.rss_feed_data_column,
          original_url: item.rss_feed_data?.blog_url,
          feed_url: item.rss_feed_data?.rss_feeds?.feed_url,
          feed_id: item.rss_feed_data?.feed_id,
        },
        is_published_anywhere: item.published_to_shopify || item.wp_published,
        is_dual_published: item.published_to_shopify && item.wp_published,
        has_errors: !!(item.shopify_error || item.wp_error),
        live_urls: {
          shopify: item.shopify_url,
          wordpress: item.wp_url,
        },
        aiProvider: 'DeepSeek'
      };
    });

    // Calculate summary stats
    const summary = {
      total: transformedData.length,
      shopifyPublished: transformedData.filter(
        (item) => item.publishing_status.shopify.published,
      ).length,
      wordpressPublished: transformedData.filter(
        (item) => item.publishing_status.wordpress.published,
      ).length,
      dualPublished: transformedData.filter((item) => item.is_dual_published).length,
      unpublished: transformedData.filter((item) => !item.is_published_anywhere).length,
      totalDestinations: transformedData.reduce((sum, item) => sum + item.total_destinations, 0),
      avgDestinationsPerItem: transformedData.length > 0
        ? (transformedData.reduce((sum, item) => sum + item.total_destinations, 0) / transformedData.length).toFixed(1)
        : 0,
      aiProvider: 'DeepSeek'
    };

    logger.success(
      `Successfully fetched ${transformedData.length} humanized blogs processed with DeepSeek`,
    );

    return new Response(
      JSON.stringify({
        data: transformedData,
        summary,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('API error fetching humanized blogs:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST function with multi-destination support
export async function POST(req) {
  try {
    const { url, selectedItems, feedData, publishingDestinations } = await req.json();

    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new Error('Invalid or missing URL');
    }

    if (!publishingDestinations || (!publishingDestinations.shopify?.length && !publishingDestinations.wordpress?.length)) {
      throw new Error('No publishing destinations selected');
    }

    logger.info(`Processing RSS feed with DeepSeek: ${url}`);
    logger.info(`Publishing to: ${publishingDestinations.shopify?.length || 0} Shopify stores, ${publishingDestinations.wordpress?.length || 0} WordPress sites`);

    // Validate destination configurations
    const validationErrors = [];

    if (publishingDestinations.shopify) {
      publishingDestinations.shopify.forEach((shopifyConfig, index) => {
        if (!shopifyConfig.shopDomain || !shopifyConfig.accessToken) {
          validationErrors.push(`Shopify destination ${index + 1}: Missing shop domain or access token`);
        }
      });
    }

    if (publishingDestinations.wordpress) {
      publishingDestinations.wordpress.forEach((wpConfig, index) => {
        if (!wpConfig.apiUrl || !wpConfig.username || !wpConfig.password) {
          validationErrors.push(`WordPress destination ${index + 1}: Missing API URL, username, or password`);
        }
      });
    }

    if (validationErrors.length > 0) {
      throw new Error(`Destination configuration errors: ${validationErrors.join(', ')}`);
    }

    // 1. Check if feed already exists in the database
    const { data: existingFeeds, error: feedCheckError } = await supabase
      .from('rss_feeds')
      .select('id')
      .eq('feed_url', url)
      .limit(1);

    if (feedCheckError) {
      logger.error('Error checking for existing feed:', feedCheckError);
      throw new Error('Database error when checking for existing feed');
    }

    let feedId;

    if (existingFeeds && existingFeeds.length > 0) {
      feedId = existingFeeds[0].id;
      logger.info(`Feed already exists with ID: ${feedId}`);
    } else {
      const { data: newFeed, error: insertFeedError } = await supabase
        .from('rss_feeds')
        .insert({ feed_url: url })
        .select('id');

      if (insertFeedError || !newFeed) {
        logger.error('Error inserting feed URL:', insertFeedError);
        throw new Error('Failed to insert feed URL into database');
      }

      feedId = newFeed[0].id;
      logger.info(`Created new feed with ID: ${feedId}`);
    }

    // 2. Use provided feedData or fetch fresh data
    let processedFeedData = feedData;
    if (!processedFeedData) {
      logger.info(`Fetching fresh RSS feed data`);

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch feed: ${res.status}`);
      }

      const xml = await res.text();
      processedFeedData = parseRSSFeed(xml);
    }

    logger.info(`Feed parsed. Found ${processedFeedData.items.length} items`);

    // 3. Process the feed content with multi-destination publishing
    const processingResults = await processFeedContent(
      processedFeedData,
      feedId,
      publishingDestinations,
      selectedItems,
    );

    // 4. Return success response with multi-destination stats
    return new Response(
      JSON.stringify({
        success: true,
        feedUrl: url,
        feedId: feedId,
        total: processingResults.total,
        processed: processingResults.processed,
        errors: processingResults.errors,
        humanized: processingResults.humanized,
        skipped: processingResults.skipped,
        shopifyPublished: processingResults.shopifyPublished,
        wordpressPublished: processingResults.wordpressPublished,
        totalDestinations: processingResults.totalDestinations,
        destinationResults: processingResults.destinationResults,
        rss_feed_data_ids: processingResults.rss_feed_data_ids,
        selective: !!selectedItems,
        platforms: ['Shopify', 'WordPress'],
        destinationsUsed: {
          shopify: publishingDestinations.shopify.map(d => d.name),
          wordpress: publishingDestinations.wordpress.map(d => d.name),
        },
        aiProvider: 'DeepSeek'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    logger.error('RSS processing error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        aiProvider: 'DeepSeek'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}