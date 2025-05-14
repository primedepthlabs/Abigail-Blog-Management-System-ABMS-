// // 'use client';
// import { useRouter } from 'next/navigation';
// import { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';

// // Import icons
// import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
// import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
// import FilterListIcon from '@mui/icons-material/FilterList';
// import SearchIcon from '@mui/icons-material/Search';
// import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// interface Blog {
//   id: number;
//   summary: string;
//   imageUrl: string;
// }

// export default function BlogTable() {
//   const [data, setData] = useState<Blog[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
//   const router = useRouter();

//   const parseBackendData = (text?: string) => {
//     if (!text || typeof text !== 'string') {
//       console.warn('parseBackendData: received empty or invalid text');
//       return { summary: 'No summary available', imageUrl: '' };
//     }

//     const summaryMatch = text.match(
//       /\*\*Summary:\*\*\s*([\s\S]*?)(?=\*\*Image:|\n\n|\Z)/,
//     );
//     const imageMatch = text.match(/!\[.*?\]\((.*?)\)/);

//     const summary = summaryMatch
//       ? summaryMatch[1]
//           .replace(/[\n\r]+/g, ' ')
//           .replace(/\s{2,}/g, ' ')
//           .trim()
//       : 'No summary found';
//     const imageUrl = imageMatch ? imageMatch[1] : '';

//     return { summary, imageUrl };
//   };

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const res = await fetch('/api/humanize');
//         const json = await res.json();

//         const parsed = json.data.map((entry: any, index: number) => ({
//           id: index + 1,
//           ...parseBackendData(entry.humanize_Data),
//         }));

//         setData(parsed);
//       } catch (error) {
//         console.error('Fetch error:', error);
//         setData([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);

//   const handleViewBlog = (blog: Blog) => {
//     localStorage.setItem('selectedBlog', JSON.stringify(blog));
//     router.push(`/ViewBlog/${blog.id}`);
//   };

//   const filteredData = data.filter((blog) =>
//     blog.summary.toLowerCase().includes(searchTerm.toLowerCase()),
//   );

//   // Animation variants
//   const containerVariants = {
//     hidden: { opacity: 0 },
//     show: {
//       opacity: 1,
//       transition: {
//         staggerChildren: 0.1,
//       },
//     },
//   };

//   const itemVariants = {
//     hidden: { y: 20, opacity: 0 },
//     show: { y: 0, opacity: 1 },
//   };

//   const shimmerVariants = {
//     animate: {
//       backgroundPosition: ['0% 0%', '100% 100%'],
//       transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
//     },
//   };

//   const renderSkeleton = () => (
//     <div className='w-full'>
//       {viewType === 'grid' ? (
//         <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
//           {[...Array(6)].map((_, i) => (
//             <motion.div
//               key={i}
//               variants={shimmerVariants}
//               animate='animate'
//               className='bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:400%_100%] rounded-xl h-64'
//             />
//           ))}
//         </div>
//       ) : (
//         <div className='space-y-4'>
//           {[...Array(5)].map((_, i) => (
//             <motion.div
//               key={i}
//               variants={shimmerVariants}
//               animate='animate'
//               className='bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:400%_100%] h-16 rounded-xl'
//             />
//           ))}
//         </div>
//       )}
//     </div>
//   );

//   return (
//     <motion.section
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       transition={{ duration: 0.5 }}
//       className='bg-white rounded-2xl p-6 md:p-10 shadow-xl relative overflow-hidden'
//     >
//       {/* Decorative background element */}
//       <div className='absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-3xl' />

//       <div className='relative z-10'>
//         {/* Header section */}
//         <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8'>
//           <div>
//             <h2 className='text-2xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent'>
//               Blogs
//             </h2>
//             <p className='text-gray-500 text-sm mt-1'>
//               Browse and discover interesting content
//             </p>
//           </div>

//           {/* Search and filter */}
//           <div className='flex flex-col sm:flex-row gap-3'>
//             <div className='relative'>
//               <SearchIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
//               <input
//                 type='text'
//                 placeholder='Search blogs...'
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className='pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none w-full'
//               />
//             </div>

