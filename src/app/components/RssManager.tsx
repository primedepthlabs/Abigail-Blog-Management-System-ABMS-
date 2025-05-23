'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Rss,
  Plus,
  Loader2,
  ExternalLink,
  RefreshCw,
  Calendar,
  Info,
  X,
  CheckCircle2,
} from 'lucide-react';
import supabase from '@/lib/supabaseClient';

interface RssManagerProps {
  theme: string;
  setTheme?: (theme: string) => void;
}

interface FeedRecord {
  id: number;
  created_at: string;
  feed_url: string;
}

interface FeedItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  content?: string;
}

// Processing status types
interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  currentItemTitle: string;
}

export default function RssManager({ theme }: RssManagerProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [feeds, setFeeds] = useState<FeedRecord[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState('');
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showDescription, setShowDescription] = useState<{
    [key: number]: boolean;
  }>({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedFeedDetails, setSelectedFeedDetails] = useState<{
    id: number;
    url: string;
  } | null>(null);

  // New state for tracking feed processing status
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentStep: '',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    currentItemTitle: '',
  });

  const loadFeeds = async () => {
    setLoadingFeeds(true);
    try {
      // This endpoint should query the rss_feeds table
      const res = await supabase.from('rss_feeds').select('*');
      setFeeds(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load feed list');
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    loadFeeds();
  }, []);

  // Simulate processing progress - for demo purposes

  const addFeed = async () => {
    if (!feedUrl.trim()) return;
    try {
      setError('');

      // Start the processing UI simulation
      setProcessingStatus({
        isProcessing: true,
        currentStep: 'Fetching RSS Feed URLS and Humanizing them with AI',
        progress: 10,
        totalItems: 0,
        processedItems: 0,
        currentItemTitle: '',
      });

      // This endpoint should insert into the rss_feeds table
      const res = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: feedUrl.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add feed');
      setFeedUrl('');
      loadFeeds();
      setProcessingStatus({
        isProcessing: false,
        currentStep: 'Fetching RSS Feed',
        progress: 10,
        totalItems: 0,
        processedItems: 0,
        currentItemTitle: '',
      });
    } catch (err) {
      console.error(err);
      setError('Error adding feed URL');

      // Reset processing status on error
      setProcessingStatus({
        isProcessing: false,
        currentStep: '',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        currentItemTitle: '',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeed();
    }
  };

  const selectFeed = async (url: string) => {
    setSelectedFeed(url);
    setFeedItems([]);
    setLoadingItems(true);
    setError('');
    setShowDescription({});
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Failed to fetch feed items');
      const data = await res.json();
      setFeedItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setError('Error fetching feed items');
    } finally {
      setLoadingItems(false);
    }
  };

  const viewFeedDetails = (id: number, url: string) => {
    setSelectedFeedDetails({ id, url });
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedFeedDetails(null);
  };

  const toggleDescription = (idx: number) => {
    setShowDescription((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  const ProcessingProgressUI = () => {
    const {
      isProcessing,
      currentStep,
      progress,
      totalItems,
      processedItems,
      currentItemTitle,
    } = processingStatus;

    if (!isProcessing) return null;

    return (
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6'>
        <div className='bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-800'>
          <h3 className='text-xl font-semibold text-white mb-4 flex items-center'>
            <Rss className='mr-2 h-5 w-5 text-blue-400' />
            Processing RSS Feed
          </h3>

          <div className='mb-5'>
            <div className='flex justify-between mb-2'>
              <span className='text-blue-400 animate-pulse font-medium'>
                {currentStep}
              </span>
            </div>
          </div>

          {totalItems > 0 && (
            <div className='mb-4'>
              <div className='text-gray-300 mb-2 text-sm flex justify-between'>
                <span>Processing items</span>
                <span>
                  {processedItems} of {totalItems}
                </span>
              </div>

              <div className='bg-gray-800 rounded-lg p-3 border border-gray-700'>
                {currentStep === 'Completed' ? (
                  <div className='flex items-center text-green-400'>
                    <CheckCircle2 className='h-5 w-5 mr-2' />
                    <span>All items processed successfully</span>
                  </div>
                ) : (
                  <>
                    <div className='flex items-center mb-2'>
                      <Loader2 className='h-4 w-4 mr-2 text-blue-400 animate-spin' />
                      <span className='text-gray-300 truncate'>
                        {currentItemTitle || 'Processing...'}
                      </span>
                    </div>
                    <div className='text-xs text-gray-500'>
                      {currentStep === 'Extracting Blog Posts'
                        ? 'Parsing and humanizing content'
                        : currentStep === 'Saving to Database'
                        ? 'Writing processed data to database'
                        : 'Working...'}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {currentStep === 'Completed' ? (
            <div className='bg-green-900/30 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center'>
              <CheckCircle2 className='h-5 w-5 mr-2' />
              <span>
                RSS feed successfully processed and added to your collection
              </span>
            </div>
          ) : (
            <div className='text-gray-400 text-sm italic'>
              Please wait while we extract and process the blog content...
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-screen text-gray-100'>
      {/* Processing Progress UI */}
      <ProcessingProgressUI />

      <div className='container mx-auto p-4'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold text-white mb-2'>
            RSS Feed Reader
          </h1>
          <p className='text-gray-400'>
            Stay updated with your favorite content
          </p>
        </header>

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Left column - Feed management */}
          <div className='lg:col-span-1'>
            <div className='bg-gray-900 rounded-xl p-5 shadow-lg mb-6'>
              <h2 className='text-xl font-semibold mb-4 flex items-center'>
                <Rss className='mr-2 h-5 w-5 text-blue-400' />
                Feed Sources
              </h2>

              <div className='mb-6'>
                <div className='relative mb-2'>
                  <input
                    type='url'
                    placeholder='Enter RSS feed URL'
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className='w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200'
                    disabled={processingStatus.isProcessing}
                  />
                  <div className='absolute inset-y-0 right-0 pr-3 flex items-center'>
                    <Search className='h-5 w-5 text-gray-500' />
                  </div>
                </div>
                <button
                  onClick={addFeed}
                  disabled={processingStatus.isProcessing || !feedUrl.trim()}
                  className={`w-full bg-blue-600 text-white font-medium rounded-lg py-3 px-4 flex items-center justify-center transition-all duration-200 ${
                    processingStatus.isProcessing || !feedUrl.trim()
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-blue-700'
                  }`}
                >
                  {processingStatus.isProcessing ? (
                    <>
                      <Loader2 className='h-5 w-5 mr-2 animate-spin' />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className='h-5 w-5 mr-2' />
                      Add Feed
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className='bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm flex items-start'>
                  <Info className='h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-red-400' />
                  <span>{error}</span>
                </div>
              )}

              <div className='mt-4'>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='font-medium text-gray-300'>Your Feeds</h3>
                  <button
                    onClick={loadFeeds}
                    className='text-blue-400 hover:text-blue-300 p-1 rounded-full hover:bg-blue-900/20 transition-colors'
                    title='Refresh feeds'
                    disabled={loadingFeeds || processingStatus.isProcessing}
                  >
                    {loadingFeeds ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <RefreshCw className='h-4 w-4' />
                    )}
                  </button>
                </div>

                {loadingFeeds ? (
                  <div className='space-y-2'>
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className='bg-gray-800/50 rounded-lg p-3 animate-pulse h-14'
                      ></div>
                    ))}
                  </div>
                ) : feeds.length ? (
                  <div className='space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar'>
                    {feeds.map((feed) => (
                      <div
                        key={feed.id}
                        className={`p-3 rounded-lg transition-all duration-200 flex items-center group ${
                          selectedFeed === feed.feed_url
                            ? 'bg-blue-600/20 border border-blue-500/40'
                            : 'bg-gray-800 border border-transparent hover:border-gray-700 hover:bg-gray-800/80'
                        }`}
                      >
                        <div
                          className='flex items-center flex-1 cursor-pointer'
                          onClick={() => selectFeed(feed.feed_url)}
                        >
                          <Rss
                            className={`h-4 w-4 mr-3 flex-shrink-0 ${
                              selectedFeed === feed.feed_url
                                ? 'text-blue-400'
                                : 'text-gray-500 group-hover:text-gray-400'
                            }`}
                          />
                          <div className='truncate text-sm'>
                            {truncateUrl(feed.feed_url)}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            viewFeedDetails(feed.id, feed.feed_url)
                          }
                          className='ml-2 text-gray-400 hover:text-blue-400 p-1 rounded-full hover:bg-blue-900/20 transition-colors'
                          title='View details'
                        >
                          <Info className='h-4 w-4' />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='bg-gray-800/30 rounded-lg p-4 text-center text-gray-400 text-sm'>
                    <Rss className='h-5 w-5 mx-auto mb-2 opacity-50' />
                    No feeds added yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column - Feed content */}
          <div className='lg:col-span-3'>
            {selectedFeed ? (
              <div className='bg-gray-900 rounded-xl p-5 shadow-lg min-h-[400px]'>
                <div className='mb-6 border-b border-gray-800 pb-4'>
                  <h2 className='text-xl font-semibold mb-2 flex items-center truncate'>
                    <Rss className='mr-2 h-5 w-5 text-blue-400 flex-shrink-0' />
                    <span className='truncate'>{selectedFeed}</span>
                  </h2>
                  <div className='text-sm text-gray-400 flex items-center'>
                    <span>{feedItems.length} articles</span>
                    {loadingItems && (
                      <div className='ml-3 flex items-center text-blue-400'>
                        <Loader2 className='h-3 w-3 mr-1 animate-spin' />
                        Loading...
                      </div>
                    )}
                  </div>
                </div>

                {loadingItems ? (
                  <div className='space-y-6'>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className='animate-pulse'>
                        <div className='h-7 bg-gray-800/70 rounded w-3/4 mb-3'></div>
                        <div className='h-4 bg-gray-800/50 rounded w-1/4 mb-4'></div>
                        <div className='space-y-2'>
                          <div className='h-4 bg-gray-800/30 rounded'></div>
                          <div className='h-4 bg-gray-800/30 rounded w-5/6'></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : feedItems.length > 0 ? (
                  <div className='space-y-8'>
                    {feedItems.map((item, idx) => (
                      <div key={idx} className='group'>
                        <article className='p-5 rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-gray-700 transition-all duration-200'>
                          <header className='mb-3'>
                            <a
                              href={item.link}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='group-hover:text-blue-400 font-medium text-lg inline-flex items-start transition-colors duration-200'
                            >
                              {item.title}
                              <ExternalLink className='h-4 w-4 ml-2 mt-1 opacity-70' />
                            </a>

                            {item.pubDate && (
                              <div className='flex items-center text-sm text-gray-500 mt-2'>
                                <Calendar className='h-3 w-3 mr-1' />
                                {formatDate(item.pubDate)}
                              </div>
                            )}
                          </header>

                          {(item.description || item.content) && (
                            <div className='mt-3'>
                              <button
                                onClick={() => toggleDescription(idx)}
                                className='text-sm text-blue-400 hover:text-blue-300 transition-colors mb-2 flex items-center'
                              >
                                {showDescription[idx]
                                  ? 'Hide description'
                                  : 'Show description'}
                              </button>

                              {showDescription[idx] && (
                                <div
                                  className='mt-2 text-gray-300 text-sm prose prose-invert max-w-none prose-sm overflow-hidden rounded-lg custom-scrollbar'
                                  style={{
                                    maxHeight: '400px',
                                    overflowY: 'auto',
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html:
                                      item.description || item.content || '',
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </article>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-16'>
                    <div className='mx-auto w-16 h-16 mb-4 rounded-full bg-gray-800/50 flex items-center justify-center'>
                      <Rss className='h-8 w-8 text-gray-600' />
                    </div>
                    <h3 className='text-xl font-medium text-gray-400 mb-2'>
                      No articles found
                    </h3>
                    <p className='text-gray-500'>
                      This feed doesn't contain any articles or may be invalid
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className='bg-gray-900 rounded-xl p-8 shadow-lg text-center py-20'>
                <div className='mx-auto w-20 h-20 mb-6 rounded-full bg-gray-800/50 flex items-center justify-center'>
                  <Rss className='h-10 w-10 text-gray-600' />
                </div>
                <h2 className='text-2xl font-medium text-gray-300 mb-3'>
                  No feed selected
                </h2>
                <p className='text-gray-500 max-w-md mx-auto mb-6'>
                  Select a feed from the sidebar or add a new RSS feed to get
                  started
                </p>
                {feeds.length > 0 && (
                  <div className='max-w-xs mx-auto'>
                    <div className='text-sm text-left mb-2 text-gray-400'>
                      Quick select:
                    </div>
                    <div className='bg-gray-800 rounded-lg p-1'>
                      {feeds.slice(0, 3).map((feed, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectFeed(feed.feed_url)}
                          className='block w-full text-left px-4 py-2 rounded-md hover:bg-gray-700 text-gray-300 text-sm truncate transition-colors'
                        >
                          {truncateUrl(feed.feed_url, 35)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feed Details Modal */}
      {showDetailsModal && selectedFeedDetails && (
        <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
          <div className='bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col'>
            <div className='flex items-center justify-between p-5 border-b border-gray-800'>
              <h3 className='text-xl font-semibold text-white'>Feed Details</h3>
              <button
                onClick={closeDetailsModal}
                className='text-gray-400 hover:text-white transition-colors'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='p-5 overflow-y-auto flex-1'>
              <div className='mb-4'>
                <h4 className='text-gray-400 text-sm mb-1'>Feed ID</h4>
                <p className='text-white'>{selectedFeedDetails.id}</p>
              </div>

              <div className='mb-4'>
                <h4 className='text-gray-400 text-sm mb-1'>Feed URL</h4>
                <p className='text-white break-all'>
                  {selectedFeedDetails.url}
                </p>
              </div>

              <div>
                <h4 className='text-gray-400 text-sm mb-3'>
                  Feed Content URLs
                </h4>
                <div className='bg-gray-800 rounded-lg p-4 space-y-3'>
                  {loadingItems ? (
                    <div className='flex items-center text-blue-400'>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Loading feed URLs...
                    </div>
                  ) : feedItems.length > 0 ? (
                    <ul className='space-y-2'>
                      {feedItems.map((item, idx) => (
                        <li
                          key={idx}
                          className='border-b border-gray-700 pb-2 last:border-0 last:pb-0'
                        >
                          <a
                            href={item.link}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-400 hover:text-blue-300 text-sm flex items-start'
                          >
                            <span className='mr-1'>{idx + 1}.</span>
                            <span className='flex-1'>
                              {item.title || item.link}
                            </span>
                            <ExternalLink className='h-3 w-3 ml-2 mt-1 flex-shrink-0' />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className='text-gray-500 text-sm'>
                      No URLs found in this feed or feed not loaded.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className='p-4 border-t border-gray-800 flex justify-end'>
              <button
                onClick={closeDetailsModal}
                className='px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(55, 65, 81, 0.8);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(75, 85, 99, 1);
        }
      `}</style>
    </div>
  );
}
