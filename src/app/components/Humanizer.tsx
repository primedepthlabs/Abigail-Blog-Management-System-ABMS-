'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Import icons
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import LaunchIcon from '@mui/icons-material/Launch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';

interface PublishingStatus {
  shopify: {
    published: boolean;
    article_id?: number;
    url?: string;
    handle?: string;
    published_at?: string;
    error?: string;
  };
  wordpress: {
    published: boolean;
    post_id?: number;
    url?: string;
    slug?: string;
    published_at?: string;
    error?: string;
  };
}

interface SourceInfo {
  rss_item_id?: number;
  original_url?: string;
  feed_url?: string;
  feed_id?: number;
}

interface Blog {
  id: number;
  humanize_Data: string;
  created_at: string;
  summary: string;
  imageUrl: string;
  publishing_status: PublishingStatus;
  source_info: SourceInfo;
  is_published_anywhere: boolean;
  is_dual_published: boolean;
  has_errors: boolean;
  live_urls: {
    shopify?: string;
    wordpress?: string;
  };
}

interface BlogTableProps {
  theme: string;
  setTheme: (theme: string) => void;
}

interface ApiResponse {
  data: any[];
  summary: {
    total: number;
    shopifyPublished: number;
    wordpressPublished: number;
    dualPublished: number;
    unpublished: number;
  };
}

