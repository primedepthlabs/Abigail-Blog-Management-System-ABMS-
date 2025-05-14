// // 'use client';

// // import { useRef,useState } from 'react';

// // export default function Home() {
// //   const [url, setUrl] = useState('');
// //   const [result, setResult] = useState('');
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState('');
// //   const contentRef = useRef<HTMLPreElement>(null);

// //   const handleClick = async () => {
// //     if (!url) return;

// //     setLoading(true);
// //     setError('');
// //     setResult('');
// //     try {
// //       const parseRes = await fetch(`/api/parse?url=${encodeURIComponent(url)}`);
// //       if (!parseRes.ok) throw new Error('Failed to parse blog');

// //       const { csvData } = await parseRes.json();
// //       if (!csvData) throw new Error('No content found');

// //       const humanizeRes = await fetch('/api/humanize', {
// //         method: 'POST',
// //         headers: {
// //           'Content-Type': 'application/json',
// //         },
// //         body: JSON.stringify({ id: 2, input: csvData }),
// //       });
// //       const humanized = await humanizeRes.json();
// //       setResult(humanized.summary || 'No result returned');
// //     } catch (err) {
// //       console.error(err);
// //       setError('Failed to process. Please try again.');
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const copy = () => {
// //     if (contentRef.current) {
// //       navigator.clipboard
// //         .writeText(contentRef.current.textContent || '')
// //         .then(() => alert('Copied!'))
// //         .catch(() => alert('Failed to copy.'));
// //     }
// //   };

// //   return (
// //     <section className='p-8 bg-white rounded-xl shadow-md py-14'>
// //       <div className='flex flex-col sm:flex-row justify-center items-center gap-4'>
// //         <input
// //           type='text'
// //           placeholder='Enter blog URL...'
// //           value={url}
// //           onChange={(e) => setUrl(e.target.value)}
// //           className='w-full sm:w-[60%] rounded-md border border-gray-400 p-2 text-black'
// //         />
// //         <button
// //           onClick={handleClick}
// //           className='bg-[#6366f1] hover:bg-[#7c3aed] text-sm text-white px-5 py-2 rounded-md'
// //           disabled={loading}
// //         >
// //           {loading ? 'Generating...' : 'Generate'}
// //         </button>
// //       </div>
// //       {error && <p className='mt-4 text-red-500 text-center'>{error}</p>}
// //       {result && !loading && (
// //         <div className='mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50'>
// //           <div className='flex justify-between items-center mb-2'>
// //             <h3 className='font-semibold text-sm text-gray-700'>Result</h3>
// //             <button
// //               onClick={copy}
// //               className='text-sm bg-[#6366f1] hover:bg-[#7c3aed] text-white px-3 py-1 rounded-md'
// //             >
// //               Copy
// //             </button>
// //           </div>
// //           <pre
// //             ref={contentRef}
// //             className='text-sm whitespace-pre-wrap break-words text-gray-800'
// //           >
// //             {result}
// //           </pre>
// //         </div>
// //       )}
// //     </section>
// //   );
// // }
// 'use client';

// import { useRef, useState } from 'react';
// import { AlertCircle, CheckCircle, ClipboardCopy, Loader2 } from 'lucide-react';

// export default function Home() {
//   const [url, setUrl] = useState('');
//   const [result, setResult] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [copied, setCopied] = useState(false);
//   const contentRef = useRef<HTMLPreElement>(null);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!url.trim()) return;

//     setLoading(true);
//     setError('');
//     setResult('');
//     setCopied(false);

//     try {
//       const parseRes = await fetch(
//         `/api/parse?url=${encodeURIComponent(url.trim())}`,
//       );

//       if (!parseRes.ok) {
//         const errorData = await parseRes.json();
//         throw new Error(errorData.message || 'Failed to parse blog');
//       }

//       const { csvData } = await parseRes.json();
//       if (!csvData) throw new Error('No content found in the blog');

//       const humanizeRes = await fetch('/api/humanize', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ id: 2, input: csvData }),
//       });

//       if (!humanizeRes.ok) {
//         const errorData = await humanizeRes.json();
//         throw new Error(errorData.message || 'Failed to humanize content');
//       }

//       const humanized = await humanizeRes.json();
//       setResult(humanized.summary || 'No result returned');
//     } catch (err) {
//       console.error(err);
//       setError(
//         err instanceof Error
//           ? err.message
//           : 'Failed to process. Please try again.',
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const copyToClipboard = () => {
//     if (contentRef.current) {
//       navigator.clipboard
//         .writeText(contentRef.current.textContent || '')
//         .then(() => {
//           setCopied(true);
//           setTimeout(() => setCopied(false), 2000);
//         })
//         .catch(() => setError('Failed to copy to clipboard'));
//     }
//   };

//   return (
//     <div className='flex flex-col items-center min-h-screen bg-gray-50 p-4'>
//       <div className='w-full max-w-3xl'>
//         <div className='bg-white rounded-xl shadow-lg p-6 md:p-8'>
//           <h1 className='text-2xl font-bold text-gray-800 mb-6 text-center'>
//             Blog Content Analyzer
//           </h1>

//           <form onSubmit={handleSubmit} className='space-y-4'>
//             <div className='flex flex-col md:flex-row gap-4'>
//               <div className='flex-grow'>
//                 <label
//                   htmlFor='url-input'
//                   className='block text-sm font-medium text-gray-700 mb-1'
//                 >
//                   Blog URL
//                 </label>
//                 <input
//                   id='url-input'
//                   type='url'
//                   placeholder='https://example.com/blog-post'
//                   value={url}
//                   onChange={(e) => setUrl(e.target.value)}
//                   className='w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition'
//                   disabled={loading}
//                 />
//               </div>
//               <div className='flex items-end'>
//                 <button
//                   type='submit'
//                   className='w-full md:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-white font-medium rounded-lg transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center'
//                   disabled={loading || !url.trim()}
//                 >
//                   {loading ? (
//                     <>
//                       <Loader2 className='w-4 h-4 mr-2 animate-spin' />
//                       Processing...
//                     </>
//                   ) : (
//                     'Analyze'
//                   )}
//                 </button>
//               </div>
//             </div>
//           </form>

//           {/* Error message */}
//           {error && (
//             <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start'>
//               <AlertCircle className='w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5' />
//               <p className='text-red-700 text-sm'>{error}</p>
//             </div>
//           )}

//           {/* Results section */}
//           {result && !loading && (
//             <div className='mt-6 border border-gray-200 rounded-lg overflow-hidden'>
//               <div className='flex justify-between items-center px-4 py-3 bg-gray-100 border-b border-gray-200'>
//                 <h3 className='font-medium text-gray-700'>Analysis Result</h3>
//                 <button
//                   onClick={copyToClipboard}
//                   className='inline-flex items-center text-sm px-3 py-1 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-md border border-gray-300 transition'
//                   disabled={copied}
//                 >
//                   {copied ? (
//                     <>
//                       <CheckCircle className='w-4 h-4 mr-1.5 text-green-500' />
//                       Copied
//                     </>
//                   ) : (
//                     <>
//                       <ClipboardCopy className='w-4 h-4 mr-1.5' />
//                       Copy
//                     </>
//                   )}
//                 </button>
//               </div>
//               <div className='p-4 bg-white'>
//                 <pre
//                   ref={contentRef}
//                   className='text-sm whitespace-pre-wrap break-words text-gray-800 max-h-96 overflow-y-auto'
//                 >
//                   {result}
//                 </pre>
//               </div>
//             </div>
//           )}

//           {/* Loading state */}
//           {loading && (
//             <div className='mt-6 flex justify-center'>
//               <div className='flex flex-col items-center p-8'>
//                 <Loader2 className='w-10 h-10 text-indigo-600 animate-spin mb-4' />
//                 <p className='text-gray-600'>Analyzing blog content...</p>
//               </div>
//             </div>
//           )}

//           <footer className='mt-8 pt-4 border-t border-gray-200 text-center'>
//             <p className='text-sm text-gray-500'>
//               Enter a blog URL above to analyze and summarize its content
//             </p>
//           </footer>
//         </div>
//       </div>
//     </div>
//   );
// }
'use client';

import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ClipboardCopy, Loader2 } from 'lucide-react';

// Receive theme as a prop instead of using context
interface HomeProps {
  theme: string;
  setTheme?: (theme: string) => void; // Optional since we may not need to change the theme in this component
}

export default function Home({ theme }: HomeProps) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLPreElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setResult('');
    setCopied(false);

    try {
      const parseRes = await fetch(
        `/api/parse?url=${encodeURIComponent(url.trim())}`,
      );

      if (!parseRes.ok) {
        const errorData = await parseRes.json();
        throw new Error(errorData.message || 'Failed to parse blog');
      }

      const { csvData } = await parseRes.json();
      if (!csvData) throw new Error('No content found in the blog');

      const humanizeRes = await fetch('/api/humanize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: 2, input: csvData }),
      });

      if (!humanizeRes.ok) {
        const errorData = await humanizeRes.json();
        throw new Error(errorData.message || 'Failed to humanize content');
      }

      const humanized = await humanizeRes.json();
      setResult(humanized.summary || 'No result returned');
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (contentRef.current) {
      navigator.clipboard
        .writeText(contentRef.current.textContent || '')
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => setError('Failed to copy to clipboard'));
    }
  };

  return (
    <div className='w-full h-full'>
      <div
        className={`rounded-xl shadow-lg p-6 md:p-8 ${
          theme === 'dark' ? 'bg-gray-800/90' : 'bg-white'
        }`}
      >
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='flex flex-col md:flex-row gap-4'>
            <div className='flex-grow'>
              <label
                htmlFor='url-input'
                className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Blog URL
              </label>
              <input
                id='url-input'
                type='url'
                placeholder='https://example.com/blog-post'
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg outline-none transition ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    : 'border-gray-300 text-black focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                disabled={loading}
              />
            </div>
            <div className='flex items-end'>
              <button
                type='submit'
                className={`w-full md:w-auto px-5 py-2 font-medium rounded-lg transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center ${
                  theme === 'dark'
                    ? 'bg-indigo-600 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-white'
                }`}
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Processing...
                  </>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Error message */}
        {error && (
          <div
            className={`mt-6 p-4 rounded-lg flex items-start ${
              theme === 'dark'
                ? 'bg-red-900/30 border border-red-700'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <AlertCircle
              className={`w-5 h-5 mr-2 flex-shrink-0 mt-0.5 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-500'
              }`}
            />
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-red-300' : 'text-red-700'
              }`}
            >
              {error}
            </p>
          </div>
        )}

        {/* Results section */}
        {result && !loading && (
          <div
            className={`mt-6 border rounded-lg overflow-hidden ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div
              className={`flex justify-between items-center px-4 py-3 border-b ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600'
                  : 'bg-gray-100 border-gray-200'
              }`}
            >
              <h3
                className={`font-medium ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                }`}
              >
                Analysis Result
              </h3>
              <button
                onClick={copyToClipboard}
                className={`inline-flex items-center text-sm px-3 py-1 font-medium rounded-md border transition ${
                  theme === 'dark'
                    ? 'bg-gray-600 hover:bg-gray-500 text-gray-200 border-gray-500'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                }`}
                disabled={copied}
              >
                {copied ? (
                  <>
                    <CheckCircle className='w-4 h-4 mr-1.5 text-green-500' />
                    Copied
                  </>
                ) : (
                  <>
                    <ClipboardCopy className='w-4 h-4 mr-1.5' />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div
              className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
            >
              <pre
                ref={contentRef}
                className={`text-sm whitespace-pre-wrap break-words max-h-96 overflow-y-auto ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                {result}
              </pre>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className='mt-6 flex justify-center'>
            <div className='flex flex-col items-center p-8'>
              <Loader2
                className={`w-10 h-10 animate-spin mb-4 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-indigo-600'
                }`}
              />
              <p
                className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
              >
                Analyzing blog content...
              </p>
            </div>
          </div>
        )}

        <footer
          className={`mt-8 pt-4 border-t text-center ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <p
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            Enter a blog URL above to analyze and summarize its content
          </p>
        </footer>
      </div>
    </div>
  );
}
