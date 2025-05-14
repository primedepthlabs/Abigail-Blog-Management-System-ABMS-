// 'use client';
// import React, { useEffect, useState } from 'react';

// interface BlogItem {
//   title: string;
//   description_text: string;
//   url: string;
//   thumbnail?: string;
//   date_published: string;
//   authors?: { name: string }[];
// }

// const Blogs: React.FC = () => {
//   const [blogs, setBlogs] = useState<BlogItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchBlogs = async () => {
//       try {
//         const res = await fetch('/api/humanize');
//         const json = await res.json();

//         if (!res.ok) {
//           throw new Error(json.error || 'Failed to load blogs');
//         }

//         const items = json?.data?.items_new || [];
//         setBlogs(items);
//       } catch (err: any) {
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchBlogs();
//   }, []);

//   if (loading) return <p className='p-4'>Loading blogs...</p>;
//   if (error) return <p className='p-4 text-red-500'>Error: {error}</p>;

//   return (
//     <div className='max-w-5xl mx-auto px-4 py-6'>
//       <h1 className='text-3xl font-bold mb-6'>Latest News</h1>
//       {blogs.length === 0 ? (
//         <p>No news articles found.</p>
//       ) : (
//         <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
//           {blogs.map((item, index) => (
//             <a
//               key={index}
//               href={item.url}
//               target='_blank'
//               rel='noopener noreferrer'
//               className='block border rounded-xl overflow-hidden hover:shadow-lg transition duration-300'
//             >
//               {item.thumbnail && (
//                 <img
//                   src={item.thumbnail}
//                   alt={item.title}
//                   className='w-full h-48 object-cover'
//                 />
//               )}
//               <div className='p-4'>
//                 <h2 className='text-lg font-semibold'>{item.title}</h2>
//                 <p className='text-sm text-gray-600 my-2'>
//                   {item.description_text}
//                 </p>
//                 <div className='text-xs text-gray-400 flex justify-between'>
//                   <span>{item.authors?.[0]?.name || 'Unknown Author'}</span>
//                   <span>
//                     {new Date(item.date_published).toLocaleDateString()}
//                   </span>
//                 </div>
//               </div>
//             </a>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default Blogs;
