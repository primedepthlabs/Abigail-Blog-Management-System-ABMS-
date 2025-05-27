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
  CheckSquare,
  Square,
  Globe,
  User,
  Tag,
  Image,
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
  creator?: string;
  categories?: string[];
  media?: {
    thumbnail?: string;
    content?: string;
  };
}

interface FeedData {
  title: string;
  description: string;
  link: string;
  lastBuildDate: string;
  language: string;
  items: FeedItem[];
}

// Processing status types
interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  currentItemTitle: string;
  results?: {
    total: number;
    processed: number;
    humanized: number;
    skipped: number;
    shopifyPosts: number;
    errors: number;
  };
}

export default function RssManager({ theme }: RssManagerProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [feeds, setFeeds] = useState<FeedRecord[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [currentFeedData, setCurrentFeedData] = useState<FeedData | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
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

  // Fetch feed data (without processing)
  const fetchFeedData = async (url: string): Promise<FeedData | null> => {
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Failed to fetch feed');
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error fetching feed:', err);
      throw err;
    }
  };

  // Add feed - now fetches data first, then allows selection
  const addFeed = async () => {
    if (!feedUrl.trim()) return;
    try {
      setError('');
      setLoadingItems(true);
      
      // First, fetch the feed data to show items
      const feedData = await fetchFeedData(feedUrl.trim());
      if (!feedData) {
        throw new Error('Invalid feed data received');
      }

      // Display the feed data for selection
      setCurrentFeedData(feedData);
      setFeedItems(feedData.items || []);
      setSelectedItems(new Set()); // Reset selections
      setSelectedFeed(feedUrl.trim());
      
    } catch (err) {
      console.error(err);
      setError('Error fetching RSS feed. Please check the URL and try again.');
    } finally {
      setLoadingItems(false);
    }
  };

  // Process selected items
  const processSelectedItems = async () => {
    if (!currentFeedData || selectedItems.size === 0) {
      setError('Please select at least one item to process');
      return;
    }

    // Use feedUrl or selectedFeed as fallback
    const urlToProcess = feedUrl.trim() || selectedFeed;
    if (!urlToProcess) {
      setError('No feed URL available for processing');
      return;
    }

    try {
      setError('');
      
      // Create filtered feed data with only selected items
      const selectedFeedData = {
        ...currentFeedData,
        items: currentFeedData.items.filter((_, index) => selectedItems.has(index))
      };

      // Start processing
      setProcessingStatus({
        isProcessing: true,
        currentStep: 'Processing selected RSS items...',
        progress: 10,
        totalItems: selectedItems.size,
        processedItems: 0,
        currentItemTitle: '',
      });

      // Send to backend for processing
      const res = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: urlToProcess,
          selectedItems: Array.from(selectedItems),
          feedData: selectedFeedData
        }),
      });
      
      if (!res.ok) throw new Error('Failed to process selected items');
      
      const result = await res.json();
      
      // Update processing status with results
      setProcessingStatus({
        isProcessing: false,
        currentStep: 'Completed',
        progress: 100,
        totalItems: result.total,
        processedItems: result.processed,
        currentItemTitle: '',
        results: {
          total: result.total,
          processed: result.processed,
          humanized: result.humanized,
          skipped: result.skipped,
          shopifyPosts: result.shopifyPosts,
          errors: result.errors,
        }
      });

      // Reset form and reload feeds
      setFeedUrl('');
      setCurrentFeedData(null);
      setFeedItems([]);
      setSelectedItems(new Set());
      setSelectedFeed(null);
      loadFeeds();
      
    } catch (err) {
      console.error(err);
      setError('Error processing selected items');
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
      if (currentFeedData && selectedItems.size > 0) {
        processSelectedItems();
      } else {
        addFeed();
      }
    }
  };

  // Toggle item selection
  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  // Select all items
  const selectAll = () => {
    if (feedItems.length > 0) {
      const allIndices = feedItems.map((_, index) => index);
      setSelectedItems(new Set(allIndices));
    }
  };

  // Deselect all items
  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  // Select existing feed
  const selectFeed = async (url: string) => {
    setSelectedFeed(url);
    setFeedUrl(url); // Fix: Update feedUrl state as well
    setFeedItems([]);
    setCurrentFeedData(null);
    setSelectedItems(new Set());
    setLoadingItems(true);
    setError('');
    setShowDescription({});
    
    try {
      const data = await fetchFeedData(url);
      if (data) {
        setCurrentFeedData(data);
        setFeedItems(Array.isArray(data.items) ? data.items : []);
      }
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
    if (!dateString) return 'No date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  const extractImageFromContent = (description?: string, content?: string) => {
    const htmlContent = content || description || '';
    const imgMatch = htmlContent.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : null;
  };

  const ProcessingProgressUI = () => {
    const {
      isProcessing,
      currentStep,
      results,
    } = processingStatus;

    if (!isProcessing && !results) return null;

    return (
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6'>
        <div className='bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-800'>
          <h3 className='text-xl font-semibold text-white mb-4 flex items-center'>
            <Rss className='mr-2 h-5 w-5 text-blue-400' />
            Processing RSS Feed
          </h3>

          {isProcessing ? (
            <div className='mb-5'>
              <div className='flex justify-between mb-2'>
                <span className='text-blue-400 animate-pulse font-medium'>
                  {currentStep}
                </span>
              </div>
              <div className='flex items-center text-gray-400'>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                <span>Please wait while we process your selected items...</span>
              </div>
            </div>
          ) : results ? (
            <div className='space-y-4'>
              <div className='bg-green-900/30 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center'>
                <CheckCircle2 className='h-5 w-5 mr-2' />
                <span>Processing completed successfully!</span>
              </div>
              
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div className='text-center p-3 bg-blue-900/20 rounded-lg'>
                  <div className='text-2xl font-bold text-blue-400'>{results.total}</div>
                  <div className='text-blue-300'>Total Items</div>
                </div>
                <div className='text-center p-3 bg-green-900/20 rounded-lg'>
                  <div className='text-2xl font-bold text-green-400'>{results.humanized}</div>
                  <div className='text-green-300'>Humanized</div>
                </div>
                <div className='text-center p-3 bg-purple-900/20 rounded-lg'>
                  <div className='text-2xl font-bold text-purple-400'>{results.shopifyPosts}</div>
                  <div className='text-purple-300'>Published</div>
                </div>
                <div className='text-center p-3 bg-gray-800/50 rounded-lg'>
                  <div className='text-2xl font-bold text-gray-400'>{results.skipped}</div>
                  <div className='text-gray-300'>Skipped</div>
                </div>
              </div>
              
              <button
                onClick={() => setProcessingStatus({
                  isProcessing: false,
                  currentStep: '',
                  progress: 0,
                  totalItems: 0,
                  processedItems: 0,
                  currentItemTitle: '',
                })}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 transition-colors'
              >
                Close
              </button>
            </div>
          ) : null}
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
            RSS Feed Manager
          </h1>
          <p className='text-gray-400'>
            Fetch RSS feeds and select which items to humanize and publish
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
                
                {/* Show different buttons based on state */}
                {currentFeedData ? (
                  <button
                    onClick={processSelectedItems}
                    disabled={processingStatus.isProcessing || selectedItems.size === 0}
                    className={`w-full bg-green-600 text-white font-medium rounded-lg py-3 px-4 flex items-center justify-center transition-all duration-200 ${
                      processingStatus.isProcessing || selectedItems.size === 0
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:bg-green-700'
                    }`}
                  >
                    {processingStatus.isProcessing ? (
                      <>
                        <Loader2 className='h-5 w-5 mr-2 animate-spin' />
                        Processing...
                      </>
                    ) : (
                      <>
                        Process Selected ({selectedItems.size})
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={addFeed}
                    disabled={loadingItems || !feedUrl.trim()}
                    className={`w-full bg-blue-600 text-white font-medium rounded-lg py-3 px-4 flex items-center justify-center transition-all duration-200 ${
                      loadingItems || !feedUrl.trim()
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:bg-blue-700'
                    }`}
                  >
                    {loadingItems ? (
                      <>
                        <Loader2 className='h-5 w-5 mr-2 animate-spin' />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Plus className='h-5 w-5 mr-2' />
                        Fetch Feed
                      </>
                    )}
                  </button>
                )}
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
            {selectedFeed && currentFeedData ? (
              <div className='bg-gray-900 rounded-xl p-5 shadow-lg'>
                {/* Feed Info */}
                <div className='bg-blue-50/10 p-4 rounded-lg mb-6'>
                  <h2 className='text-xl font-semibold text-blue-100 mb-2'>{currentFeedData.title}</h2>
                  <p className='text-blue-200/80 mb-2'>{currentFeedData.description}</p>
                  <div className='flex items-center gap-4 text-sm text-blue-300/80'>
                    <span className='flex items-center gap-1'>
                      <Globe className='w-4 h-4' />
                      {currentFeedData.link}
                    </span>
                    {currentFeedData.lastBuildDate && (
                      <span className='flex items-center gap-1'>
                        <Calendar className='w-4 h-4' />
                        {formatDate(currentFeedData.lastBuildDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Selection Controls */}
                <div className='flex items-center justify-between bg-gray-800/50 p-4 rounded-lg mb-6'>
                  <div className='flex items-center gap-4'>
                    <span className='font-medium text-gray-300'>
                      {selectedItems.size} of {feedItems.length} items selected
                    </span>
                    <div className='flex gap-2'>
                      <button
                        onClick={selectAll}
                        className='px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors'
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAll}
                        className='px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors'
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feed Items */}
                {loadingItems ? (
                  <div className='space-y-4'>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className='animate-pulse border border-gray-700 rounded-lg p-4'>
                        <div className='h-6 bg-gray-800/70 rounded w-3/4 mb-3'></div>
                        <div className='h-4 bg-gray-800/50 rounded w-1/4 mb-2'></div>
                        <div className='h-4 bg-gray-800/30 rounded'></div>
                      </div>
                    ))}
                  </div>
                ) : feedItems.length > 0 ? (
                  <div className='space-y-4'>
                    {feedItems.map((item, index) => {
                      const isSelected = selectedItems.has(index);
                      const thumbnail = extractImageFromContent(item.description, item.content) || item.media?.thumbnail;
                      
                      return (
                        <div
                          key={index}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-950/20' 
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                          onClick={() => toggleItemSelection(index)}
                        >
                          <div className='flex items-start gap-4'>
                            {/* Checkbox */}
                            <div className='flex-shrink-0 mt-1'>
                              {isSelected ? (
                                <CheckSquare className='w-5 h-5 text-blue-500' />
                              ) : (
                                <Square className='w-5 h-5 text-gray-400' />
                              )}
                            </div>

                            {/* Thumbnail */}
                            {thumbnail && (
                              <div className='flex-shrink-0'>
                                <img
                                  src={thumbnail}
                                  alt=""
                                  className='w-16 h-16 object-cover rounded'
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}

                            {/* Content */}
                            <div className='flex-1 min-w-0'>
                              <h4 className='font-medium text-gray-100 mb-2 line-clamp-2'>
                                {item.title || 'Untitled'}
                              </h4>
                              
                              <div className='text-sm text-gray-400 mb-3 line-clamp-3'>
                                {item.description?.replace(/<[^>]*>/g, '').substring(0, 200)}...
                              </div>

                              <div className='flex items-center gap-4 text-xs text-gray-500'>
                                {item.pubDate && (
                                  <span className='flex items-center gap-1'>
                                    <Calendar className='w-3 h-3' />
                                    {formatDate(item.pubDate)}
                                  </span>
                                )}
                                
                                {item.creator && (
                                  <span className='flex items-center gap-1'>
                                    <User className='w-3 h-3' />
                                    {item.creator}
                                  </span>
                                )}

                                {item.categories && item.categories.length > 0 && (
                                  <span className='flex items-center gap-1'>
                                    <Tag className='w-3 h-3' />
                                    {item.categories.slice(0, 3).join(', ')}
                                  </span>
                                )}

                                {item.link && (
                                  <span className='flex items-center gap-1'>
                                    <Globe className='w-3 h-3' />
                                    <a 
                                      href={item.link} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className='text-blue-400 hover:underline'
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View Original
                                    </a>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
            ) : selectedFeed && !currentFeedData ? (
              <div className='bg-gray-900 rounded-xl p-5 shadow-lg'>
                {loadingItems ? (
                  <div className='text-center py-16'>
                    <Loader2 className='h-8 w-8 mx-auto mb-4 animate-spin text-blue-400' />
                    <h3 className='text-xl font-medium text-gray-400 mb-2'>
                      Loading feed...
                    </h3>
                    <p className='text-gray-500'>
                      Please wait while we fetch the RSS feed
                    </p>
                  </div>
                ) : (
                  <div className='text-center py-16'>
                    <div className='mx-auto w-16 h-16 mb-4 rounded-full bg-gray-800/50 flex items-center justify-center'>
                      <Rss className='h-8 w-8 text-gray-600' />
                    </div>
                    <h3 className='text-xl font-medium text-gray-400 mb-2'>
                      Failed to load feed
                    </h3>
                    <p className='text-gray-500'>
                      Please try again or check the feed URL
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
                  Enter an RSS feed URL above to get started, or select an existing feed from the sidebar
                </p>
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

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}