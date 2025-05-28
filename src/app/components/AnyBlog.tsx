import React, { useState, useEffect } from 'react';

// Updated interface to match your comprehensive backend response
interface ProcessingResult {
  success: boolean;
  humanizeDataId?: string;
  humanizedContent?: string;
  blogData?: {
    title: string;
    url: string;
    author: string;
    pubDate: string;
    source_domain: string;
  };
  shopifySuccess: boolean;
  shopifyArticleId?: string;
  shopifyUrl?: string;
  shopifyError?: string;
  wordpressSuccess: boolean;
  wordpressPostId?: string;
  wordpressUrl?: string;
  wordpressError?: string;
  error?: string;
}

// Updated interface to match your comprehensive Humanize_Data structure
interface HumanizedBlog {
  id: string;
  humanize_Data: string;
  created_at: string;
  publishing_status: {
    shopify: {
      published: boolean;
      article_id?: string;
      url?: string;
      handle?: string;
      published_at?: string;
      error?: string;
    };
    wordpress: {
      published: boolean;
      post_id?: string;
      url?: string;
      slug?: string;
      published_at?: string;
      error?: string;
    };
  };
  source_info: {
    rss_item_id?: string;
    original_url?: string;
    feed_url?: string;
    feed_id?: string;
  };
  is_published_anywhere: boolean;
  is_dual_published: boolean;
  has_errors: boolean;
  live_urls: {
    shopify?: string;
    wordpress?: string;
  };
}

