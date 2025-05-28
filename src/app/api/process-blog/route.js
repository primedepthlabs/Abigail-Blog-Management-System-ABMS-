import { JSDOM } from 'jsdom';
import { OpenAI } from 'openai';
import { marked } from 'marked';
import supabase from '@/lib/supabaseClient';
import axios from 'axios';
import * as cheerio from 'cheerio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SHOPIFY CONFIGURATION
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN;

// WORDPRESS CONFIGURATION
const WP_URL = process.env.Administrative_URL;
const WP_USER = process.env.Admin_Username;
const WP_PASS = process.env.Admin_Password;
const WP_AUTH = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

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
      const waitTime = Math.pow(2, retries) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      retries++;
    }
  }
  throw new Error(
    `OpenAI API failed after ${maxRetries} attempts. Last error: ${lastError.message}`,
  );
}

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

// SHOPIFY FUNCTIONS
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
      logger.info(
        `Using Shopify blog: ${data.blogs[0].title} (ID: ${data.blogs[0].id})`,
      );
      return data.blogs[0].id;
    }
    throw new Error('No blogs found');
  } catch (error) {
    logger.error('Error getting blog ID:', error);
    throw error;
  }
}

// UPDATED: Shopify function with full content (no truncation)
async function createShopifyBlogPost(humanizedMarkdown, blogData = {}) {
  try {
    const blogId = await getBlogId();
    const title = extractTitle(humanizedMarkdown);
    const htmlContent = markdownToHtml(humanizedMarkdown);

    // Extract full plain text without truncation
    const plainText = humanizedMarkdown
      .replace(/^#.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

    // Use full content for excerpt instead of truncating
    const excerpt = plainText; // No truncation
    const tags = 'Single Blog, Auto-Generated';

    const articleData = {
      article: {
        title: title,
        body_html: htmlContent,
        summary: excerpt, // Full content
        tags: tags,
        published: false,
        author: blogData.author || 'Blog Bot',
        created_at: blogData.pubDate
          ? new Date(blogData.pubDate).toISOString()
          : new Date().toISOString(),
      },
    };

    // Use first image as featured image if available
    if (blogData.images && blogData.images.length > 0) {
      articleData.article.image = {
        src: blogData.images[0].url,
        alt: blogData.images[0].alt || title,
      };
    } else if (blogData.thumbnail) {
      articleData.article.image = {
        src: blogData.thumbnail,
        alt: title,
      };
    }

    logger.info(`Creating Shopify blog post: "${title}"`);

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
    logger.success(`Created Shopify blog post: ${result.article.id}`);

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
    logger.error('Failed to create Shopify blog post:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// UPDATED: WordPress function with full content (no truncation)
async function createWordPressBlogPost(humanizedMarkdown, blogData = {}) {
  try {
    const title = extractTitle(humanizedMarkdown);
    const htmlContent = markdownToHtml(humanizedMarkdown);

    logger.info(`Creating WordPress blog post: "${title}"`);

    // Extract full plain text without truncation
    const plainText = humanizedMarkdown
      .replace(/^#.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

    // Use full content for excerpt instead of truncating
    const excerpt = plainText; // No truncation

    const wpPayload = {
      title: title,
      content: htmlContent,
      status: 'publish',
      excerpt: excerpt, // Full content
      author: 1,
      categories: [1],
      tags: [],
      meta: {
        _wp_original_source: blogData.url || '',
        _wp_original_author: blogData.author || '',
        _wp_publication_date: blogData.pubDate || new Date().toISOString(),
        _wp_rss_source: 'Auto-Generated from Single Blog URL',
      },
    };

    // Set featured image if available
    if (blogData.images && blogData.images.length > 0) {
      wpPayload.featured_media_url = blogData.images[0].url;
    }

    const wpRes = await fetch(WP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${WP_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wpPayload),
    });

    const wpData = await wpRes.json();

    if (!wpRes.ok) {
      logger.error('WordPress API error:', {
        status: wpRes.status,
        statusText: wpRes.statusText,
        response: wpData,
      });

      return {
        success: false,
        error: wpData.message || `WordPress API error: ${wpRes.status}`,
      };
    }

    logger.success(`Successfully published to WordPress`, {
      wp_post_id: wpData.id,
      wp_url: wpData.link || 'N/A',
    });

    return {
      success: true,
      postId: wpData.id,
      title: wpData.title?.rendered || title,
      url: wpData.link,
      slug: wpData.slug,
    };
  } catch (error) {
    logger.error('Failed to create WordPress blog post:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Enhanced content fetching with better error handling
async function fetchBlogContent(blogUrl) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  };

  try {
    logger.info(`Attempting to fetch: ${blogUrl}`);

    const response = await axios.get(blogUrl, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      logger.error(`HTTP ${status} error for ${blogUrl}:`, error.message);

      if (status === 403) {
        throw new Error(
          `Access denied (403). The website "${
            new URL(blogUrl).hostname
          }" is blocking automated requests. Please try a different URL or contact the site owner.`,
        );
      } else if (status === 404) {
        throw new Error(
          `Page not found (404). The URL "${blogUrl}" may be incorrect or the page may have been removed.`,
        );
      } else if (status === 429) {
        throw new Error(
          `Rate limited (429). The website is temporarily blocking requests. Please try again later.`,
        );
      } else {
        throw new Error(
          `Website returned error ${status}. Please check the URL and try again.`,
        );
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(
        `Request timeout. The website "${
          new URL(blogUrl).hostname
        }" took too long to respond.`,
      );
    } else if (error.code === 'ENOTFOUND') {
      throw new Error(
        `Website not found. Please check if "${blogUrl}" is correct.`,
      );
    } else {
      throw new Error(`Network error: ${error.message}`);
    }
  }
}

// Enhanced image extraction function
function extractImages(blogUrl, $) {
  const pageImages = [];

  $('img').each((i, img) => {
    const src = $(img).attr('src');
    if (src && !src.includes('data:image')) {
      // Skip base64 images
      let imgUrl = src;

      // Convert relative URLs to absolute
      if (src.startsWith('/')) {
        const urlObj = new URL(blogUrl);
        imgUrl = `${urlObj.origin}${src}`;
      } else if (!src.startsWith('http')) {
        const urlObj = new URL(blogUrl);
        imgUrl = `${urlObj.origin}/${src}`;
      }

      // Get better alt text
      let altText = $(img).attr('alt') || '';
      if (!altText) {
        // Try to get alt text from nearby text or title
        altText =
          $(img).attr('title') ||
          $(img).closest('figure').find('figcaption').text() ||
          $(img).parent().attr('title') ||
          `Image from ${new URL(blogUrl).hostname}`;
      }

      pageImages.push({
        url: imgUrl,
        alt: altText.trim(),
        caption:
          $(img).attr('title') ||
          $(img).closest('figure').find('figcaption').text() ||
          '',
      });
    }
  });

  // Enhanced filtering to remove problematic images
  return pageImages
    .filter((img) => {
      const url = new URL(img.url);
      const filename = url.pathname.toLowerCase();
      const fullUrl = img.url.toLowerCase();

      return (
        // Filter out common unwanted images
        !filename.includes('icon') &&
        !filename.includes('logo') &&
        !filename.includes('favicon') &&
        !filename.includes('avatar') &&
        !filename.includes('badge') &&
        !filename.includes('button') &&
        !fullUrl.includes('width=16') &&
        !fullUrl.includes('height=16') &&
        !fullUrl.includes('logo-en.png') &&
        !fullUrl.includes('/logos/') &&
        !fullUrl.includes('/icons/') &&
        // Filter out tracking pixels and small images
        !fullUrl.includes('1x1') &&
        !fullUrl.includes('pixel') &&
        !fullUrl.includes('tracking')
      );
    })
    .slice(0, 10); // Keep up to 10 relevant images
}

// Enhanced content extraction function to get ALL content
async function extractFullContent(blogUrl, $) {
  let fullTextContent = '';

  // Multiple strategies to extract the complete content
  const contentSelectors = [
    'article',
    '.post-content',
    '.entry-content',
    '.content',
    '.article-content',
    '.post-body',
    '.entry-body',
    'main',
    '#content',
    '.post',
    '[itemprop="articleBody"]',
    '.blog-content',
    '.article-text',
    '.single-post-content',
    '.post-single',
    '.blog-post-content',
  ];

  // Try each selector and get the longest content
  let longestContent = '';

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      // Remove unwanted elements like ads, related posts, etc.
      element
        .find(
          'script, style, .advertisement, .ads, .related-posts, .social-share, .comments, .comment-section, nav, .navigation, .breadcrumb, .json-ld',
        )
        .remove();

      const currentContent = element.text().trim();
      if (currentContent.length > longestContent.length) {
        longestContent = currentContent;
      }
    }
  }

  // If no content found with specific selectors, try body but filter out navigation, footer, etc.
  if (!longestContent) {
    const bodyClone = $('body').clone();
    bodyClone
      .find(
        'nav, header, footer, .navigation, .menu, .sidebar, script, style, .advertisement, .ads, .related-posts, .comments, .json-ld',
      )
      .remove();
    longestContent = bodyClone.text().trim();
  }

  // Clean up the content and remove JSON-like patterns
  fullTextContent = longestContent
    .replace(/\s+/g, ' ')
    .replace(/\{[^}]*\}/g, '') // Remove JSON-like objects
    .replace(/\[[^\]]*\]/g, '') // Remove arrays
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs that got mixed in
    .replace(/\b\w+:\w+\b/g, '') // Remove key:value patterns
    .trim();

  logger.info(`Extracted ${fullTextContent.length} characters of content`);
  return fullTextContent;
}

// Function to intelligently distribute images throughout content
function distributeImagesInContent(contentText, images) {
  if (!images || images.length === 0) return contentText;

  // Split content into paragraphs
  const paragraphs = contentText
    .split('\n\n')
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 2) {
    // If very short content, just add first image at the beginning
    return `![${images[0].alt || 'Featured Image'}](${
      images[0].url
    })\n\n${contentText}`;
  }

  let result = '';
  const imageDistributionPoints = [];

  // Calculate distribution points based on content length
  if (images.length === 1) {
    imageDistributionPoints.push(Math.floor(paragraphs.length * 0.3)); // 30% through content
  } else if (images.length === 2) {
    imageDistributionPoints.push(Math.floor(paragraphs.length * 0.25)); // 25% through
    imageDistributionPoints.push(Math.floor(paragraphs.length * 0.75)); // 75% through
  } else {
    // For multiple images, distribute evenly
    const step = Math.floor(paragraphs.length / (images.length + 1));
    for (let i = 1; i <= images.length; i++) {
      imageDistributionPoints.push(Math.min(step * i, paragraphs.length - 1));
    }
  }

  let imageIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    result += paragraphs[i] + '\n\n';

    // Check if we should insert an image after this paragraph
    if (imageIndex < images.length && imageDistributionPoints.includes(i)) {
      const image = images[imageIndex];
      result += `![${image.alt || `Image ${imageIndex + 1}`}](${image.url}${
        image.caption ? ` "${image.caption}"` : ''
      })\n\n`;
      imageIndex++;
    }
  }

  // Add any remaining images at the end if not all were distributed
  while (imageIndex < images.length) {
    const image = images[imageIndex];
    result += `![${image.alt || `Image ${imageIndex + 1}`}](${image.url}${
      image.caption ? ` "${image.caption}"` : ''
    })\n\n`;
    imageIndex++;
  }

  return result.trim();
}