//             <div className='flex border border-gray-200 rounded-xl overflow-hidden'>
//               <button
//                 onClick={() => setViewType('grid')}
//                 className={`flex items-center justify-center px-3 py-2 ${
//                   viewType === 'grid'
//                     ? 'bg-violet-50 text-violet-600'
//                     : 'text-gray-500 hover:bg-gray-50'
//                 }`}
//               >
//                 <svg
//                   xmlns='http://www.w3.org/2000/svg'
//                   width='20'
//                   height='20'
//                   viewBox='0 0 24 24'
//                   fill='none'
//                   stroke='currentColor'
//                   strokeWidth='2'
//                   strokeLinecap='round'
//                   strokeLinejoin='round'
//                 >
//                   <rect x='3' y='3' width='7' height='7' />
//                   <rect x='14' y='3' width='7' height='7' />
//                   <rect x='3' y='14' width='7' height='7' />
//                   <rect x='14' y='14' width='7' height='7' />
//                 </svg>
//               </button>
//               <button
//                 onClick={() => setViewType('list')}
//                 className={`flex items-center justify-center px-3 py-2 ${
//                   viewType === 'list'
//                     ? 'bg-violet-50 text-violet-600'
//                     : 'text-gray-500 hover:bg-gray-50'
//                 }`}
//               >
//                 <svg
//                   xmlns='http://www.w3.org/2000/svg'
//                   width='20'
//                   height='20'
//                   viewBox='0 0 24 24'
//                   fill='none'
//                   stroke='currentColor'
//                   strokeWidth='2'
//                   strokeLinecap='round'
//                   strokeLinejoin='round'
//                 >
//                   <line x1='8' y1='6' x2='21' y2='6' />
//                   <line x1='8' y1='12' x2='21' y2='12' />
//                   <line x1='8' y1='18' x2='21' y2='18' />
//                   <line x1='3' y1='6' x2='3.01' y2='6' />
//                   <line x1='3' y1='12' x2='3.01' y2='12' />
//                   <line x1='3' y1='18' x2='3.01' y2='18' />
//                 </svg>
//               </button>
//             </div>
//           </div>
//         </div>

//         {loading ? (
//           renderSkeleton()
//         ) : filteredData.length === 0 ? (
//           <div className='flex flex-col items-center justify-center py-16 text-center'>
//             <ArticleOutlinedIcon
//               className='text-gray-300 mb-3'
//               style={{ fontSize: '4rem' }}
//             />
//             <h3 className='text-xl font-medium text-gray-600'>
//               No blogs found
//             </h3>
//             <p className='text-gray-500 mt-2 max-w-md'>
//               {searchTerm
//                 ? 'Try adjusting your search term or check back later for new content.'
//                 : 'No blogs are available at the moment. Check back later for new content.'}
//             </p>
//           </div>
//         ) : viewType === 'grid' ? (
//           // Grid view
//           <motion.div
//             className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
//             variants={containerVariants}
//             initial='hidden'
//             animate='show'
//           >
//             {filteredData.map((blog) => (
//               <motion.div
//                 key={blog.id}
//                 variants={itemVariants}
//                 whileHover={{ y: -5, transition: { duration: 0.2 } }}
//                 className='group bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300'
//               >
//                 <div className='h-40 bg-gray-100 relative overflow-hidden'>
//                   {blog.imageUrl ? (
//                     <div className='w-full h-full relative'>
//                       <div
//                         className='w-full h-full bg-cover bg-center transition-transform group-hover:scale-105 duration-500'
//                         style={{ backgroundImage: `url(${blog.imageUrl})` }}
//                         aria-label='Blog thumbnail'
//                       />
//                     </div>
//                   ) : (
//                     <div className='flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200'>
//                       <ArticleOutlinedIcon
//                         className='text-gray-300'
//                         style={{ fontSize: '3rem' }}
//                       />
//                     </div>
//                   )}
//                   <div className='absolute top-3 left-3 bg-violet-600 text-white text-xs px-2 py-1 rounded-md font-medium'>
//                     Blog #{blog.id}
//                   </div>
//                 </div>

//                 <div className='p-5'>
//                   <p className='text-gray-700 line-clamp-3 text-sm mb-4'>
//                     {blog.summary}
//                   </p>
//                   <button
//                     onClick={() => handleViewBlog(blog)}
//                     className='w-full bg-violet-50 hover:bg-violet-100 text-violet-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 group'
//                   >
//                     <span>Read Article</span>
//                     <ArrowForwardIosIcon className='w-3 h-3 group-hover:translate-x-1 transition-transform' />
//                   </button>
//                 </div>
//               </motion.div>
//             ))}
//           </motion.div>
//         ) : (
//           // List view
//           <motion.div
//             className='space-y-3'
//             variants={containerVariants}
//             initial='hidden'
//             animate='show'
//           >
//             {filteredData.map((blog) => (
//               <motion.div
//                 key={blog.id}
//                 variants={itemVariants}
//                 className='group flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30 transition-all duration-200'
//               >
//                 <div className='flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden relative'>
//                   {blog.imageUrl ? (
//                     <div className='w-full h-full relative'>
//                       <div
//                         className='w-full h-full bg-cover bg-center'
//                         style={{ backgroundImage: `url(${blog.imageUrl})` }}
//                         aria-label='Blog thumbnail'
//                       />
//                     </div>
//                   ) : (
//                     <div className='flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200'>
//                       <ArticleOutlinedIcon className='text-gray-300' />
//                     </div>
//                   )}
//                 </div>

