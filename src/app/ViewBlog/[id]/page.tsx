// // 'use client';
// // import { useRouter } from 'next/navigation';
// // import { useEffect, useState } from 'react';

// // export default function ViewBlog() {
// //   const router = useRouter();
// //   const [blog, setBlog] = useState<{
// //     summary: string;
// //     imageUrl: string;
// //   } | null>(null);

// //   useEffect(() => {
// //     const stored = localStorage.getItem('selectedBlog');
// //     if (stored) {
// //       setBlog(JSON.parse(stored));
// //     }
// //   }, []);

// //   if (!blog) {
// //     return (
// //       <div className='flex justify-center items-center h-64'>
// //         <p className='text-red-500 text-sm'>No blog data found.</p>
// //       </div>
// //     );
// //   }

// //   return (
// //     <section className='max-w-4xl mx-auto p-4 sm:p-6 md:p-10'>
// //       <button
// //         onClick={() => router.back()}
// //         className='mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition'
// //       >
// //         ← Back to Blogs
// //       </button>

// //       <article className='bg-white shadow-xl rounded-2xl p-6 sm:p-10'>
// //         <h1 className='text-xl sm:text-2xl font-semibold text-gray-800 mb-4'>
// //           Blog Summary
// //         </h1>

// //         <p className='text-gray-700 leading-relaxed'>{blog.summary}</p>

// //         {blog.imageUrl && (
// //           <div className='mt-6 rounded-lg overflow-hidden shadow-lg'>
// //             <img
// //               src={blog.imageUrl}
// //               alt='Blog visual'
// //               className='w-full h-auto object-cover'
// //             />
// //           </div>
// //         )}
// //       </article>
// //     </section>
// //   );
// // }
// 'use client';

// import { useParams, useRouter } from 'next/navigation';
// import { useEffect, useState } from 'react';
// import { ArrowLeft } from 'lucide-react';

// interface BlogViewProps {
//   theme: string;
//   setTheme?: (theme: string) => void;
// }

// export default function ViewBlog({ theme }: BlogViewProps) {
//   const params = useParams();
//   const router = useRouter();
//   const [blog, setBlog] = useState<{
//     id: number;
//     summary: string;
//     imageUrl: string;
//   } | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     // Log for debugging
//     console.log('URL params:', params);
//     console.log('Looking for blog with ID:', params.id);

//     try {
//       const stored = localStorage.getItem('selectedBlog');
//       console.log('Data from localStorage:', stored);

//       if (stored) {
//         const parsedBlog = JSON.parse(stored);
//         console.log('Parsed blog:', parsedBlog);

//         // Verify the ID matches the URL param for extra security
//         if (parsedBlog.id === Number(params.id)) {
//           setBlog(parsedBlog);
//         } else {
//           console.log('Blog ID mismatch!');
//           setError("The blog data doesn't match the requested ID");
//           // Here you could fetch the correct blog from your API
//         }
//       } else {
//         console.log('No blog found in localStorage');
//         setError('Blog data not found');
//         // Here you could fetch the blog data from your API based on params.id
//       }
//     } catch (err) {
//       console.error('Error retrieving blog:', err);
//       setError('Error loading blog data');
//     } finally {
//       setLoading(false);
//     }
//   }, [params.id]);

//   if (loading) {
//     return (
//       <div
//         className={`flex justify-center items-center h-64 ${
//           theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
//         }`}
//       >
//         <div className='animate-pulse flex flex-col items-center'>
//           <div
//             className={`h-8 w-40 rounded-md mb-4 ${
//               theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
//             }`}
//           ></div>
//           <div
//             className={`h-4 w-64 rounded-md ${
//               theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
//             }`}
//           ></div>
//         </div>
//       </div>
//     );
//   }

