'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';

// Markdown plugins
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';

// Styles for syntax highlighting & math rendering
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ViewBlog() {
  const [theme, setTheme] = useState('light');
  const [isMounted, setIsMounted] = useState(false);

  const params = useParams();
  const router = useRouter();
  const [blog, setBlog] = useState<{ id: number; humanize_Data: string; rss_feed_data_column: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme from localStorage
  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'light';

    if (savedTheme === 'system') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(systemPreference);
    } else {
      setTheme(savedTheme);
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme') === 'system') {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        if (e.newValue === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
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

  if (!isMounted) return null;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-gradient-to-tr from-gray-900 to-slate-800 text-gray-100'
          : 'bg-gradient-to-tr from-gray-100 to-slate-200 text-[#1e293b]'
      }`}
    >
      <header
        className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
          theme === 'dark' ? 'bg-gray-900/80 border-b border-gray-700' : 'bg-white/80 border-b border-gray-200'
        } backdrop-blur-md`}
      >
        <h1
          className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}
        >
          Blog Details
        </h1>

        <div className='flex items-center gap-4'>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors duration-200 ${
              theme === 'dark' ? 'bg-gray-800 text-blue-400 hover:bg-gray-700' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
            }`}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>

          <div
            className={`h-8 w-8 rounded-full ${
              theme === 'dark' ? 'bg-gradient-to-br from-purple-600 to-blue-500' : 'bg-gradient-to-br from-purple-600 to-blue-500'
            } flex items-center justify-center text-white font-medium`}
          >
            U
          </div>
        </div>
      </header>

      {loading ? (
        <div
          className={`flex justify-center items-center h-64 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
        >
          <div className='animate-pulse flex flex-col items-center'>
            <div
              className={`h-8 w-40 rounded-md mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
            ></div>
            <div
              className={`h-4 w-64 rounded-md ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
            ></div>
          </div>
        </div>
      ) : error || !blog ? (
        <div
          className={`max-w-4xl mx-auto p-4 sm:p-6 md:p-10 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
        >
          <button
            onClick={() => router.back()}
            className={`mb-6 inline-flex items-center gap-1 text-sm transition ${
              theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ArrowLeft size={16} /> Back to Blogs
          </button>

          <div
            className={`${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'}
              shadow-xl rounded-2xl p-6 sm:p-10 flex justify-center items-center min-h-[200px]`}
          >
            <div className='text-center'>
              <p
                className={`${theme === 'dark' ? 'text-red-400' : 'text-red-500'} font-medium mb-2`}
              >
                {error || 'Blog data not found'}
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}> The blog you're looking for couldn't be loaded. Please try again or return to the blogs page.</p>
            </div>
          </div>
        </div>
      ) : (
        <section
          className={`max-w-4xl mx-auto p-4 sm:p-6 md:p-10 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
        >
          <button
            onClick={() => router.back()}
            className={`mb-6 inline-flex items-center gap-1 text-sm transition ${
              theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ArrowLeft size={16} /> Back to Blogs
          </button>

          <article
            className={`${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'} shadow-xl rounded-2xl p-6 sm:p-10`}
          >
            <div className='mb-6'><div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${theme === 'dark' ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>Blog #{blog.rss_feed_data_column}</div></div>

            <div className={`markdown-content ${theme === 'dark' ? 'markdown-dark' : 'markdown-light'}`}>              
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  rehypeRaw,
                  rehypeSanitize,
                  rehypeSlug,
                  [rehypeAutolinkHeadings, { behavior: 'wrap' }],
                  rehypeHighlight,
                  rehypeKatex,
                ]}
              >
                {blog.humanize_Data}
              </ReactMarkdown>
            </div>
          </article>
        </section>
      )}

      <style jsx global>{`
        .markdown-content {
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
          background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
        }

        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }

        .markdown-content th,
        .markdown-content td {
          padding: 0.5rem;
          border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
        }

        .markdown-content th {
          background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        }
      `}</style>
    </div>
  );
}
