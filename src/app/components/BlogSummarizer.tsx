// // import { useRef, useState } from 'react';

// // export default function BlogSummarizer() {
// //   const [inputValue, setInputValue] = useState('');
// //   const [csvData, setCsvData] = useState('');
// //   const [htmlContent, setHtmlContent] = useState('');
// //   const [imageUrls, setImageUrls] = useState([]);
// //   const [imageCount, setImageCount] = useState(0);
// //   const [isBlogLoading, setIsBlogLoading] = useState(false);
// //   const [error, setError] = useState('');
// //   const [selectedView, setSelectedView] = useState('html');
// //   const contentRef = useRef<HTMLPreElement>(null);

// //   const handleSummarize = async () => {
// //     if (!inputValue) {
// //       setError('Please enter a URL');
// //       return;
// //     }
// //     setIsBlogLoading(true);
// //     setError('');
// //     try {
// //       const res = await fetch(
// //         `/api/parse?url=${encodeURIComponent(inputValue)}`,
// //       );
// //       if (res.ok) {
// //         const data = await res.json();
// //         setCsvData(data.csvData);
// //         setHtmlContent(data.htmlContent);
// //         setImageUrls(data.images || []);
// //         setImageCount(data.imageCount || 0);
// //       } else {
// //         setError('Failed to fetch content');
// //       }
// //     } catch (error) {
// //       setError('An error occurred while fetching the content');
// //     } finally {
// //       setIsBlogLoading(false);
// //     }
// //   };

// //   const handleCopy = () => {
// //     const content = contentRef.current?.textContent;
// //     if (content) {
// //       navigator.clipboard
// //         .writeText(content)
// //         .then(() => alert('Copied!'))
// //         .catch(() => alert('Failed to copy.'));
// //     }
// //   };
// //   const handleSweetCopy = () => {
// //     const articleContent = contentRef.current?.textContent;
// //     if (articleContent) {
// //       navigator.clipboard
// //         .writeText(articleContent)
// //         .then(() => alert('Captured'))
// //         .catch(() => alert('failed to copy.'));
// //     }
// //   };

// //   return (
// //     <section className='bg-white p-8 rounded-xl shadow-md py-14'>
// //       <div className='flex flex-col sm:flex-row justify-center items-center gap-4'>
// //         <input
// //           type='text'
// //           placeholder='Enter URL...'
// //           value={inputValue}
// //           onChange={(e) => setInputValue(e.target.value)}
// //           className='w-full sm:w-[60%] rounded-lg border border-gray-400 p-2 text-black'
// //         />
// //         <button
// //           onClick={handleSummarize}
// //           className='bg-[#6366f1] hover:bg-[#7c3aed] text-white px-5 py-2 rounded-md'
// //           disabled={isBlogLoading}
// //         >
// //           {isBlogLoading ? 'Processing...' : 'Summarize'}
// //         </button>
// //       </div>

// //       {isBlogLoading && (
// //         <p className='mt-4 text-center text-indigo-500'>Loading...</p>
// //       )}
// //       {error && <div className='text-red-500 mt-2'>{error}</div>}

// //       {(csvData || htmlContent) && !isBlogLoading && (
// //         <div className='mt-6'>
// //           <select
// //             value={selectedView}
// //             onChange={(e) => setSelectedView(e.target.value)}
// //             className='mb-4 outline-none cursor-pointer border m-2 text-xs rounded-md'
// //           >
// //             <option value='csv'>CSV</option>
// //             <option value='html'>Conditioned</option>
// //           </select>
// //         </div>
// //       )}

// //       {selectedView === 'csv' && csvData && (
// //         <div className='mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50'>
// //           <div className='flex justify-between items-center mb-2'>
// //             <h3 className='font-semibold text-sm text-gray-700'>CSV Data</h3>
// //             <button
// //               onClick={handleCopy}
// //               className='text-sm bg-[#6366f1] hover:bg-[#7c3aed] text-white px-3 py-1 rounded-md'
// //             >
// //               Copy
// //             </button>
// //           </div>
// //           <pre
// //             ref={contentRef}
// //             className='text-sm whitespace-pre-wrap break-words text-green-800'
// //           >
// //             {csvData}
// //           </pre>
// //         </div>
// //       )}