//   if (error || !blog) {
//     return (
//       <div
//         className={`max-w-4xl mx-auto p-4 sm:p-6 md:p-10 ${
//           theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
//         }`}
//       >
//         <button
//           onClick={() => router.back()}
//           className={`mb-6 inline-flex items-center gap-1 text-sm transition ${
//             theme === 'dark'
//               ? 'text-gray-400 hover:text-gray-200'
//               : 'text-gray-600 hover:text-gray-800'
//           }`}
//         >
//           <ArrowLeft size={16} /> Back to Blogs
//         </button>

//         <div
//           className={`${
//             theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
//           } shadow-xl rounded-2xl p-6 sm:p-10 flex justify-center items-center min-h-[200px]`}
//         >
//           <div className='text-center'>
//             <p
//               className={`${
//                 theme === 'dark' ? 'text-red-400' : 'text-red-500'
//               } font-medium mb-2`}
//             >
//               {error || 'Blog data not found'}
//             </p>
//             <p
//               className={`text-sm ${
//                 theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
//               }`}
//             >
//               The blog you're looking for couldn't be loaded. Please try again
//               or return to the blogs page.
//             </p>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <section
//       className={`max-w-4xl mx-auto p-4 sm:p-6 md:p-10 ${
//         theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
//       }`}
//     >
//       <button
//         onClick={() => router.back()}
//         className={`mb-6 inline-flex items-center gap-1 text-sm transition ${
//           theme === 'dark'
//             ? 'text-gray-400 hover:text-gray-200'
//             : 'text-gray-600 hover:text-gray-800'
//         }`}
//       >
//         <ArrowLeft size={16} /> Back to Blogs
//       </button>

//       <article
//         className={`${
//           theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
//         } shadow-xl rounded-2xl p-6 sm:p-10`}
//       >
//         <div className='mb-6'>
//           <div
//             className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${
//               theme === 'dark'
//                 ? 'bg-violet-900/40 text-violet-300'
//                 : 'bg-violet-100 text-violet-700'
//             }`}
//           >
//             Blog #{blog.id}
//           </div>
//           <h1
//             className={`text-xl sm:text-2xl font-semibold ${
//               theme === 'dark' ? 'text-white' : 'text-gray-800'
//             } mb-4`}
//           >
//             Blog Summary
//           </h1>
//         </div>

//         <p
//           className={`${
//             theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
//           } leading-relaxed`}
//         >
//           {blog.summary}
//         </p>

//         {blog.imageUrl && (
//           <div className='mt-6 rounded-lg overflow-hidden shadow-lg'>
//             <img
//               src={blog.imageUrl}
//               alt='Blog visual'
//               className='w-full h-auto object-cover'
//             />
//           </div>
//         )}
//       </article>
//     </section>
//   );
// }
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ViewBlog() {
  // State for theme
  const [theme, setTheme] = useState('light');
  const [isMounted, setIsMounted] = useState(false);

  const params = useParams();
  const router = useRouter();
  const [blog, setBlog] = useState<{
    id: number;
    summary: string;
    imageUrl: string;
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

  // Get blog data
  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedBlog');

      if (stored) {
        const parsedBlog = JSON.parse(stored);

        // Verify the ID matches the URL param
        if (parsedBlog.id === Number(params.id)) {
          setBlog(parsedBlog);
        } else {
          setError("The blog data doesn't match the requested ID");
        }
      } else {
        setError('Blog data not found');
      }
    } catch (err) {
      console.error('Error retrieving blog:', err);
      setError('Error loading blog data');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  // Only render content after mounting to prevent hydration issues
  if (!isMounted) return null;

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
                Blog #{blog.id}
              </div>
              <h1
                className={`text-xl sm:text-2xl font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-800'
                } mb-4`}
              >
                Blog Summary
              </h1>
            </div>

            <p
              className={`${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              } leading-relaxed`}
            >
              {blog.summary}
            </p>

            {blog.imageUrl && (
              <div className='mt-6 rounded-lg overflow-hidden shadow-lg'>
                <img
                  src={blog.imageUrl}
                  alt='Blog visual'
                  className='w-full h-auto object-cover'
                />
              </div>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
