'use client';
import { useRef, useState } from 'react';

export default function BlogSummarizer() {
  const [inputValue, setInputValue] = useState('');
  const [csvData, setCsvData] = useState('');
  const [isBlogLoading, setIsBlogLoading] = useState(false);
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLPreElement>(null);

  const handleSummarize = async () => {
    if (!inputValue) {
      setError('Please enter a URL');
      return;
    }
    setIsBlogLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/parse?url=${encodeURIComponent(inputValue)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCsvData(data.csvData);
      } else {
        setError('Failed to fetch Content');
      }
    } catch (error) {
      setError('An error occurred while fetching the content');
    } finally {
      setIsBlogLoading(false);
    }
  };

  const handleCopy = () => {
    const content = contentRef.current?.textContent;
    if (content) {
      navigator.clipboard
        .writeText(content)
        .then(() => alert('Copied!'))
        .catch(() => alert('Failed to copy.'));
    }
  };

  return (
    <section className='bg-white p-8 rounded-xl shadow-md py-14'>
      <div className='flex flex-col sm:flex-row justify-center items-center gap-4'>
        <input
          type='text'
          placeholder='Enter Url...'
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className='w-full sm:w-[60%] rounded-lg border border-gray-400 p-2 text-black'
        />
        <button
          onClick={handleSummarize}
          className='bg-[#6366f1] hover:bg-[#7c3aed] text-white px-5 py-2 rounded-md'
          disabled={isBlogLoading}
        >
          {isBlogLoading ? 'Processing...' : 'Summarize'}
        </button>
      </div>

      {isBlogLoading && (
        <p className='mt-4 text-center text-indigo-500'>Loading...</p>
      )}
      {error && <div className='text-red-500 mt-2'>{error}</div>}

      {csvData && !isBlogLoading && (
        <div className='mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50'>
          <div className='flex justify-between items-center mb-2'>
            <h3 className='font-semibold text-sm text-gray-700'>Result</h3>
            <button
              onClick={handleCopy}
              className='text-sm bg-[#6366f1] hover:bg-[#7c3aed] text-white px-3 py-1 rounded-md'
            >
              Copy
            </button>
          </div>
          <pre
            ref={contentRef}
            className='text-sm whitespace-pre-wrap break-words text-gray-800'
          >
            {csvData}
          </pre>
        </div>
      )}
    </section>
  );
}