// //       {selectedView === 'html' && htmlContent && (
// //         <div className='mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50'>
// //           <div className='flex justify-between items-center mb-2'>
// //             <h3 className='font-semibold text-lg mb-4'>Article Content</h3>
// //             <button
// //               onClick={handleSweetCopy}
// //               className='text-sm bg-[#6366f1] hover:bg-[#7c3aed] text-white px-3 py-1 rounded-md'
// //             >
// //               Capture
// //             </button>
// //           </div>
// //           <div
// //             className='article-content'
// //             dangerouslySetInnerHTML={{ __html: htmlContent }}
// //           />
// //         </div>
// //       )}
// //     </section>
// //   );

// 'use client';
// import { useEffect, useState } from 'react';

// type Author = {
//   name: string;
// };

// type Article = {
//   url: string;
//   title: string;
//   description_text: string;
//   thumbnail: string;
//   date_published: string;
//   authors: Author[];
// };

// type Feed = {
//   id: string;
//   title: string;
//   source_url: string;
//   rss_feed_url: string;
//   description: string;
//   icon: string;
// };

// type WebhookData = {
//   id: string;
//   type: string;
//   feed: Feed;
//   data: {
//     items_new: Article[];
//     items_changed: Article[];
//   };
// };

// export default function BlogSummarizer() {
//   const [articles, setArticles] = useState<Article[]>([]);
//   const [feed, setFeed] = useState<Feed | null>(null);

//   useEffect(() => {
//     const fetchArticles = async () => {
//       try {
//         // Fetching from your API endpoint or directly from the webhook payload
//         const res = await fetch('/api/humanize');
//         const json: WebhookData = await res.json();

//         console.log('Fetched data:', json); // Log the full data

//         // Set the feed data
//         setFeed(json.feed);

//         // Get all articles from `items_new` (you can also include `items_changed` if needed)
//         const items = json.data.items_new;
//         setArticles(items);
//       } catch (err) {
//         console.error('Error fetching articles:', err);
//       }
//     };

//     fetchArticles();
//   }, []);

//   if (!articles.length)
//     return <div className='p-6 text-gray-600'>No news articles found.</div>;

//   return (
//     <div className='p-6'>
//       {/* Displaying the feed information */}
//       {feed && (
//         <div className='bg-gray-100 p-4 rounded-md mb-6'>
//           <h2 className='text-2xl font-bold'>{feed.title}</h2>
//           <p>{feed.description}</p>
//           <a href={feed.source_url} target='_blank' rel='noopener noreferrer'>
//             Read More
//           </a>
//           <img src={feed.icon} alt='Feed Icon' className='w-16 h-16 mt-4' />
//         </div>
//       )}

//       {/* Displaying all articles */}
//       <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
//         {articles.map((article, idx) => (
//           <div
//             key={idx}
//             className='bg-white shadow-md rounded-2xl overflow-hidden transition hover:shadow-lg'
//           >
//             <a href={article.url} target='_blank' rel='noopener noreferrer'>
//               <img
//                 src={article.thumbnail}
//                 alt={article.title}
//                 className='w-full h-48 object-cover'
//               />
//               <div className='p-4'>
//                 <h3 className='text-lg font-semibold text-blue-700 hover:underline'>
//                   {article.title}
//                 </h3>
//                 <p className='text-sm text-gray-700 mt-2'>
//                   {article.description_text}
//                 </p>
//                 <div className='text-xs text-gray-500 mt-3'>
//                   {article.authors?.[0]?.name} —{' '}
//                   {new Date(article.date_published).toLocaleDateString()}
//                 </div>
//               </div>
//             </a>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }
