'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLPreElement>(null);

  const handleClick = async () => {
    if (!url) return;

    setLoading(true);
    setError('');
    setResult('');
    try {
      const parseRes = await fetch(`/api/parse?url=${encodeURIComponent(url)}`);
      if (!parseRes.ok) throw new Error('Failed to parse blog');

      const { csvData } = await parseRes.json();
      if (!csvData) throw new Error('No content found');

      const humanizeRes = await fetch('/api/humanize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: csvData }),
      });
      const humanized = await humanizeRes.json();
      setResult(humanized.summary || 'No result returned');
    } catch (err) {
      console.error(err);
      setError('Failed to process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (contentRef.current) {
      navigator.clipboard
        .writeText(contentRef.current.textContent || '')
        .then(() => alert('Copied!'))
        .catch(() => alert('Failed to copy.'));
    }
  };

  return (
    <section className='p-8 bg-white rounded-xl shadow-md py-14'>
      <div className='flex flex-col sm:flex-row justify-center items-center gap-4'>
        <input
          type='text'
          placeholder='Enter blog URL...'
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className='w-full sm:w-[60%] rounded-md border border-gray-400 p-2 text-black'
        />
        <button
          onClick={handleClick}
          className='bg-[#6366f1] hover:bg-[#7c3aed] text-sm text-white px-5 py-2 rounded-md'
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {error && <p className='mt-4 text-red-500 text-center'>{error}</p>}
      {result && !loading && (
        <div className='mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50'>
          <div className='flex justify-between items-center mb-2'>
            <h3 className='font-semibold text-sm text-gray-700'>Result</h3>
            <button
              onClick={copy}
              className='text-sm bg-[#6366f1] hover:bg-[#7c3aed] text-white px-3 py-1 rounded-md'
            >
              Copy
            </button>
          </div>
          <pre
            ref={contentRef}
            className='text-sm whitespace-pre-wrap break-words text-gray-800'
          >
            {result}
          </pre>
        </div>
      )}
    </section>
  );
}