// Main processing function with improved image placement
async function processSingleBlog(blogUrl) {
  try {
    logger.info(`Processing single blog URL: ${blogUrl}`);

    // 1. Create a pseudo-feed entry for single blog processing
    const { data: feedData, error: feedError } = await supabase
      .from('rss_feeds')
      .insert({ feed_url: `single-blog:${blogUrl}` })
      .select('id');

    if (feedError) {
      logger.error('Error creating feed entry:', feedError);
      throw new Error('Failed to create feed entry');
    }

    const feedId = feedData[0].id;

    // 2. Insert the blog URL into rss_feed_data
    const { data: rssItemData, error: rssItemError } = await supabase
      .from('rss_feed_data')
      .insert({
        feed_id: feedId,
        blog_url: blogUrl,
      })
      .select('id');

    if (rssItemError) {
      logger.error('Error inserting into rss_feed_data:', rssItemError);
      throw new Error('Failed to insert blog URL');
    }

    const rssItemId = rssItemData[0].id;

    // 3. Enhanced content fetching to get ALL content
    let fullHtmlContent = '';
    let fullTextContent = '';
    let pageTitle = '';
    let pageMetaDescription = '';
    let articleAuthor = '';
    let articleDate = '';
    let pageImages = [];

    try {
      fullHtmlContent = await fetchBlogContent(blogUrl);
      const $ = cheerio.load(fullHtmlContent);

      // Extract basic information
      pageTitle = $('title').text().trim() || 'Blog Post';
      pageMetaDescription = $('meta[name="description"]').attr('content') || '';

      // Try to extract author
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

      // Extract FULL content using enhanced function
      fullTextContent = await extractFullContent(blogUrl, $);

      // Extract images using enhanced function
      pageImages = extractImages(blogUrl, $);

      logger.success(`Successfully extracted FULL content from ${blogUrl}`);
      logger.info(`Content length: ${fullTextContent.length} characters`);
      logger.info(`Found ${pageImages.length} images`);
    } catch (fetchError) {
      logger.error(
        `Could not fetch content from ${blogUrl}:`,
        fetchError.message,
      );

      // Use URL to create basic blog data
      pageTitle =
        new URL(blogUrl).pathname.split('/').pop()?.replace(/-/g, ' ') ||
        'Blog Post';
      fullTextContent = `Content from ${blogUrl}. Original content could not be fetched due to website restrictions.`;
      pageMetaDescription = `Blog post from ${new URL(blogUrl).hostname}`;

      logger.info('Continuing with basic metadata and AI-generated content');
    }

    // 4. Prepare blog data with FULL content
    const blogData = {
      title: pageTitle,
      description_text: fullTextContent, // Full content, no truncation
      images: pageImages,
      url: blogUrl,
      pubDate: articleDate || '',
      author: articleAuthor || '',
      source_domain: new URL(blogUrl).hostname,
    };

    // 5. Use OpenAI to enhance content with better image distribution
    const prompt = `
You are a professional blog content creator. Create a comprehensive, engaging formatted blog post based on this information:

Blog URL: ${blogUrl}
Title: ${blogData.title}
Source: ${blogData.source_domain}
Full Content: ${blogData.description_text}

${
  blogData.images.length > 0
    ? `
IMAGES AVAILABLE (${blogData.images.length} total):
${blogData.images
  .map(
    (img, index) =>
      `${index + 1}. ![${img.alt || `Image ${index + 1}`}](${img.url}${
        img.caption ? ` "${img.caption}"` : ''
      })`,
  )
  .join('\n')}

CRITICAL IMAGE PLACEMENT INSTRUCTIONS:
- Place images strategically throughout the blog post where they are most contextually relevant
- DO NOT group all images together at the end
- DO NOT create an "Additional Images" section
- Insert images between paragraphs where they naturally fit with the content being discussed
- Use images to break up long text sections and enhance readability
- Match images to the content they best illustrate (e.g., if discussing a product, place the product image there)
- Distribute images evenly throughout the post for better visual flow


`
    : ''
}

INSTRUCTIONS:
1. Create a complete, comprehensive blog post in markdown format using ALL the provided content
2. Include a compelling title that captures attention (H1 format)
3. ${
      blogData.images.length > 0
        ? 'IMPORTANT: Distribute the provided images naturally throughout the content where they fit contextually - NOT at the end of the post'
        : 'Create engaging content based on the full content provided'
    }
4. Organize with appropriate headings (H2, H3) for better readability
5. Maintain the full depth and detail of the original content
6. Include a brief conclusion that wraps up all the points discussed
${
  blogData.images.length > 0
    ? '8. Use proper markdown image syntax: ![alt text](image_url "optional title")'
    : ''
}

CONTENT STRUCTURE EXAMPLE:
# [Engaging Title]

[Opening paragraph]

![Relevant Image 1](url1)

## [Section Heading]
[Content for this section]

![Relevant Image 2](url2)

[More content]

## [Another Section]
[Content continues]

![Relevant Image 3](url3)

[Final content and conclusion]

IMPORTANT: 
- Use the ENTIRE content provided. Do not summarize or truncate.
- Place images where they make the most sense contextually within the content flow
- DO NOT create an "Additional Images" section at the end
- Images should enhance and complement the text they appear near
-Create the Blog text properly formatted in blog style

Return ONLY the complete markdown blog content with images with proper blog format, properly distributed throughout, ready to display as-is.  `;

    let enhancedBlogMarkdown = '';
    try {
      const aiRes = await callOpenAIWithRetry(
        [{ role: 'user', content: prompt }],
        16000, // Increased token limit for full content
        0.7,
      );
      enhancedBlogMarkdown = aiRes.choices[0]?.message?.content || '';
      logger.info(
        'OpenAI successfully created complete blog content with distributed images',
      );
    } catch (openAiError) {
      logger.error('OpenAI failed:', openAiError.message);

      // Improved fallback content with better image distribution
      enhancedBlogMarkdown = `# ${blogData.title}\n\n`;

      // Distribute images throughout the content instead of placing them at the end
      const contentWithImages = distributeImagesInContent(
        `This blog post is sourced from ${blogData.source_domain}.\n\n${blogData.description_text}`,
        blogData.images,
      );

      enhancedBlogMarkdown += contentWithImages;
    }

    // 6. Humanize with StealthGPT
    let humanizedBlogMarkdown = enhancedBlogMarkdown;

    try {
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
        const stealthText =
          result.text || result.output || result.rephrased_text;
        if (stealthText) {
          humanizedBlogMarkdown = stealthText;
          logger.success('StealthGPT humanization successful');
        }
      } else {
        logger.info('StealthGPT failed, using OpenAI content as-is');
      }
    } catch (err) {
      logger.error('Humanization error:', err.message);
    }

    // 7. Save to database
    const { data: humanizeData, error: humanizeError } = await supabase
      .from('Humanize_Data')
      .insert({
        humanize_Data: humanizedBlogMarkdown,
        rss_feed_data_column: rssItemId,
      })
      .select('id');

    if (humanizeError) {
      logger.error('Error inserting into Humanize_Data:', humanizeError);
      throw new Error('Failed to save humanized content');
    }

    const humanizeDataId = humanizeData[0].id;

    // 8. Dual publishing with full content
    const shopifyResult = await createShopifyBlogPost(
      humanizedBlogMarkdown,
      blogData,
    );
    const wordpressResult = await createWordPressBlogPost(
      humanizedBlogMarkdown,
      blogData,
    );

    // 9. Update database with publishing results
    const updateData = {
      shopify_article_id: shopifyResult.success
        ? shopifyResult.articleId
        : null,
      shopify_url: shopifyResult.success ? shopifyResult.url : null,
      shopify_handle: shopifyResult.success ? shopifyResult.handle : null,
      published_to_shopify: shopifyResult.success,
      shopify_created_at: shopifyResult.success
        ? new Date().toISOString()
        : null,
      shopify_error: shopifyResult.success ? null : shopifyResult.error,
      wp_post_id: wordpressResult.success ? wordpressResult.postId : null,
      wp_url: wordpressResult.success ? wordpressResult.url : null,
      wp_slug: wordpressResult.success ? wordpressResult.slug : null,
      wp_published: wordpressResult.success,
      wp_published_at: wordpressResult.success
        ? new Date().toISOString()
        : null,
      wp_error: wordpressResult.success ? null : wordpressResult.error,
    };

    await supabase
      .from('Humanize_Data')
      .update(updateData)
      .eq('id', humanizeDataId);

    logger.success(
      'Single blog processing completed - Images distributed throughout content, no "Additional Images" section created',
    );

    return {
      success: true,
      humanizeDataId,
      humanizedContent: humanizedBlogMarkdown,
      blogData,
      shopifySuccess: shopifyResult.success,
      shopifyArticleId: shopifyResult.success ? shopifyResult.articleId : null,
      shopifyUrl: shopifyResult.success ? shopifyResult.url : null,
      shopifyError: shopifyResult.success ? null : shopifyResult.error,
      wordpressSuccess: wordpressResult.success,
      wordpressPostId: wordpressResult.success ? wordpressResult.postId : null,
      wordpressUrl: wordpressResult.success ? wordpressResult.url : null,
      wordpressError: wordpressResult.success ? null : wordpressResult.error,
    };
  } catch (error) {
    logger.error('Error processing single blog:', error);
    throw error;
  }
}