const BlogHumanizerUI = () => {
  const [blogUrl, setBlogUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [blogRecords, setBlogRecords] = useState<HumanizedBlog[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(false);
  const [showRecords, setShowRecords] = useState<boolean>(false);

  const processingStages = [
    'Fetching blog content...',
    'Extracting text and images...',
    'Enhancing with AI...',
    'Humanizing content...',
    'Publishing to Shopify...',
    'Publishing to WordPress...',
    'Saving to database...',
  ];

  const addProcessingStep = (step: string) => {
    setProcessingSteps((prev) => [...prev, step]);
  };

  const resetForm = () => {
    setBlogUrl('');
    setResult(null);
    setError(null);
    setProcessingSteps([]);
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Check for duplicate URLs
  const checkDuplicateUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/process-blog');
      if (!response.ok) return false;

      const data = await response.json();
      if (!data.success || !data.data) return false;

      const duplicate = data.data.find(
        (record: HumanizedBlog) => record.source_info.original_url === url,
      );

      if (duplicate) {
        setError(
          `This URL has already been processed on ${formatDate(
            duplicate.created_at,
          )}`,
        );
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Could not check for duplicates:', err);
      return false;
    }
  };

  // Fetch existing humanized blogs
  const fetchBlogRecords = async () => {
    setIsLoadingRecords(true);
    try {
      console.log('Fetching blog records from:', '/api/process-blog');

      const response = await fetch('/api/process-blog');

      console.log('Response status:', response.status);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        );
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 500));
        throw new Error(
          `Expected JSON response but got: ${contentType || 'unknown'}`,
        );
      }

      const data = await response.json();
      console.log('API response:', data);

      if (data.success && data.data) {
        setBlogRecords(data.data);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        console.warn('Unexpected response structure:', data);
        setBlogRecords([]);
      }
    } catch (err) {
      console.error('Failed to fetch blog records:', err);
      let errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes('Unexpected token')) {
        errorMessage =
          'API Error: The server returned HTML instead of JSON. Please check if the /api/process-blog endpoint exists.';
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage =
          'Network Error: Could not connect to the API. Please check your internet connection.';
      } else if (errorMessage.includes('404')) {
        errorMessage =
          'API Not Found: The /api/process-blog endpoint does not exist. Please create the API route.';
      }

      setError('Failed to load blog records: ' + errorMessage);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // Load blog records on component mount
  useEffect(() => {
    fetchBlogRecords();
  }, []);

  const processBlog = async () => {
    if (!blogUrl.trim()) {
      setError('Please enter a blog URL');
      return;
    }

    if (!isValidUrl(blogUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    // Check for duplicates
    const isDuplicate = await checkDuplicateUrl(blogUrl);
    if (isDuplicate) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProcessingSteps([]);

    try {
      // Add processing steps with delays for better UX
      addProcessingStep(processingStages[0]);
      await new Promise((resolve) => setTimeout(resolve, 800));

      addProcessingStep(processingStages[1]);
      await new Promise((resolve) => setTimeout(resolve, 800));

      addProcessingStep(processingStages[2]);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      addProcessingStep(processingStages[3]);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      addProcessingStep(processingStages[4]);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      addProcessingStep(processingStages[5]);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      addProcessingStep(processingStages[6]);

      // Prepare the request data
      const requestData = {
        url: blogUrl,
        action: 'humanize_and_publish', // FIXED: Changed from humanize_and_save
      };

      // DEBUG: Log what we're actually sending BEFORE the call
      console.log('🚀 About to send request:', requestData);
      console.log('Making API call to:', '/api/process-blog');

      // Call your blog processing API
      const response = await fetch('/api/process-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      // DEBUG: Log response details
      console.log('Response status:', response.status);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      // Check if response is ok
      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        );
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 500));
        throw new Error(
          `Expected JSON response but got: ${contentType || 'unknown'}`,
        );
      }

      const data: ProcessingResult = await response.json();
      console.log('API response data:', data);

      if (data.success) {
        setResult(data);
        addProcessingStep('✅ Process completed successfully!');
        // Refresh the blog records
        fetchBlogRecords();
      } else {
        throw new Error(data.error || 'Processing failed');
      }
    } catch (err) {
      console.error('Processing error:', err);
      let errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes('Unexpected token')) {
        errorMessage =
          'API Error: The server returned HTML instead of JSON. Please check if the /api/process-blog endpoint exists.';
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage =
          'Network Error: Could not connect to the API. Please check your internet connection.';
      } else if (errorMessage.includes('404')) {
        errorMessage =
          'API Not Found: The /api/process-blog endpoint does not exist. Please create the API route.';
      }

      setError(errorMessage);
      addProcessingStep('❌ Process failed: ' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (isPublished: boolean, hasErrors: boolean) => {
    if (hasErrors) return 'text-red-400 bg-red-900/30';
    if (isPublished) return 'text-green-400 bg-green-900/30';
    return 'text-gray-400 bg-gray-700/30';
  };

  const getStatusText = (isPublished: boolean, hasErrors: boolean) => {
    if (hasErrors) return 'Failed';
    if (isPublished) return 'Published';
    return 'Draft';
  };

  return (
    <div className='min-h-screen bg-gray-900 p-6'>
      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <div className='flex items-center justify-center mb-4'>
            <div className='bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-xl'>
              <span className='text-white text-2xl'>⚡</span>
            </div>
          </div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Blog Humanizer
          </h1>
          <p className='text-gray-300 max-w-2xl mx-auto'>
            Transform any blog post into engaging, humanized content and
            automatically publish to Shopify and WordPress.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className='flex justify-center mb-8'>
          <div className='bg-gray-800 rounded-lg p-1 shadow-lg border border-gray-700'>
            <button
              onClick={() => setShowRecords(false)}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${!showRecords
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
                }`}
            >
              ⚡ Process Blog
            </button>
            <button
              onClick={() => {
                setShowRecords(true);
                fetchBlogRecords();
              }}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${showRecords
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
                }`}
            >
              🗄️ View Records
            </button>
          </div>
        </div>

        {/* Process Blog Section */}
        {!showRecords && (
          <>
            {/* Main Input Section */}
            <div className='bg-gray-800 rounded-2xl shadow-xl p-8 mb-8 border border-gray-700'>
              <div className='flex items-center mb-6'>
                <span className='text-2xl mr-3'>🌐</span>
                <h2 className='text-xl font-semibold text-white'>
                  Enter Blog URL
                </h2>
              </div>

              <div className='space-y-4'>
                <div>
                  <label
                    htmlFor='blogUrl'
                    className='block text-sm font-medium text-gray-300 mb-2'
                  >
                    Blog Post URL
                  </label>
                  <div className='relative'>
                    <input
                      id='blogUrl'
                      type='url'
                      value={blogUrl}
                      onChange={(e) => setBlogUrl(e.target.value)}
                      placeholder='https://example.com/blog-post'
                      className='w-full text-white px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors placeholder-gray-400'
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                {error && (
                  <div className='bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-center'>
                    <span className='text-red-400 text-xl mr-3'>⚠️</span>
                    <span className='text-red-300'>{error}</span>
                  </div>
                )}

                <div className='flex gap-4'>
                  <button
                    onClick={processBlog}
                    disabled={isProcessing || !blogUrl.trim()}
                    className='flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center'
                  >
                    {isProcessing ? (
                      <>
                        <span className='animate-spin mr-2'>⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span className='mr-2'>⚡</span>
                        Humanize & Publish
                      </>
                    )}
                  </button>

                  {(result || error) && (
                    <button
                      onClick={resetForm}
                      className='px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors'
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Processing Steps */}
            {(isProcessing || processingSteps.length > 0) && (
              <div className='bg-gray-800 rounded-2xl shadow-xl p-8 mb-8 border border-gray-700'>
                <div className='flex items-center mb-6'>
                  <span
                    className={`text-2xl mr-3 ${isProcessing ? 'animate-spin' : ''
                      }`}
                  >
                    {isProcessing ? '⏳' : '✅'}
                  </span>
                  <h2 className='text-xl font-semibold text-white'>
                    Processing Status
                  </h2>
                </div>

                <div className='space-y-3'>
                  {processingSteps.map((step, index) => (
                    <div key={index} className='flex items-center'>
                      <div
                        className={`w-2 h-2 rounded-full mr-3 ${step.includes('✅')
                            ? 'bg-green-500'
                            : step.includes('❌')
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}
                      />
                      <span
                        className={`text-sm ${step.includes('✅')
                            ? 'text-green-300 font-medium'
                            : step.includes('❌')
                              ? 'text-red-300 font-medium'
                              : 'text-gray-300'
                          }`}
                      >
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results Section */}
            {result && (
              <div className='bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700'>
                <div className='flex items-center mb-6'>
                  <span className='text-2xl mr-3'>✅</span>
                  <h2 className='text-xl font-semibold text-white'>
                    Processing Complete!
                  </h2>
                </div>

                {/* Blog Info */}
                {result.blogData && (
                  <div className='bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6'>
                    <h3 className='font-semibold text-white mb-2'>
                      {result.blogData.title}
                    </h3>
                    <div className='text-sm text-gray-300 space-y-1'>
                      <p>
                        <strong>Author:</strong>{' '}
                        {result.blogData.author || 'Unknown'}
                      </p>
                      <p>
                        <strong>Published:</strong>{' '}
                        {result.blogData.pubDate || 'Unknown'}
                      </p>
                    </div>
                  </div>
                )}

                <div className='grid md:grid-cols-2 gap-6 mb-6'>
                  {/* Shopify Results */}
                  <div className='bg-green-900/20 border border-green-800 rounded-lg p-6'>
                    <div className='flex items-center mb-4'>
                      <div className='bg-green-600 p-2 rounded-lg'>
                        <span className='text-white text-lg'>🛒</span>
                      </div>
                      <div className='ml-3'>
                        <h3 className='font-semibold text-green-300'>
                          Shopify
                        </h3>
                        <p className='text-sm text-green-400'>
                          {result.shopifySuccess
                            ? 'Published Successfully'
                            : 'Publishing Failed'}
                        </p>
                      </div>
                    </div>

                    {result.shopifySuccess ? (
                      <div className='space-y-2'>
                        <p className='text-sm text-gray-300'>
                          <strong>Article ID:</strong> {result.shopifyArticleId}
                        </p>
                        {result.shopifyUrl && (
                          <a
                            href={result.shopifyUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center text-sm text-green-400 hover:text-green-300'
                          >
                            <span className='mr-1'>🔗</span>
                            View Live Post
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className='text-sm text-red-400'>
                        {result.shopifyError}
                      </p>
                    )}
                  </div>

                  {/* WordPress Results */}
                  <div className='bg-blue-900/20 border border-blue-800 rounded-lg p-6'>
                    <div className='flex items-center mb-4'>
                      <div className='bg-blue-600 p-2 rounded-lg'>
                        <span className='text-white text-lg'>📝</span>
                      </div>
                      <div className='ml-3'>
                        <h3 className='font-semibold text-blue-300'>
                          WordPress
                        </h3>
                        <p className='text-sm text-blue-400'>
                          {result.wordpressSuccess
                            ? 'Published Successfully'
                            : 'Publishing Failed'}
                        </p>
                      </div>
                    </div>

                    {result.wordpressSuccess ? (
                      <div className='space-y-2'>
                        <p className='text-sm text-gray-300'>
                          <strong>Post ID:</strong> {result.wordpressPostId}
                        </p>
                        {result.wordpressUrl && (
                          <a
                            href={result.wordpressUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center text-sm text-blue-400 hover:text-blue-300'
                          >
                            <span className='mr-1'>🔗</span>
                            View Live Post
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className='text-sm text-red-400'>
                        {result.wordpressError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Humanized Content Preview */}
                {result.humanizedContent && (
                  <div className='bg-gray-700 border border-gray-600 rounded-lg p-6'>
                    <div className='flex items-center justify-between mb-4'>
                      <h3 className='font-semibold text-white'>
                        Humanized Content Preview
                      </h3>
                    </div>
                    <div className='bg-gray-800 p-4 rounded border border-gray-600 max-h-48 overflow-y-auto'>
                      <div className='prose prose-sm max-w-none text-gray-300'>
                        {result.humanizedContent.substring(0, 500)}...
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className='flex gap-4 mt-6'>
                  <button
                    onClick={() => {
                      setShowRecords(true);
                      fetchBlogRecords();
                    }}
                    className='px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center'
                  >
                    <span className='mr-2'>👀</span>
                    View All Records
                  </button>
                  <button
                    onClick={resetForm}
                    className='px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors'
                  >
                    Process Another
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Records Section */}
        {showRecords && (
          <div className='bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700'>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center'>
                <span className='text-2xl mr-3'>🗄️</span>
                <h2 className='text-xl font-semibold text-white'>
                  Humanized Blog Records
                </h2>
              </div>
              <button
                onClick={fetchBlogRecords}
                disabled={isLoadingRecords}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center'
              >
                {isLoadingRecords ? (
                  <span className='animate-spin mr-2'>⏳</span>
                ) : (
                  <span className='mr-2'>🔄</span>
                )}
                Refresh
              </button>
            </div>

            {isLoadingRecords ? (
              <div className='flex items-center justify-center py-8'>
                <span className='animate-spin text-4xl mr-3'>⏳</span>
                <span className='text-gray-300'>Loading records...</span>
              </div>
            ) : blogRecords.length === 0 ? (
              <div className='text-center py-8'>
                <span className='text-6xl'>🗄️</span>
                <p className='text-gray-300 mt-4'>No blog records found</p>
              </div>
            ) : (
              <div className='space-y-4'>
                {blogRecords.map((record) => (
                  <div
                    key={record.id}
                    className='border border-gray-600 rounded-lg p-6 hover:shadow-lg transition-shadow bg-gray-700/50'
                  >
                    <div className='flex items-start justify-between mb-4'>
                      <div className='flex-1'>
                        <div className='flex items-center mb-2'>
                          <h3 className='font-semibold text-white mr-3'>
                            Blog Post #{record.id}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              record.is_published_anywhere,
                              record.has_errors,
                            )}`}
                          >
                            {getStatusText(
                              record.is_published_anywhere,
                              record.has_errors,
                            )}
                          </span>
                        </div>
                        <div className='flex items-center text-sm text-gray-400'>
                          <span className='mr-1'>📅</span>
                          <span>Created: {formatDate(record.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className='grid md:grid-cols-2 gap-4 mt-4'>
                      {/* Shopify Status */}
                      <div className='flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-600'>
                        <div className='flex items-center'>
                          <span className='text-green-400 mr-2'>🛒</span>
                          <span className='text-sm font-medium text-gray-300'>Shopify:</span>
                        </div>
                        <div className='flex items-center'>
                          {record.publishing_status.shopify.published ? (
                            <>
                              <span className='text-green-400 mr-2'>✅</span>
                              {record.live_urls.shopify && (
                                <a
                                  href={record.live_urls.shopify}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-xs text-blue-400 hover:text-blue-300'
                                >
                                  🔗
                                </a>
                              )}
                            </>
                          ) : (
                            <span className='text-red-400'>❌</span>
                          )}
                        </div>
                      </div>

                      {/* WordPress Status */}
                      <div className='flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-600'>
                        <div className='flex items-center'>
                          <span className='text-blue-400 mr-2'>📝</span>
                          <span className='text-sm font-medium text-gray-300'>
                            WordPress:
                          </span>
                        </div>
                        <div className='flex items-center'>
                          {record.publishing_status.wordpress.published ? (
                            <>
                              <span className='text-green-400 mr-2'>✅</span>
                              {record.live_urls.wordpress && (
                                <a
                                  href={record.live_urls.wordpress}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-xs text-blue-400 hover:text-blue-300'
                                >
                                  🔗
                                </a>
                              )}
                            </>
                          ) : (
                            <span className='text-red-400'>❌</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {record.humanize_Data && (
                      <div className='mt-4'>
                        <div className='bg-gray-800 p-4 rounded-lg border border-gray-600'>
                          <div className='flex items-center justify-between mb-2'>
                            <span className='text-sm font-medium text-gray-300'>
                              Humanized Content Preview:
                            </span>
                          </div>
                          <div className='text-sm text-gray-400 line-clamp-3'>
                            {record.humanize_Data.substring(0, 200)}...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogHumanizerUI;