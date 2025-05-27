import { JSDOM } from 'jsdom';
import { OpenAI } from 'openai';
import { marked } from 'marked';
import supabase from '@/lib/supabaseClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SHOPIFY CONFIGURATION
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN;

const feedList = [];

// Function to convert markdown to HTML
function markdownToHtml(markdown) {
  try {
    console.log('original markdown:', markdown.substring(0, 500));
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });
    return marked(markdown);
  } catch (error) {
    console.error('❌ Error converting markdown to HTML:', error);
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

async function getBlogId() {
  try {
    const response = await fetch(
      `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10/blogs.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch blogs: ${response.status}`);
    }

    const data = await response.json();
    if (data.blogs && data.blogs.length > 0) {
      console.log(
        `📝 Using blog: ${data.blogs[0].title} (ID: ${data.blogs[0].id})`,
      );
      return data.blogs[0].id;
    }
    throw new Error('No blogs found');
  } catch (error) {
    console.error('❌ Error getting blog ID:', error);
    throw error;
  }
}

// Main function to create blog post in Shopify
async function createShopifyBlogPost(humanizedMarkdown, blogData = {}) {
  try {
    const blogId = await getBlogId();
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
        published: true,
        author: blogData.author || 'RSS Bot',
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

    console.log(`📝 Creating Shopify blog post: "${title}"`);
    console.log('📏 HTML content length:', htmlContent.length);
    console.log('📝 HTML content preview:', htmlContent.slice(0, 1000));

    const response = await fetch(
      `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10/blogs/${blogId}/articles.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
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
    console.log(`✅ Created Shopify blog post: ${result.article.id}`);

    return {
      success: true,
      articleId: result.article.id,
      title: result.article.title,
      handle: result.article.handle,
      url: `https://${SHOPIFY_SHOP_DOMAIN.replace(
        '.myshopify.com',
        '',
      )}/blogs/${result.article.blog_id}/${result.article.handle}`,
    };
  } catch (error) {
    console.error('❌ Failed to create Shopify blog post:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Test your Shopify connection
export async function testShopify() {
  try {
    const response = await fetch(
      `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Connection failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Connected to: ${data.shop.name}`);
    return { success: true, shopName: data.shop.name };
  } catch (error) {
    console.error('❌ Shopify test failed:', error);
    return { success: false, error: error.message };
  }
}

// ========== RSS FUNCTIONS ==========

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

      // Get feed metadata
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
          feedData.description =
            channel.querySelector('description')?.textContent || '';
          feedData.link = channel.querySelector('link')?.textContent || '';
          feedData.lastBuildDate =
            channel.querySelector('lastBuildDate')?.textContent || '';
          feedData.language =
            channel.querySelector('language')?.textContent || '';
        }

        // Parse items
        feedData.items = Array.from(doc.querySelectorAll('item')).map(
          (item) => {
            // Get all potential child elements
            const children = Array.from(item.children);
            const itemData = {};

            // Extract standard RSS fields
            itemData.title = item.querySelector('title')?.textContent || '';
            itemData.link = item.querySelector('link')?.textContent || '';
            itemData.pubDate = item.querySelector('pubDate')?.textContent || '';
            itemData.description =
              item.querySelector('description')?.textContent || '';
            itemData.guid = item.querySelector('guid')?.textContent || '';
            itemData.categories = Array.from(
              item.querySelectorAll('category'),
            ).map((cat) => cat.textContent);

            // Handle content with namespace
            const contentEncoded =
              item.querySelector('content\\:encoded') ||
              item.getElementsByTagNameNS('*', 'encoded')[0];

            if (contentEncoded) {
              itemData.content = contentEncoded.textContent || '';
            }

            // Get all remaining elements as custom fields
            children.forEach((child) => {
              const nodeName = child.nodeName.toLowerCase();
              // Skip nodes we've already processed
              if (
                ![
                  'title',
                  'link',
                  'pubdate',
                  'description',
                  'guid',
                  'category',
                ].includes(nodeName)
              ) {
                // Handle namespaced elements
                if (nodeName.includes(':')) {
                  const [namespace, name] = nodeName.split(':');
                  if (!itemData[namespace]) itemData[namespace] = {};
                  itemData[namespace][name] = child.textContent;
                } else {
                  // Only add if not already processed
                  if (!itemData[nodeName]) {
                    itemData[nodeName] = child.textContent;
                  }
                }
              }
            });

            return itemData;
          },
        );
      } else if (feedType === 'atom') {
        // Atom feed handling
        feedData.title = doc.querySelector('feed > title')?.textContent || '';
        feedData.description =
          doc.querySelector('feed > subtitle')?.textContent || '';
        feedData.link =
          doc
            .querySelector('feed > link[rel="alternate"]')
            ?.getAttribute('href') ||
          doc.querySelector('feed > link')?.getAttribute('href') ||
          '';
        feedData.lastBuildDate =
          doc.querySelector('feed > updated')?.textContent || '';

        // Parse entries
        feedData.items = Array.from(doc.querySelectorAll('entry')).map(
          (entry) => {
            const itemData = {};

            itemData.title = entry.querySelector('title')?.textContent || '';
            itemData.link =
              entry
                .querySelector('link[rel="alternate"]')
                ?.getAttribute('href') ||
              entry.querySelector('link')?.getAttribute('href') ||
              '';
            itemData.pubDate =
              entry.querySelector('published')?.textContent ||
              entry.querySelector('updated')?.textContent ||
              '';
            itemData.description =
              entry.querySelector('summary')?.textContent || '';
            itemData.content =
              entry.querySelector('content')?.textContent || '';
            itemData.id = entry.querySelector('id')?.textContent || '';
            itemData.authors = Array.from(entry.querySelectorAll('author')).map(
              (author) => {
                return {
                  name: author.querySelector('name')?.textContent || '',
                  email: author.querySelector('email')?.textContent || '',
                };
              },
            );

            return itemData;
          },
        );
      } else if (feedType === 'rdf') {
        // RDF feed handling
        feedData.title =
          doc.querySelector('channel > title')?.textContent || '';
        feedData.description =
          doc.querySelector('channel > description')?.textContent || '';
        feedData.link = doc.querySelector('channel > link')?.textContent || '';

        // Parse items
        feedData.items = Array.from(doc.querySelectorAll('item')).map(
          (item) => {
            const itemData = {};

            itemData.title = item.querySelector('title')?.textContent || '';
            itemData.link = item.querySelector('link')?.textContent || '';
            itemData.description =
              item.querySelector('description')?.textContent || '';

            // Handle Dublin Core metadata if present
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
          },
        );
      }

      // Return complete feed data
      return new Response(JSON.stringify(feedData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('RSS fetch error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Otherwise return list of feed URLs
  return new Response(JSON.stringify({ feeds: feedList }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Extract multiple image URLs from HTML content
function extractImagesFromHTML(html) {
  if (!html) return [];

  const images = [];

  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Try finding all img tags
    const imgTags = doc.querySelectorAll('img');
    if (imgTags && imgTags.length) {
      imgTags.forEach((img) => {
        if (img.src && isValidImageUrl(img.src)) {
          images.push({
            url: img.src,
            alt: img.alt || '',
            width: img.width || 0,
            height: img.height || 0,
            area: img.width && img.height ? img.width * img.height : 0,
            position: 'body',
          });
        }
      });
    }

    // Try finding media:content tags
    const mediaContents =
      doc.querySelectorAll('media\\:content') ||
      doc.getElementsByTagNameNS('*', 'content');
    if (mediaContents && mediaContents.length) {
      mediaContents.forEach((media) => {
        const url = media.getAttribute('url');
        if (url && isValidImageUrl(url)) {
          images.push({
            url: url,
            width: parseInt(media.getAttribute('width') || '0', 10),
            height: parseInt(media.getAttribute('height') || '0', 10),
            area:
              parseInt(media.getAttribute('width') || '0', 10) *
              parseInt(media.getAttribute('height') || '0', 10),
            position: 'media',
          });
        }
      });
    }

    // Check for Open Graph and Twitter card images (usually high quality)
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content && isValidImageUrl(ogImage.content)) {
      images.push({
        url: ogImage.content,
        position: 'meta-og',
        priority: 10, // Higher priority
      });
    }

    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (
      twitterImage &&
      twitterImage.content &&
      isValidImageUrl(twitterImage.content)
    ) {
      images.push({
        url: twitterImage.content,
        position: 'meta-twitter',
        priority: 9, // Higher priority
      });
    }
  } catch (e) {
    console.error('Error extracting images from HTML:', e);
  }

  // Sort images by priority and size (larger images are usually more important)
  return images.sort((a, b) => {
    // First by priority if available
    if ((a.priority || 0) !== (b.priority || 0)) {
      return (b.priority || 0) - (a.priority || 0);
    }
    // Then by area if available
    return (b.area || 0) - (a.area || 0);
  });
}

// Check if a URL is likely to be a valid image
function isValidImageUrl(url) {
  if (!url) return false;

  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase();

  // Skip data URLs (usually tiny or low-quality images)
  if (lowerUrl.startsWith('data:')) return false;

  // Check for image extensions
  return (
    imageExtensions.some((ext) => lowerUrl.endsWith(ext)) ||
    lowerUrl.includes('/image/') ||
    lowerUrl.includes('/images/')
  );
}

// Helper to extract the cleanest text from HTML
function extractTextFromHTML(html) {
  if (!html) return '';

  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    return doc.body.textContent || '';
  } catch (e) {
    // If parsing fails, try a simple regex approach
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

const axios = require('axios');
const cheerio = require('cheerio');

// Helper function for OpenAI API with retry logic
async function callOpenAIWithRetry(
  messages,
  maxTokens = 10000,
  temperature = 0.7,
  maxRetries = 3,
) {
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
      console.log(
        `⚠️ OpenAI API error (attempt ${retries + 1}/${maxRetries}): ${
          error.message
        }`,
      );

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      retries++;
    }
  }

  // If we got here, all retries failed
  throw new Error(
    `OpenAI API failed after ${maxRetries} attempts. Last error: ${lastError.message}`,
  );
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
    // Return empty string if parsing fails
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
          caption: title,
        });
      }

      // Also check for srcset
      const srcset = $(img).attr('srcset');
      if (srcset) {
        const srcsetParts = srcset.split(',');
        for (const part of srcsetParts) {
          const [url, _] = part.trim().split(' ');
          if (url && !images.some((img) => img.url === url)) {
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
              caption: title,
            });
          }
        }
      }
    });

    return images;
  } catch (error) {
    console.error('Error extracting images from HTML:', error.message);
    // Return empty array if parsing fails
    return [];
  }
}

// UPDATED processItem function with selective processing support
async function processItem(
  item,
  index,
  totalItems,
  feedId,
  shouldHumanize = true,
) {
  try {
    // Skip items without a link
    if (!item.link) {
      console.log(`⚠️ Skipping item ${index} - no link available`);
      return { status: 'error', error: 'No link available' };
    }

    console.log(
      `📝 Processing item ${index + 1}/${totalItems}: ${item.title?.substring(
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
      console.error(`❌ Error inserting into rss_feed_data:`, rssItemError);
      return { status: 'error', error: rssItemError };
    }

    const rssItemId = rssItemData[0].id;

    // If no humanization needed, just return basic processing
    if (!shouldHumanize) {
      console.log(`⏭️ Skipping humanization for item ${index + 1}`);
      return {
        status: 'success',
        rssItemId,
        shopifySuccess: false,
        shopifyArticleId: null,
        humanized: false,
      };
    }

    // 2. Fetch full HTML content from the blog URL
    console.log(`🌐 Fetching full HTML from: ${item.link}`);
    let fullHtmlContent = '';
    let fullTextContent = '';
    let fullMarkdownContent = ''; // Will be filled with our custom HTML to Markdown conversion
    let pageTitle = '';
    let pageMetaDescription = '';
    let pageImages = [];
    let articleDate = item.pubDate || '';
    let articleHTML = ''; // Store the HTML of the main article content
    let articleAuthor = ''; // Store the author if available

    try {
      const response = await axios.get(item.link, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 15000, // 15 second timeout
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
        '[itemprop="author"]',
      ];

      for (const selector of authorSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          // For meta tags
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
        // Look for common date elements
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
            // For meta tags
            if (selector.startsWith('meta')) {
              articleDate = element.attr('content');
              break;
            }
            // For time tags
            else if (selector === 'time') {
              articleDate = element.attr('datetime') || element.text().trim();
              break;
            }
            // For other elements
            else {
              articleDate = element.text().trim();
              break;
            }
          }
        }
      }

      // Extract main content
      // This part is tricky as websites have different structures
      // We'll try some common content containers
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
          // Get the HTML content of the element
          articleHTML = element.html();
          // Get text content
          fullTextContent = element.text().trim();
          break;
        }
      }

      // If no content found with selectors, get body text as fallback
      if (!fullTextContent) {
        fullTextContent = $('body').text().trim();
        articleHTML = $('body').html();
      }

      // Clean up the text (remove excessive whitespace)
      fullTextContent = fullTextContent.replace(/\s+/g, ' ').trim();

      // Extract all images from the entire page
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        const srcset = $(img).attr('srcset');
        const alt = $(img).attr('alt') || '';
        const width = parseInt($(img).attr('width') || '0', 10);
        const height = parseInt($(img).attr('height') || '0', 10);
        const caption =
          $(img).attr('title') || $(img).next('figcaption').text().trim() || '';

        if (src) {
          // Convert relative URLs to absolute
          let imgUrl = src;
          if (src.startsWith('/')) {
            const urlObj = new URL(item.link);
            imgUrl = `${urlObj.origin}${src}`;
          } else if (!src.startsWith('http')) {
            const urlObj = new URL(item.link);
            imgUrl = `${urlObj.origin}/${src}`;
          }

          // Determine priority: higher for images in main content
          let priority = 1;
          if (
            mainContentElement &&
            $(mainContentElement).find(img).length > 0
          ) {
            priority = 3; // Higher priority for images in main content
          } else if (
            $(img).parents('article, .content, .post-content, .entry-content')
              .length > 0
          ) {
            priority = 2; // Medium priority for images in article-like elements
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

        // Handle srcset if present
        if (srcset) {
          const srcsetParts = srcset.split(',');
          for (const part of srcsetParts) {
            const [url, _] = part.trim().split(' ');
            if (url && !pageImages.some((img) => img.url === url)) {
              // Convert relative URLs to absolute
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
                caption,
              });
            }
          }
        }
      });

      // Check for Open Graph images which are often high quality
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        // Convert relative URLs to absolute
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
          priority: 4, // Highest priority for OG images
          caption: pageTitle,
        });
      }

      // Twitter card image
      const twitterImage = $('meta[name="twitter:image"]').attr('content');
      if (twitterImage && twitterImage !== ogImage) {
        // Convert relative URLs to absolute
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
          priority: 3.5, // High priority but below OG
          caption: pageTitle,
        });
      }

      // Convert HTML content to Markdown - Simple custom implementation
      if (articleHTML) {
        // Basic HTML to Markdown conversion using cheerio
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

        // Process images - convert to markdown format
        $article('img').each((_, el) => {
          const src = $article(el).attr('src') || '';
          const alt = $article(el).attr('alt') || '';
          const title = $article(el).attr('title') || '';

          // Absolute URL conversion
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
            $article(el).replaceWith(`1. ${text}\n`); // Using '1.' for all items; Markdown will handle proper numbering
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
          // Only if not inside a pre
          if (!$article(el).parents('pre').length) {
            $article(el).replaceWith(`\`${text}\``);
          }
        });

        // Process horizontal rules
        $article('hr').each((_, el) => {
          $article(el).replaceWith('\n\n---\n\n');
        });

        // Get the processed content and clean it up
        markdown = $article
          .text()
          .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
          .trim();

        fullMarkdownContent = markdown;
      }

      console.log(`✅ Successfully fetched and parsed HTML from ${item.link}`);
    } catch (fetchError) {
      console.error(
        `⚠️ Error fetching HTML from ${item.link}:`,
        fetchError.message,
      );
      // Continue with RSS data if HTML fetch fails
    }

    // 3. Prepare item data for OpenAI extraction
    const description = item.description || '';
    const content = item.content || '';

    // Extract text and find images from RSS feed using custom functions
    const descriptionText = customExtractTextFromHTML(description);
    const contentText = customExtractTextFromHTML(content);

    // Get all potential images from RSS feed using custom function
    const descriptionImages = customExtractImagesFromHTML(
      description,
      item.link,
    );
    const contentImages = customExtractImagesFromHTML(content, item.link);

    // Combine images from all sources (RSS feed and fetched HTML)
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
      ...pageImages, // Add the images from the fetched HTML
    ];

    // Remove duplicates by URL
    const uniqueImagesMap = new Map();
    allImages.forEach((img) => {
      // If this URL doesn't exist yet or the current image has higher priority/area
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

    // Prioritize images by position and area
    uniqueImages.sort((a, b) => {
      // First by priority (higher first)
      if ((b.priority || 0) !== (a.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0);
      }
      // Then by area (larger first)
      return (b.area || 0) - (a.area || 0);
    });

    // Get top 5 images
    const topImages = uniqueImages.slice(0, 5);

    // Categories from RSS item
    const categories = item.categories || [];

    // Prepare complete blog data with all available information
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
      markdown_content: fullMarkdownContent || '', // Include the markdown content
      source_domain: new URL(item.link).hostname,
    };

    // Convert blogData to JSON string for OpenAI prompt
    const rawItemJSON = JSON.stringify(blogData);

    // ENHANCED PROMPT: Improved to handle both text and images better
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

    // 4. Use OpenAI to extract and enhance data with retry logic
    let enhancedBlogMarkdown = '';
    try {
      const aiRes = await callOpenAIWithRetry(
        [{ role: 'user', content: prompt }],
        10000,
        0.7,
      );
      enhancedBlogMarkdown = aiRes.choices[0]?.message?.content || '';
      console.log(
        `🤖 OpenAI blog creation: ${enhancedBlogMarkdown.substring(0, 100)}...`,
      );
    } catch (openAiError) {
      console.error(
        `❌ Failed to create blog with OpenAI:`,
        openAiError.message,
      );

      // If OpenAI fails, create a basic markdown blog from available data
      enhancedBlogMarkdown = `# ${blogData.title}\n\n`;

      if (blogData.pubDate) {
        enhancedBlogMarkdown += `*Published on: ${blogData.pubDate}*\n\n`;
      }

      if (blogData.author) {
        enhancedBlogMarkdown += `*By: ${blogData.author}*\n\n`;
      }

      // Add first image if available
      if (blogData.images && blogData.images.length > 0) {
        const firstImage = blogData.images[0];
        enhancedBlogMarkdown += `![${firstImage.alt || 'Image'}](${
          firstImage.url
        })\n\n`;
      }

      // Add description/content
      enhancedBlogMarkdown += `${blogData.description_text.substring(
        0,
        1000,
      )}...\n\n`;

      // Add link to original
      enhancedBlogMarkdown += `[Read the full article](${blogData.url})\n\n`;

      // Add categories if available
      if (blogData.categories && blogData.categories.length > 0) {
        enhancedBlogMarkdown += `**Categories:** ${blogData.categories.join(
          ', ',
        )}\n\n`;
      }
    }

    // 5. Humanize the generated blog with StealthGPT or OpenAI fallback
    let humanizedBlogMarkdown = enhancedBlogMarkdown;

    try {
      // First try with StealthGPT
      console.log(`🔄 Trying StealthGPT for item ${index + 1}`);

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

      // If StealthGPT succeeds, use its result
      if (res.ok) {
        const result = await res.json();
        const stealthText =
          result.text || result.output || result.rephrased_text;

        if (stealthText) {
          console.log(`✅ StealthGPT succeeded for item ${index + 1}`);
          humanizedBlogMarkdown = stealthText;
        }
      } else {
        // If StealthGPT fails, use OpenAI as fallback with retry logic
        console.log(
          `⚠️ StealthGPT failed, falling back to OpenAI for item ${index + 1}`,
        );

        const fallbackPrompt = `
Improve this blog post markdown to make it more engaging, conversational, and human-sounding while keeping the same structure and information:

${enhancedBlogMarkdown}

Only return the improved markdown, nothing else. Maintain all headings, images, and formatting.`;

        try {
          const fallbackRes = await callOpenAIWithRetry(
            [{ role: 'user', content: fallbackPrompt }],
            10000,
            0.7,
          );
          humanizedBlogMarkdown =
            fallbackRes.choices[0]?.message?.content || enhancedBlogMarkdown;
          console.log(`✅ OpenAI fallback succeeded for item ${index + 1}`);
        } catch (fallbackError) {
          console.error(`❌ OpenAI fallback failed: ${fallbackError.message}`);
          // Keep original enhanced blog markdown
        }
      }
    } catch (err) {
      console.error(
        `❌ Humanization error for item ${index + 1}:`,
        err.message,
      );
      // Keep the original enhanced blog markdown if humanization fails
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
      console.error(`❌ Error inserting into Humanize_Data:`, humanizeError);
      return { status: 'error', error: humanizeError, rssItemId };
    }

    const humanizeDataId = humanizeData[0].id;

    // 7. NEW: Push to Shopify
    console.log(`🛍️ Pushing to Shopify: ${index + 1}/${totalItems}`);
    const shopifyResult = await createShopifyBlogPost(
      humanizedBlogMarkdown,
      blogData,
    );

    if (shopifyResult.success) {
      // Update database with Shopify info
      await supabase
        .from('Humanize_Data')
        .update({
          shopify_article_id: shopifyResult.articleId,
          shopify_url: shopifyResult.url,
          shopify_handle: shopifyResult.handle,
          published_to_shopify: true,
          shopify_created_at: new Date().toISOString(),
        })
        .eq('id', humanizeDataId);

      console.log(
        `✅ Successfully pushed to Shopify: ${shopifyResult.articleId}`,
      );
    } else {
      // Log error but continue processing
      await supabase
        .from('Humanize_Data')
        .update({
          published_to_shopify: false,
          shopify_error: shopifyResult.error,
        })
        .eq('id', humanizeDataId);

      console.error(`❌ Shopify push failed: ${shopifyResult.error}`);
    }

    console.log(`✅ Successfully processed item ${index + 1}`);
    return {
      status: 'success',
      rssItemId,
      shopifySuccess: shopifyResult.success,
      shopifyArticleId: shopifyResult.success ? shopifyResult.articleId : null,
      humanized: true,
    };
  } catch (itemError) {
    console.error(`❌ Error processing item ${index}:`, itemError);
    return { status: 'error', error: itemError };
  }
}