// GET endpoint - Fetch stored humanized blog data
export async function GET(req) {
  try {
    logger.info('Fetching humanized blog data from database');

    const { data: humanizedBlogs, error } = await supabase
      .from('Humanize_Data')
      .select(
        `
        id,
        humanize_Data,
        created_at,
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database error',
          details: error.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Transform data to match your frontend expectations
    const transformedData = humanizedBlogs.map((item) => ({
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
    }));

    const summary = {
      total: transformedData.length,
      shopifyPublished: transformedData.filter(
        (item) => item.publishing_status.shopify.published,
      ).length,
      wordpressPublished: transformedData.filter(
        (item) => item.publishing_status.wordpress.published,
      ).length,
      dualPublished: transformedData.filter((item) => item.is_dual_published)
        .length,
      unpublished: transformedData.filter((item) => !item.is_published_anywhere)
        .length,
    };

    logger.success(
      `Successfully fetched ${transformedData.length} humanized blogs`,
    );

    return new Response(
      JSON.stringify({
        success: true,
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
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// POST endpoint - Process a single blog URL
export async function POST(req) {
  try {
    console.log('🔍 POST endpoint hit');

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📦 Request body received:', requestBody);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { url, action } = requestBody;

    console.log('🔍 Extracted values:');
    console.log('  - URL:', url);
    console.log('  - Action:', action);
    console.log('  - URL type:', typeof url);
    console.log('  - Action type:', typeof action);

    if (!url || typeof url !== 'string' || !url.trim()) {
      console.log('❌ URL validation failed');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (action !== 'humanize_and_publish') {
      console.log(
        '❌ Action validation failed. Expected: "humanize_and_publish", Got:',
        action,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid action. Expected "humanize_and_publish", got "${action}"`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.log('✅ All validations passed');

    // Validate URL format
    try {
      new URL(url);
      console.log('✅ URL format is valid');
    } catch (urlError) {
      console.log('❌ URL format validation failed:', urlError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Please enter a valid URL. Error: ${urlError.message}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    logger.info(`Processing blog request for: ${url}`);

    const result = await processSingleBlog(url);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('💥 Unexpected error in POST endpoint:', error);
    logger.error('API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Processing failed',
        stack: error.stack,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