//                 <div className='flex-grow'>
//                   <div className='flex items-center gap-2 mb-1'>
//                     <span className='bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-md font-medium'>
//                       Blog #{blog.id}
//                     </span>
//                   </div>
//                   <p className='text-gray-700 line-clamp-1 text-sm'>
//                     {blog.summary}
//                   </p>
//                 </div>

//                 <button
//                   onClick={() => handleViewBlog(blog)}
//                   className='flex-shrink-0 flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white w-10 h-10 rounded-full transition-colors'
//                 >
//                   <VisibilityOutlinedIcon fontSize='small' />
//                 </button>
//               </motion.div>
//             ))}
//           </motion.div>
//         )}

//         {/* Footer with pagination or stats */}
//         {!loading && filteredData.length > 0 && (
//           <div className='mt-8 pt-6 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500'>
//             <p>
//               Showing {filteredData.length} of {data.length} blogs
//             </p>
//           </div>
//         )}
//       </div>
//     </motion.section>
//   );
// }
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

interface Blog {
  id: number;
  summary: string;
  imageUrl: string;
}

// Add theme props to the component interface
interface BlogTableProps {
  theme: string;
  setTheme: (theme: string) => void;
}

export default function BlogTable({ theme, setTheme }: BlogTableProps) {
  const [data, setData] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const router = useRouter();

  const parseBackendData = (text?: string) => {
    if (!text || typeof text !== 'string') {
      console.warn('parseBackendData: received empty or invalid text');
      return { summary: 'No summary available', imageUrl: '' };
    }

    const summaryMatch = text.match(
      /\*\*Summary:\*\*\s*([\s\S]*?)(?=\*\*Image:|\n\n|\Z)/,
    );
    const imageMatch = text.match(/!\[.*?\]\((.*?)\)/);

    const summary = summaryMatch
      ? summaryMatch[1]
          .replace(/[\n\r]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
      : 'No summary found';
    const imageUrl = imageMatch ? imageMatch[1] : '';

    return { summary, imageUrl };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/humanize');
        const json = await res.json();

        const parsed = json.data.map((entry: any, index: number) => ({
          id: index + 1,
          ...parseBackendData(entry.humanize_Data),
        }));

        setData(parsed);
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

  const filteredData = data.filter((blog) =>
    blog.summary.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Animation variants
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
        {/* Header section */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8'>
          <div>
            <h2
              className={`text-2xl font-bold ${
                theme === 'dark'
                  ? 'text-transparent bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text'
                  : 'text-transparent bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text'
              }`}
            >
              Blogs
            </h2>
            <p
              className={`${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              } text-sm mt-1 transition-colors duration-300`}
            >
              Browse and discover interesting content
            </p>
          </div>

          {/* Search and filter */}
          <div className='flex flex-col sm:flex-row gap-3'>
            <div className='relative'>
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
                className={`pl-10 pr-4 py-2 rounded-xl ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30'
                    : 'bg-white border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
                } transition-all outline-none w-full`}
              />
            </div>

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
              {searchTerm
                ? 'Try adjusting your search term or check back later for new content.'
                : 'No blogs are available at the moment. Check back later for new content.'}
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
                </div>

                <div className='p-5'>
                  <p
                    className={`${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    } line-clamp-3 text-sm mb-4`}
                  >
                    {blog.summary}
                  </p>
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
                  <div className='flex items-center gap-2 mb-1'>
                    <span
                      className={`${
                        theme === 'dark'
                          ? 'bg-violet-900/40 text-violet-300'
                          : 'bg-violet-100 text-violet-700'
                      } text-xs px-2 py-0.5 rounded-md font-medium`}
                    >
                      Blog #{blog.id}
                    </span>
                  </div>
                  <p
                    className={`${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    } line-clamp-1 text-sm`}
                  >
                    {blog.summary}
                  </p>
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
