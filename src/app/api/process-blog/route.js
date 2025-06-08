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
      console.log(
        `⚠️ DeepSeek API error (attempt ${retries + 1}/${maxRetries}): ${error.message}`,
      );
      const waitTime = Math.pow(2, retries) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      retries++;
    }
  }
  throw new Error(
    `DeepSeek API failed after ${maxRetries} attempts. Last error: ${lastError.message}`,
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

    // Extract full plain text without truncation
    const plainText = humanizedMarkdown
      .replace(/^#.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

    const excerpt = plainText; // No truncation
    const tags = `Single Blog, Auto-Generated, ${shopifyConfig.name}`;

    const articleData = {
      article: {
        title: title,
        body_html: htmlContent,
        summary: excerpt,
        tags: tags,
        published: false,
        author: shopifyConfig.defaultAuthor || blogData.author || 'Blog Bot',
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

// WORDPRESS FUNCTIONS - Dynamic configuration with categories support
async function createWordPressBlogPost(humanizedMarkdown, blogData = {}, wpConfig, selectedCategories = []) {
  try {
    const title = extractTitle(humanizedMarkdown);
    const htmlContent = markdownToHtml(humanizedMarkdown);

    logger.info(`Creating WordPress blog post on ${wpConfig.name}: "${title}"`);

    // Extract full plain text without truncation
    const plainText = humanizedMarkdown
      .replace(/^#.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();

    const excerpt = plainText; // No truncation

    const wpAuth = Buffer.from(`${wpConfig.username}:${wpConfig.password}`).toString('base64');

    // Determine categories to use
    let categoriesToUse = [];

    // Priority order:
    // 1. Selected categories from frontend
    // 2. Default category from wpConfig
    // 3. Category ID 1 (Uncategorized)
    if (selectedCategories && selectedCategories.length > 0) {
      categoriesToUse = selectedCategories;
      logger.info(`Using selected categories for ${wpConfig.name}:`, selectedCategories);
    } else if (wpConfig.defaultCategory) {
      categoriesToUse = [wpConfig.defaultCategory];
      logger.info(`Using default category for ${wpConfig.name}:`, [wpConfig.defaultCategory]);
    } else {
      categoriesToUse = [1]; // Default to "Uncategorized"
      logger.info(`Using fallback category for ${wpConfig.name}:`, [1]);
    }

    const wpPayload = {
      title: title,
      content: htmlContent.replaceAll(title, ''),
      status: wpConfig.defaultStatus || 'publish',
      excerpt: excerpt,
      author: 1,
      categories: categoriesToUse,
      tags: wpConfig.tags || [],
      meta: {
        _wp_original_source: blogData.url || '',
        _wp_original_author: blogData.author || '',
        _wp_publication_date: blogData.pubDate || new Date().toISOString(),
        _wp_rss_source: 'Auto-Generated from Single Blog URL',
        _wp_destination: wpConfig.name,
        _wp_selected_categories: selectedCategories, // Store selected categories for reference
      },
    };

    // Set featured image if available
    if (blogData.images && blogData.images.length > 0) {
      wpPayload.featured_media_url = blogData.images[0].url;
    }

    logger.info(`WordPress payload created for ${wpConfig.name}`, {
      title: wpPayload.title,
      contentLength: wpPayload.content?.length || 0,
      status: wpPayload.status,
      categories: categoriesToUse,
      categoriesCount: categoriesToUse.length,
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
        categories: categoriesToUse,
      });

      return {
        success: false,
        platform: 'wordpress',
        destination: wpConfig.name,
        destinationId: wpConfig.id,
        error: wpData.message || `WordPress API error: ${wpRes.status}`,
        publishedAt: new Date().toISOString(),
        categoriesUsed: categoriesToUse,
      };
    }

    logger.success(`Successfully published to WordPress ${wpConfig.name}`, {
      wp_post_id: wpData.id,
      wp_url: wpData.link || 'N/A',
      categories: categoriesToUse,
      categoriesAssigned: wpData.categories || [],
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
      categoriesUsed: categoriesToUse,
      categoriesAssigned: wpData.categories || [],
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
      categoriesUsed: selectedCategories || [],
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
          `Access denied (403). The website "${new URL(blogUrl).hostname}" is blocking automated requests. Please try a different URL or contact the site owner.`,
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
        `Request timeout. The website "${new URL(blogUrl).hostname}" took too long to respond.`,
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
        !fullUrl.includes('1x1') &&
        !fullUrl.includes('pixel') &&
        !fullUrl.includes('tracking')
      );
    })
    .slice(0, 10);
}

// Enhanced content extraction function to get ALL content
async function extractFullContent(blogUrl, $) {
  let fullTextContent = '';

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

  let longestContent = '';

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
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

  if (!longestContent) {
    const bodyClone = $('body').clone();
    bodyClone
      .find(
        'nav, header, footer, .navigation, .menu, .sidebar, script, style, .advertisement, .ads, .related-posts, .comments, .json-ld',
      )
      .remove();
    longestContent = bodyClone.text().trim();
  }

  fullTextContent = longestContent
    .replace(/\s+/g, ' ')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\b\w+:\w+\b/g, '')
    .trim();

  logger.info(`Extracted ${fullTextContent.length} characters of content`);
  return fullTextContent;
}

// Function to intelligently distribute images throughout content
function distributeImagesInContent(contentText, images) {
  if (!images || images.length === 0) return contentText;

  const paragraphs = contentText
    .split('\n\n')
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 2) {
    return `![${images[0].alt || 'Featured Image'}](${images[0].url})\n\n${contentText}`;
  }

  let result = '';
  const imageDistributionPoints = [];

  if (images.length === 1) {
    imageDistributionPoints.push(Math.floor(paragraphs.length * 0.3));
  } else if (images.length === 2) {
    imageDistributionPoints.push(Math.floor(paragraphs.length * 0.25));
    imageDistributionPoints.push(Math.floor(paragraphs.length * 0.75));
  } else {
    const step = Math.floor(paragraphs.length / (images.length + 1));
    for (let i = 1; i <= images.length; i++) {
      imageDistributionPoints.push(Math.min(step * i, paragraphs.length - 1));
    }
  }

  let imageIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    result += paragraphs[i] + '\n\n';

    if (imageIndex < images.length && imageDistributionPoints.includes(i)) {
      const image = images[imageIndex];
      result += `![${image.alt || `Image ${imageIndex + 1}`}](${image.url}${image.caption ? ` "${image.caption}"` : ''
        })\n\n`;
      imageIndex++;
    }
  }

  while (imageIndex < images.length) {
    const image = images[imageIndex];
    result += `![${image.alt || `Image ${imageIndex + 1}`}](${image.url}${image.caption ? ` "${image.caption}"` : ''
      })\n\n`;
    imageIndex++;
  }

  return result.trim();
}

// UPDATED Main processing function with multi-destination publishing and categories support
async function processSingleBlog(blogUrl, publishingDestinations, wordpressCategories = {}) {
  try {
    logger.info(`Processing single blog URL with DeepSeek: ${blogUrl}`);
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

      fullTextContent = await extractFullContent(blogUrl, $);
      pageImages = extractImages(blogUrl, $);

      logger.success(`Successfully extracted FULL content from ${blogUrl}`);
      logger.info(`Content length: ${fullTextContent.length} characters`);
      logger.info(`Found ${pageImages.length} images`);
    } catch (fetchError) {
      logger.error(`Could not fetch content from ${blogUrl}:`, fetchError.message);

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
      description_text: fullTextContent,
      images: pageImages,
      url: blogUrl,
      pubDate: articleDate || '',
      author: articleAuthor || '',
      source_domain: new URL(blogUrl).hostname,
    };

    // 5. Use DeepSeek to enhance content with better image distribution
    const prompt = `
You are a professional blog content creator. Create a comprehensive, engaging formatted blog post based on this information:

Blog URL: ${blogUrl}
Title: ${blogData.title}
Source: ${blogData.source_domain}
Full Content: ${blogData.description_text}

${blogData.images.length > 0
        ? `
IMAGES AVAILABLE (${blogData.images.length} total):
${blogData.images
          .map(
            (img, index) =>
              `${index + 1}. ![${img.alt || `Image ${index + 1}`}](${img.url}${img.caption ? ` "${img.caption}"` : ''
              })`,
          )
          .join('\n')}

CRITICAL IMAGE PLACEMENT INSTRUCTIONS:
- Place images strategically throughout the blog post where they are most contextually relevant
- DO NOT group all images together at the end
- DO NOT create an "Additional Images" section
- Insert images between paragraphs where they naturally fit with the content being discussed
- Use images to break up long text sections and enhance readability
- Match images to the content they best illustrate
- Distribute images evenly throughout the post for better visual flow
`
        : ''
      }

INSTRUCTIONS:
1. Create a complete, comprehensive blog post in markdown format using ALL the provided content
2. Include a compelling title that captures attention (H1 format)
3. ${blogData.images.length > 0
        ? 'IMPORTANT: Distribute the provided images naturally throughout the content where they fit contextually - NOT at the end of the post'
        : 'Create engaging content based on the full content provided'
      }
4. Organize with appropriate headings (H2, H3) for better readability
5. Maintain the full depth and detail of the original content
6. Include a brief conclusion that wraps up all the points discussed
${blogData.images.length > 0
        ? '8. Use proper markdown image syntax: ![alt text](image_url "optional title")'
        : ''
      }
ADD Humanization so that the text looks it is written by a human and not AI generated

IMPORTANT: 
- Use the ENTIRE content provided. Do not summarize or truncate.
- Place images where they make the most sense contextually within the content flow
- DO NOT create an "Additional Images" section at the end
- Images should enhance and complement the text they appear near
- Create the Blog text properly formatted in blog style with proper PARAGRAPHS and lines
- Remove all the link sources
- Humanize this is a way to make the blog better

Return ONLY the complete markdown blog content with images with proper blog format, properly distributed throughout, ready to display as-is.`;

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
        'DeepSeek successfully created complete blog content with distributed images',
      );
    } catch (deepSeekError) {
      logger.error('DeepSeek failed:', deepSeekError.message);

      enhancedBlogMarkdown = `# ${blogData.title}\n\n`;
      const contentWithImages = distributeImagesInContent(
        `This blog post is sourced from ${blogData.source_domain}.\n\n${blogData.description_text}`,
        blogData.images,
      );
      enhancedBlogMarkdown += contentWithImages;
    }

    // 6. Humanize with DeepSeek
    let humanizedBlogMarkdown = enhancedBlogMarkdown.replaceAll('```', '').replaceAll('markdown\n', '');

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

    // 8. MULTI-DESTINATION PUBLISHING WITH CATEGORIES
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

    // Publish to all selected WordPress sites in parallel with categories
    if (publishingDestinations.wordpress.length > 0) {
      const wpPromises = publishingDestinations.wordpress.map(wpConfig => {
        const selectedCategoriesForDestination = wordpressCategories[wpConfig.id] || [];
        return createWordPressBlogPost(humanizedBlogMarkdown, blogData, wpConfig, selectedCategoriesForDestination);
      });
      const wpResults = await Promise.all(wpPromises);
      publishingResults.wordpress = wpResults;
    }

    // 9. Calculate metrics
    const totalDestinations = publishingDestinations.shopify.length + publishingDestinations.wordpress.length;
    const shopifyPublished = publishingResults.shopify.filter(r => r.success).length;
    const wordpressPublished = publishingResults.wordpress.filter(r => r.success).length;

    // Create destination results summary
    const destinationResults = {
      shopify: publishingDestinations.shopify.map((config, index) => ({
        name: config.name,
        published: publishingResults.shopify[index]?.success ? 1 : 0,
        errors: publishingResults.shopify[index]?.success ? 0 : 1,
      })),
      wordpress: publishingDestinations.wordpress.map((config, index) => ({
        name: config.name,
        published: publishingResults.wordpress[index]?.success ? 1 : 0,
        errors: publishingResults.wordpress[index]?.success ? 0 : 1,
      })),
    };

    // 10. Update database with all publication results
    const updateData = {
      publishing_results: JSON.stringify(publishingResults),
      total_shopify_published: shopifyPublished,
      total_wordpress_published: wordpressPublished,
      total_destinations: totalDestinations,
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

    logger.success(
      `Single blog processing completed with DeepSeek - Published to ${shopifyPublished + wordpressPublished}/${totalDestinations} destinations`,
    );

    return {
      success: true,
      humanizeDataId,
      humanizedContent: humanizedBlogMarkdown,
      blogData,
      publishingResults,
      totalDestinations,
      shopifyPublished,
      wordpressPublished,
      destinationResults,
      aiProvider: 'DeepSeek'
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

    // Transform data to match frontend expectations
    const transformedData = humanizedBlogs.map((item) => {
      const publishingResults = item.publishing_results ? JSON.parse(item.publishing_results) : null;

      return {
        id: item.id,
        humanize_Data: item.humanize_Data,
        created_at: item.created_at,
        multi_destination_results: publishingResults,
        total_destinations: item.total_destinations || 0,
        total_shopify_published: item.total_shopify_published || 0,
        total_wordpress_published: item.total_wordpress_published || 0,
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
        ai_provider: 'DeepSeek'
      };
    });

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

// POST endpoint - Process a single blog URL with multi-destination support and categories
export async function POST(req) {
  try {
    console.log('🔍 POST endpoint hit for DeepSeek multi-destination processing');

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

    const { url, action, publishingDestinations, wordpressCategories } = requestBody;

    console.log('🔍 Extracted values:');
    console.log('  - URL:', url);
    console.log('  - Action:', action);
    console.log('  - Publishing Destinations:', publishingDestinations);
    console.log('  - WordPress Categories:', wordpressCategories);

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

    if (!publishingDestinations || (!publishingDestinations.shopify?.length && !publishingDestinations.wordpress?.length)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No publishing destinations selected',
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

    logger.info(`Processing blog request with DeepSeek for: ${url}`);

    const result = await processSingleBlog(url, publishingDestinations, wordpressCategories);

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
        aiProvider: 'DeepSeek'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}