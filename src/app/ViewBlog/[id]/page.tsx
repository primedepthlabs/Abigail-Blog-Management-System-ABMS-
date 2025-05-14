'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ViewBlog() {
  const router = useRouter();
  const [blog, setBlog] = useState<{
    summary: string;
    imageUrl: string;
  } | null>(null);
  console.log(blog?.summary);

  useEffect(() => {
    const stored = localStorage.getItem('selectedBlog');
    if (stored) {
      setBlog(JSON.parse(stored));
    }
  }, []);

  if (!blog) {
    return (
      <p className='text-center mt-10 text-red-500'>No blog data found.</p>
    );
  }

  return (
    <section className='max-w-3xl mx-auto p-6'>
      <button
        className='mb-4 px-4 py-1 text-xs bg-gray-300 hover:bg-gray-400 rounded'
        onClick={() => router.back()}
      >
        ← Back
      </button>

      <div className='bg-white shadow-lg rounded-xl p-6'>
        <p className='text-gray-800  text-lg'>{blog.summary}</p>
        {blog.imageUrl && (
          <img
            src={blog.imageUrl}
            alt='Blog visual'
            className='mt-6 w-full h-auto rounded-md shadow'
          />
        )}
      </div>
    </section>
  );
}