export default function BlogTable({ theme, setTheme }: BlogTableProps) {
  const [data, setData] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'published' | 'unpublished' | 'dual' | 'errors'
  >('all');
  const [summary, setSummary] = useState<ApiResponse['summary'] | null>(null);
  const router = useRouter();

  const parseBackendData = (text?: string) => {
    if (!text || typeof text !== 'string') {
      console.warn('parseBackendData: received empty or invalid text');
      return { summary: 'No summary available', imageUrl: '' };
    }
    const imageMatch = text.match(/!\[.*?\]\((.*?)\)/);
    const imageUrl = imageMatch ? imageMatch[1] : '';

    // Extract title (first line starting with #) or first 100 chars
    const lines = text.split('\n');
    const titleLine = lines.find((line) => line.trim().startsWith('# '));
    const summary = titleLine
      ? titleLine.replace(/^#\s*/, '').trim()
      : text.slice(0, 100).replace(/^#\s*/, '').trim();

    return { summary, imageUrl };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/rss');
        const json: ApiResponse = await res.json();

        if (json.data) {
          const parsed = json.data.map((entry: any) => ({
            id: entry.id,
            humanize_Data: entry.humanize_Data,
            created_at: entry.created_at,
            publishing_status: entry.publishing_status,
            source_info: entry.source_info,
            is_published_anywhere: entry.is_published_anywhere,
            is_dual_published: entry.is_dual_published,
            has_errors: entry.has_errors,
            live_urls: entry.live_urls,
            ...parseBackendData(entry.humanize_Data),
          }));

          setData(parsed);
          setSummary(json.summary);
        } else {
          setData([]);
        }
      } catch (error) {
        console.error('Fetch error:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewBlog = (blog: Blog) => {
    localStorage.setItem('selectedBlog', JSON.stringify(blog));
    router.push(`/ViewBlog/${blog.id}`);
  };

  // Filter data based on search term and status filter
  const filteredData = data.filter((blog) => {
    const matchesSearch = blog.summary
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    switch (filterStatus) {
      case 'published':
        return matchesSearch && blog.is_published_anywhere;
      case 'unpublished':
        return matchesSearch && !blog.is_published_anywhere;
      case 'dual':
        return matchesSearch && blog.is_dual_published;
      case 'errors':
        return matchesSearch && blog.has_errors;
      default:
        return matchesSearch;
    }
  });

  // Publishing status badge component
  const PublishingBadge = ({ blog }: { blog: Blog }) => {
    if (blog.is_dual_published) {
      return (
        <div className='flex gap-1'>
          <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-800'>
            <CheckCircleIcon style={{ fontSize: '12px' }} />
            Shopify
          </span>
          <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800'>
            <CheckCircleIcon style={{ fontSize: '12px' }} />
            WordPress
          </span>
        </div>
      );
    }

    if (blog.publishing_status.shopify.published) {
      return (
        <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-800'>
          <CheckCircleIcon style={{ fontSize: '12px' }} />
          Shopify Only
        </span>
      );
    }

    if (blog.publishing_status.wordpress.published) {
      return (
        <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800'>
          <CheckCircleIcon style={{ fontSize: '12px' }} />
          WordPress Only
        </span>
      );
    }

    if (blog.has_errors) {
      return (
        <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-800'>
          <ErrorIcon style={{ fontSize: '12px' }} />
          Failed
        </span>
      );
    }

    return (
      <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600'>
        <PendingIcon style={{ fontSize: '12px' }} />
        Unpublished
      </span>
    );
  };

  // Live links component
  const LiveLinks = ({ blog }: { blog: Blog }) => {
    const links = [];

    if (blog.live_urls.shopify) {
      links.push(
        <a
          key='shopify'
          href={blog.live_urls.shopify}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-900/20 text-green-400 hover:bg-green-900/40 transition-colors'
          onClick={(e) => e.stopPropagation()}
        >
          <LaunchIcon style={{ fontSize: '12px' }} />
          Shopify
        </a>,
      );
    }

    if (blog.live_urls.wordpress) {
      links.push(
        <a
          key='wordpress'
          href={blog.live_urls.wordpress}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition-colors'
          onClick={(e) => e.stopPropagation()}
        >
          <LaunchIcon style={{ fontSize: '12px' }} />
          WordPress
        </a>,
      );
    }

    return links.length > 0 ? <div className='flex gap-2'>{links}</div> : null;
  };

  // Animation variants (same as before)
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  const shimmerVariants = {
    animate: {
      backgroundPosition: ['0% 0%', '100% 100%'],
      transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
    },
  };

  const renderSkeleton = () => (
    <div className='w-full'>
      {viewType === 'grid' ? (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              variants={shimmerVariants}
              animate='animate'
              className={`${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                  : 'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100'
              } bg-[length:400%_100%] rounded-xl h-64`}
            />
          ))}
        </div>
      ) : (
        <div className='space-y-4'>
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              variants={shimmerVariants}
              animate='animate'
              className={`${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                  : 'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100'
              } bg-[length:400%_100%] h-16 rounded-xl`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`${
        theme === 'dark'
          ? 'bg-gray-800 text-gray-100'
          : 'bg-white text-gray-800'
      } rounded-2xl p-6 md:p-10 shadow-xl relative overflow-hidden transition-colors duration-300`}
    >
      {/* Decorative background element */}
      <div
        className={`absolute -top-24 -right-24 w-64 h-64 ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20'
            : 'bg-gradient-to-br from-purple-500/10 to-blue-500/10'
        } rounded-full blur-3xl`}
      />

      <div className='relative z-10'>
        {/* Header section with summary stats */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
          <div>
            <h2
              className={`text-2xl font-bold ${
                theme === 'dark'
                  ? 'text-transparent bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text'
                  : 'text-transparent bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text'
              }`}
            >
              Humanized Blogs
            </h2>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mt-1 transition-colors duration-300`}
            >
              AI-enhanced content from RSS feeds
            </p>

            {/* Summary stats */}
            {summary && !loading && (
              <div className='flex flex-wrap gap-3 mt-3'>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300'>
                  Total: {summary.total}
                </span>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/30 text-green-400'>
                  Shopify: {summary.shopifyPublished}
                </span>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-900/30 text-blue-400'>
                  WordPress: {summary.wordpressPublished}
                </span>
                <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-cyan-900/30 text-cyan-400'>
                  Both: {summary.dualPublished}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search, filter, and view controls */}
        <div className='flex flex-col sm:flex-row gap-3 mb-8'>
          <div className='relative flex-1'>
            <SearchIcon
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            />
            <input
              type='text'
              placeholder='Search blogs...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-xl w-full ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30'
                  : 'bg-white border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
              } transition-all outline-none`}
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className={`px-4 py-2 rounded-xl ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-200'
            } transition-all outline-none`}
          >
            <option value='all'>All Posts</option>
            <option value='published'>Published</option>
            <option value='dual'>Both Platforms</option>
            <option value='unpublished'>Unpublished</option>
            <option value='errors'>Has Errors</option>
          </select>

          {/* View type toggle */}
          <div
            className={`flex rounded-xl overflow-hidden ${
              theme === 'dark'
                ? 'border border-gray-700'
                : 'border border-gray-200'
            }`}
          >
            <button
              onClick={() => setViewType('grid')}
              className={`flex items-center justify-center px-3 py-2 ${
                viewType === 'grid'
                  ? theme === 'dark'
                    ? 'bg-violet-900/50 text-violet-400'
                    : 'bg-violet-50 text-violet-600'
                  : theme === 'dark'
                  ? 'text-gray-400 hover:bg-gray-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <rect x='3' y='3' width='7' height='7' />
                <rect x='14' y='3' width='7' height='7' />
                <rect x='3' y='14' width='7' height='7' />
                <rect x='14' y='14' width='7' height='7' />
              </svg>
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`flex items-center justify-center px-3 py-2 ${
                viewType === 'list'
                  ? theme === 'dark'
                    ? 'bg-violet-900/50 text-violet-400'
                    : 'bg-violet-50 text-violet-600'
                  : theme === 'dark'
                  ? 'text-gray-400 hover:bg-gray-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <line x1='8' y1='6' x2='21' y2='6' />
                <line x1='8' y1='12' x2='21' y2='12' />
                <line x1='8' y1='18' x2='21' y2='18' />
                <line x1='3' y1='6' x2='3.01' y2='6' />
                <line x1='3' y1='12' x2='3.01' y2='12' />
                <line x1='3' y1='18' x2='3.01' y2='18' />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          renderSkeleton()
        ) : filteredData.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <ArticleOutlinedIcon
              className={
                theme === 'dark' ? 'text-gray-600 mb-3' : 'text-gray-300 mb-3'
              }
              style={{ fontSize: '4rem' }}
            />
            <h3
              className={`text-xl font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              No blogs found
            </h3>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } mt-2 max-w-md`}
            >
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search term or filter, or check back later for new content.'
                : 'No blogs are available at the moment. Process some RSS feeds to see content here.'}
            </p>
          </div>
        ) : viewType === 'grid' ? (
          // Grid view
          <motion.div
            className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
            variants={containerVariants}
            initial='hidden'
            animate='show'
          >
            {filteredData.map((blog) => (
              <motion.div
                key={blog.id}
                variants={itemVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={`group ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 hover:shadow-lg hover:shadow-black/20'
                    : 'bg-white border-gray-100 hover:shadow-md'
                } rounded-xl overflow-hidden border shadow-sm transition-all duration-300`}
              >
                <div
                  className={`h-40 ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  } relative overflow-hidden`}
                >
                  {blog.imageUrl ? (
                    <div className='w-full h-full relative'>
                      <div
                        className='w-full h-full bg-cover bg-center transition-transform group-hover:scale-105 duration-500'
                        style={{ backgroundImage: `url(${blog.imageUrl})` }}
                        aria-label='Blog thumbnail'
                      />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-center h-full ${
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-gray-800 to-gray-700'
                          : 'bg-gradient-to-br from-gray-100 to-gray-200'
                      }`}
                    >
                      <ArticleOutlinedIcon
                        className={
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                        }
                        style={{ fontSize: '3rem' }}
                      />
                    </div>
                  )}
                  <div className='absolute top-3 left-3 bg-violet-600 text-white text-xs px-2 py-1 rounded-md font-medium'>
                    Blog #{blog.id}
                  </div>
                  <div className='absolute top-3 right-3'>
                    <PublishingBadge blog={blog} />
                  </div>
                </div>

                <div className='p-5'>
                  <p
                    className={`${
                      theme === 'dark' ? 'text-white' : 'text-black'
                    } line-clamp-3 font-bold text-sm mb-3`}
                  >
                    {blog.summary}
                  </p>

                  {/* Live links */}
                  <div className='mb-4'>
                    <LiveLinks blog={blog} />
                  </div>

                  <button
                    onClick={() => handleViewBlog(blog)}
                    className={`w-full ${
                      theme === 'dark'
                        ? 'bg-violet-900/30 hover:bg-violet-800/50 text-violet-300'
                        : 'bg-violet-50 hover:bg-violet-100 text-violet-700'
                    } px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 group`}
                  >
                    <span>Read Article</span>
                    <ArrowForwardIosIcon className='w-3 h-3 group-hover:translate-x-1 transition-transform' />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          // List view
          <motion.div
            className='space-y-3'
            variants={containerVariants}
            initial='hidden'
            animate='show'
          >
            {filteredData.map((blog) => (
              <motion.div
                key={blog.id}
                variants={itemVariants}
                className={`group flex items-center gap-4 p-4 rounded-xl ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 hover:border-violet-700 hover:bg-violet-900/30'
                    : 'bg-white border-gray-100 hover:border-violet-200 hover:bg-violet-50/30'
                } border transition-all duration-200`}
              >
                <div
                  className={`flex-shrink-0 w-16 h-16 ${
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  } rounded-lg overflow-hidden relative`}
                >
                  {blog.imageUrl ? (
                    <div className='w-full h-full relative'>
                      <div
                        className='w-full h-full bg-cover bg-center'
                        style={{ backgroundImage: `url(${blog.imageUrl})` }}
                        aria-label='Blog thumbnail'
                      />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-center h-full ${
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-gray-800 to-gray-700'
                          : 'bg-gradient-to-br from-gray-100 to-gray-200'
                      }`}
                    >
                      <ArticleOutlinedIcon
                        className={
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                        }
                      />
                    </div>
                  )}
                </div>

                <div className='flex-grow'>
                  <div className='flex items-center gap-2 mb-2'>
                    <span
                      className={`${
                        theme === 'dark'
                          ? 'bg-violet-900/40 text-violet-300'
                          : 'bg-violet-100 text-violet-700'
                      } text-xs px-2 py-0.5 rounded-md font-medium`}
                    >
                      Blog #{blog.id}
                    </span>
                    <PublishingBadge blog={blog} />
                  </div>
                  <p
                    className={`${
                      theme === 'dark' ? 'text-white' : 'text-black'
                    } line-clamp-1 font-bold text-sm mb-2`}
                  >
                    {blog.summary}
                  </p>
                  <LiveLinks blog={blog} />
                </div>

                <button
                  onClick={() => handleViewBlog(blog)}
                  className={`flex-shrink-0 flex items-center justify-center ${
                    theme === 'dark'
                      ? 'bg-violet-700 hover:bg-violet-600'
                      : 'bg-violet-600 hover:bg-violet-700'
                  } text-white w-10 h-10 rounded-full transition-colors`}
                >
                  <VisibilityOutlinedIcon fontSize='small' />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Footer with pagination or stats */}
        {!loading && filteredData.length > 0 && (
          <div
            className={`mt-8 pt-6 ${
              theme === 'dark'
                ? 'border-t border-gray-700 text-gray-400'
                : 'border-t border-gray-100 text-gray-500'
            } flex justify-between items-center text-sm`}
          >
            <p>
              Showing {filteredData.length} of {data.length} blogs
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}
