'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function BlogTable() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // const parseBackendData = (text?: string) => {
  //   if (!text || typeof text !== 'string')
  //     return { summary: 'No summary', imageUrl: '' };

  //   const summaryMatch = text.match(
  //     /\*\*Summary:\*\*\s*([\s\S]*?)(?=\n\n|\*\*Image:|\Z)/,
  //   );
  //   const imageMatch = text.match(/!\[.*?\]\((.*?)\)/);

  //   const summary = summaryMatch
  //     ? summaryMatch[1].replace(/\n+/g, ' ').trim()
  //     : 'No summary found';
  //   const imageUrl = imageMatch ? imageMatch[1] : '';
  //   return { summary, imageUrl };
  // };

  const parseBackendData = (text?: string) => {
    if (!text || typeof text !== 'string') {
      console.warn('parseBackendData: received empty or invalid text');
      return { summary: 'No summary available', imageUrl: '' };
    }

    const summaryMatch = text.match(
      /\*\*Summary:\*\*\s*([\s\S]*?)(?=\*\*Image:|\n\n|\Z)/,
    );
    const imageMatch = text.match(/!\[.*?\]\((.*?)\)/);

    let summary = summaryMatch ? summaryMatch[1] : 'No summary found';

    // Remove all newline characters and trim excess whitespace
    summary = summary
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const imageUrl = imageMatch ? imageMatch[1] : '';

    return { summary, imageUrl };
  };

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/humanize');
      const json = await res.json();

      if (!res.ok) {
        setData([]);
      } else {
        const parsed = json.data.map((entry: any, index: number) => ({
          id: index + 1,
          ...parseBackendData(entry.humanize_Data),
        }));
        setData(parsed);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleViewBlog = (blog: any) => {
    localStorage.setItem('selectedBlog', JSON.stringify(blog));
    router.push(`/ViewBlog/${blog.id}`);
  };

  return (
    <section className='bg-white p-8 cursor-default rounded-xl shadow-md py-14'>
      {loading ? (
        <p className='text-center text-indigo-500'>Loading...</p>
      ) : (
        <table className='w-full text-left border'>
          <thead className='bg-gray-200'>
            <tr>
              <th className='px-4 py-2'>#</th>
              <th className='px-4 py-2'>Blogs</th>
              <th className='px-4 py-2'>View</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => (
              <tr key={index} className='border-t'>
                <td className='px-4 py-2'>{entry.id}</td>
                <td className='px-4 py-2 truncate  max-w-[300px]'>
                  {entry.summary.slice(0, 100)}
                </td>
                <td className='px-4 py-2'>
                  <button
                    onClick={() => handleViewBlog(entry)}
                    className='bg-violet-600 text-white text-xs px-4 py-1 rounded hover:bg-violet-700'
                  >
                    View Blog
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
