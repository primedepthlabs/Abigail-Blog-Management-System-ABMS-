'use client';

import { useState } from 'react';

export default function Humanizer() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!input) return;
    setLoading(true);

    try {
      const response = await fetch('/api/humanize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
        }),
      });

      const data = await response.json();
      setResult(data.summary || 'No content generated');
    } catch (error) {
      console.error('Humanizer error:', error);
      setResult('Error generating content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className='bg-white p-8 rounded-xl shadow-md py-14'>
      <div className='flex flex-col sm:flex-row justify-center items-center gap-4'>
        <input
          type='text'
          placeholder='Enter text...'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className='w-full sm:w-[60%] rounded-md border border-gray-400 p-2 text-black'
        />
        <button
          onClick={handleClick}
          className='bg-[#6366f1] hover:bg-[#7c3aed] text-white px-5 py-2 rounded-md'
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Humanize'}
        </button>
      </div>
      {loading && (
        <p className='mt-4 text-center text-indigo-500'>Loading...</p>
      )}
      {result && !loading && (
        <div className='mt-6 p-4 bg-gray-100 border border-gray-300 rounded-md text-gray-700 whitespace-pre-wrap'>
          {result}
        </div>
      )}
    </section>
  );
}