// UPDATED Process and humanize feed content with selective processing
async function processFeedContent(feedData, feedId, selectedIndices = null) {
  const results = {
    total: feedData.items.length,
    processed: 0,
    errors: 0,
    shopifyPosts: 0,
    shopifyErrors: 0,
    humanized: 0,
    skipped: 0,
    rss_feed_data_ids: [],
  };

  console.log(
    `🔍 Processing ${feedData.items.length} items from feed${
      selectedIndices
        ? ` (${selectedIndices.length} selected for humanization)`
        : ' (all humanized)'
    }`,
  );

  // Create an array of promises for each item
  const processingPromises = feedData.items.map((item, index) => {
    // Determine if this item should be humanized
    const shouldHumanize = selectedIndices
      ? selectedIndices.includes(index)
      : true;
    return processItem(
      item,
      index,
      feedData.items.length,
      feedId,
      shouldHumanize,
    );
  });

  // Execute all promises in parallel and wait for all to complete
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

      if (result.shopifySuccess) {
        results.shopifyPosts++;
      } else if (result.humanized) {
        // Only count as error if it was supposed to be humanized
        results.shopifyErrors++;
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

// UPDATED POST function with selective processing support
export async function POST(req) {
  try {
    const { url, selectedItems, feedData } = await req.json();

    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new Error('Invalid or missing URL');
    }

    console.log(`🌐 Processing RSS feed: ${url}`);
    if (selectedItems) {
      console.log(
        `🎯 Selected items for humanization: ${selectedItems.length}`,
      );
    }

    // 1. Check if feed already exists in the database
    const { data: existingFeeds, error: feedCheckError } = await supabase
      .from('rss_feeds')
      .select('id')
      .eq('feed_url', url)
      .limit(1);

    if (feedCheckError) {
      console.error('❌ Error checking for existing feed:', feedCheckError);
      throw new Error('Database error when checking for existing feed');
    }

    let feedId;

    if (existingFeeds && existingFeeds.length > 0) {
      // Feed already exists, use its ID
      feedId = existingFeeds[0].id;
      console.log(`📋 Feed already exists with ID: ${feedId}`);
    } else {
      // Insert new feed
      const { data: newFeed, error: insertFeedError } = await supabase
        .from('rss_feeds')
        .insert({ feed_url: url })
        .select('id');

      if (insertFeedError || !newFeed) {
        console.error('❌ Error inserting feed URL:', insertFeedError);
        throw new Error('Failed to insert feed URL into database');
      }

      feedId = newFeed[0].id;
      console.log(`📝 Created new feed with ID: ${feedId}`);
    }

    // 2. Use provided feedData if available, otherwise fetch and parse
    let processedFeedData;

    if (feedData && selectedItems) {
      // Use the pre-filtered feed data from UI
      processedFeedData = feedData;
      console.log(
        `🎯 Using pre-filtered feed data with ${feedData.items.length} items`,
      );
    } else {
      // Fetch and parse the RSS feed (original behavior)
      console.log(`🌐 Fetching fresh RSS feed data`);

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
      processedFeedData = {
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
          processedFeedData.title =
            channel.querySelector('title')?.textContent || '';
          processedFeedData.description =
            channel.querySelector('description')?.textContent || '';
          processedFeedData.link =
            channel.querySelector('link')?.textContent || '';
          processedFeedData.lastBuildDate =
            channel.querySelector('lastBuildDate')?.textContent || '';
          processedFeedData.language =
            channel.querySelector('language')?.textContent || '';
        }

        // Parse items
        processedFeedData.items = Array.from(doc.querySelectorAll('item')).map(
          (item) => {
            const children = Array.from(item.children);
            const itemData = {};

            // Extract standard RSS fields
            itemData.title = item.querySelector('title')?.textContent || '';
            itemData.link = item.querySelector('link')?.textContent || '';
            itemData.pubDate = item.querySelector('pubDate')?.textContent || '';
            itemData.description =
              item.querySelector('description')?.textContent || '';
            itemData.guid = item.querySelector('guid')?.textContent || '';
            itemData.categories = Array.from(
              item.querySelectorAll('category'),
            ).map((cat) => cat.textContent);

            // Handle content with namespace
            const contentEncoded =
              item.querySelector('content\\:encoded') ||
              item.getElementsByTagNameNS('*', 'encoded')[0];

            if (contentEncoded) {
              itemData.content = contentEncoded.textContent || '';
            }

            // Handle media
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

            // Get all remaining elements as custom fields
            children.forEach((child) => {
              const nodeName = child.nodeName.toLowerCase();
              if (
                ![
                  'title',
                  'link',
                  'pubdate',
                  'description',
                  'guid',
                  'category',
                  'content:encoded',
                ].includes(nodeName)
              ) {
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
          },
        );
      } else if (feedType === 'atom') {
        // Atom feed handling
        processedFeedData.title =
          doc.querySelector('feed > title')?.textContent || '';
        processedFeedData.description =
          doc.querySelector('feed > subtitle')?.textContent || '';
        processedFeedData.link =
          doc
            .querySelector('feed > link[rel="alternate"]')
            ?.getAttribute('href') ||
          doc.querySelector('feed > link')?.getAttribute('href') ||
          '';
        processedFeedData.lastBuildDate =
          doc.querySelector('feed > updated')?.textContent || '';

        // Parse entries
        processedFeedData.items = Array.from(doc.querySelectorAll('entry')).map(
          (entry) => {
            const itemData = {};

            itemData.title = entry.querySelector('title')?.textContent || '';
            itemData.link =
              entry
                .querySelector('link[rel="alternate"]')
                ?.getAttribute('href') ||
              entry.querySelector('link')?.getAttribute('href') ||
              '';
            itemData.pubDate =
              entry.querySelector('published')?.textContent ||
              entry.querySelector('updated')?.textContent ||
              '';
            itemData.description =
              entry.querySelector('summary')?.textContent || '';
            itemData.content =
              entry.querySelector('content')?.textContent || '';
            itemData.id = entry.querySelector('id')?.textContent || '';

            return itemData;
          },
        );
      } else if (feedType === 'rdf') {
        // RDF feed handling
        processedFeedData.title =
          doc.querySelector('channel > title')?.textContent || '';
        processedFeedData.description =
          doc.querySelector('channel > description')?.textContent || '';
        processedFeedData.link =
          doc.querySelector('channel > link')?.textContent || '';

        // Parse items
        processedFeedData.items = Array.from(doc.querySelectorAll('item')).map(
          (item) => {
            const itemData = {};

            itemData.title = item.querySelector('title')?.textContent || '';
            itemData.link = item.querySelector('link')?.textContent || '';
            itemData.description =
              item.querySelector('description')?.textContent || '';

            // Handle Dublin Core metadata if present
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
          },
        );
      }
    }

    console.log(
      `🔍 Feed parsed. Found ${processedFeedData.items.length} items`,
    );

    // 3. Process the feed content with selective humanization
    const processingResults = await processFeedContent(
      processedFeedData,
      feedId,
      selectedItems,
    );

    // 4. Return success response with detailed stats
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
        shopifyPosts: processingResults.shopifyPosts,
        shopifyErrors: processingResults.shopifyErrors,
        rss_feed_data_ids: processingResults.rss_feed_data_ids,
        selective: !!selectedItems,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('🔥 RSS processing error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
