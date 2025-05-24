'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ViewBlog() {
  const [theme, setTheme] = useState('light');
  const [isMounted, setIsMounted] = useState(false);

  const params = useParams();
  const router = useRouter();
  const [blog, setBlog] = useState<{
    id: number;
    humanize_Data: string;
    rss_feed_data_column: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme from localStorage
  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Handle system preference if theme is set to 'system'
    if (savedTheme === 'system') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      setTheme(systemPreference);
    } else {
      setTheme(savedTheme);
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme') === 'system') {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    // Listen for storage changes (for syncing across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        if (e.newValue === 'system') {
          const isDark = window.matchMedia(
            '(prefers-color-scheme: dark)',
          ).matches;
          setTheme(isDark ? 'dark' : 'light');
        } else {
          setTheme(e.newValue || 'light');
        }
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (isMounted) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
  }, [theme, isMounted]);

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Fetch blog data from Supabase
  useEffect(() => {
    const fetchBlog = async () => {
      try {
        setLoading(true);

        if (!params.id) {
          setError('Blog ID is missing');
          return;
        }

        // Query Supabase for the blog with the ID from params
        const { data, error: supabaseError } = await supabase
          .from('Humanize_Data')
          .select('*')
          .eq('id', params.id)
          .single();

        if (supabaseError) {
          console.error('Supabase error:', supabaseError);
          setError('Failed to fetch blog data from the database');
          return;
        }

        if (!data) {
          setError('Blog not found');
          return;
        }

        setBlog(data);
      } catch (err) {
        console.error('Error fetching blog:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [params.id]);

  // Only render content after mounting to prevent hydration issues
  if (!isMounted) return null;

  // Extract title from markdown content
  const getTitle = (markdown: string) => {
    const titleMatch = markdown?.match(/^# (.+)$/m);
    return titleMatch ? titleMatch[1] : 'Blog Post';
  };

  // Add a wrapper div with the same background as the main app
  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-gradient-to-tr from-gray-900 to-slate-800 text-gray-100'
          : 'bg-gradient-to-tr from-gray-100 to-slate-200 text-[#1e293b]'
      }`}
    >
      {/* Header with theme toggle */}
      <header
        className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
          theme === 'dark'
            ? 'bg-gray-900/80 border-b border-gray-700'
            : 'bg-white/80 border-b border-gray-200'
        } backdrop-blur-md`}
      >
        <h1
          className={`text-xl font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}
        >
          Blog Details
        </h1>

        <div className='flex items-center gap-4'>
          {/* Theme Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors duration-200 ${
              theme === 'dark'
                ? 'bg-gray-800 text-blue-400 hover:bg-gray-700'
                : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
            }`}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>

          <div
            className={`h-8 w-8 rounded-full ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-purple-600 to-blue-500'
                : 'bg-gradient-to-br from-purple-600 to-blue-500'
            } flex items-center justify-center text-white font-medium`}
          >
            U
          </div>
        </div>
      </header>

      {/* Main content */}
      {loading ? (
        <div
          className={`flex justify-center items-center h-64 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          <div className='animate-pulse flex flex-col items-center'>
            <div
              className={`h-8 w-40 rounded-md mb-4 ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            ></div>
            <div
              className={`h-4 w-64 rounded-md ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            ></div>
          </div>
        </div>
      ) : error || !blog ? (
        <div
          className={`max-w-4xl mx-auto p-4 sm:p-6 md:p-10 ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          <button
            onClick={() => router.back()}
            className={`mb-6 inline-flex items-center gap-1 text-sm transition ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ArrowLeft size={16} /> Back to Blogs
          </button>

          <div
            className={`${
              theme === 'dark'
                ? 'bg-gray-800 border border-gray-700'
                : 'bg-white'
            } shadow-xl rounded-2xl p-6 sm:p-10 flex justify-center items-center min-h-[200px]`}
          >
            <div className='text-center'>
              <p
                className={`${
                  theme === 'dark' ? 'text-red-400' : 'text-red-500'
                } font-medium mb-2`}
              >
                {error || 'Blog data not found'}
              </p>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                The blog you're looking for couldn't be loaded. Please try again
                or return to the blogs page.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <section
          className={`max-w-4xl mx-auto p-4 sm:p-6 md:p-10 ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          <button
            onClick={() => router.back()}
            className={`mb-6 inline-flex items-center gap-1 text-sm transition ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ArrowLeft size={16} /> Back to Blogs
          </button>

          <article
            className={`${
              theme === 'dark'
                ? 'bg-gray-800 border border-gray-700'
                : 'bg-white'
            } shadow-xl rounded-2xl p-6 sm:p-10`}
          >
            <div className='mb-6'>
              <div
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                  theme === 'dark'
                    ? 'bg-violet-900/40 text-violet-300'
                    : 'bg-violet-100 text-violet-700'
                }`}
              >
                Blog #{blog.rss_feed_data_column}
              </div>
            </div>

            {/* Render the complete markdown content using ReactMarkdown */}
            <div
              className={`markdown-content ${
                theme === 'dark' ? 'markdown-dark' : 'markdown-light'
              }`}
            >
              <ReactMarkdown
                components={{
                  // Override components to apply theme-specific styling
                  h1: ({ node, ...props }) => (
                    <h1
                      className={`text-2xl font-bold mb-4 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-800'
                      }`}
                      {...props}
                    />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2
                      className={`text-xl font-semibold mt-6 mb-3 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-800'
                      }`}
                      {...props}
                    />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3
                      className={`text-lg font-semibold mt-5 mb-2 ${
                        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                      }`}
                      {...props}
                    />
                  ),
                  p: ({ node, ...props }) => (
                    <p
                      className={`mb-4 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                      {...props}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      className={`${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      } hover:underline`}
                      {...props}
                    />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className='list-disc pl-6 mb-4' {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className='list-decimal pl-6 mb-4' {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className='mb-1' {...props} />
                  ),
                  img: ({ node, ...props }) => (
                    <div className='my-6'>
                      <img
                        className='rounded-lg max-w-full h-auto'
                        {...props}
                        alt={props.alt || 'Blog image'}
                      />
                      {props.alt && (
                        <span
                          className={`block mt-2 text-sm italic ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {props.alt}
                        </span>
                      )}
                    </div>
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      className={`border-l-4 pl-4 py-1 my-4 ${
                        theme === 'dark'
                          ? 'border-gray-600 text-gray-400'
                          : 'border-gray-300 text-gray-600'
                      }`}
                      {...props}
                    />
                  ),
                  code: ({ node, inline, ...props }) =>
                    inline ? (
                      <code
                        className={`px-1 py-0.5 rounded ${
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        }`}
                        {...props}
                      />
                    ) : (
                      <code
                        className={`block p-3 rounded-md my-4 overflow-x-auto ${
                          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                        }`}
                        {...props}
                      />
                    ),
                }}
              >
                {blog.humanize_Data}
              </ReactMarkdown>
            </div>
          </article>
        </section>
      )}

      {/* Add some additional global styling for markdown content */}
      <style jsx global>{`
        .markdown-content {
          /* Common markdown styles */
          line-height: 1.6;
        }

        .markdown-dark pre {
          background-color: #1a202c;
          border-radius: 0.375rem;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .markdown-light pre {
          background-color: #f7fafc;
          border-radius: 0.375rem;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .markdown-content hr {
          border: 0;
          height: 1px;
          margin: 2rem 0;
          background-color: ${theme === 'dark'
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(0,0,0,0.1)'};
        }

        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }

        .markdown-content th,
        .markdown-content td {
          padding: 0.5rem;
          border: 1px solid
            ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
        }

        .markdown-content th {
          background-color: ${theme === 'dark'
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.05)'};
        }
      `}</style>
    </div>
  );
}
