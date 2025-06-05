import React, { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  CheckCircle2,
  X,
  Store,
  Database,
  Target,
  Settings,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  Zap,
  RefreshCw,
  Info,
  Globe,
  Calendar,
  User,
  Tag,
  FolderOpen,
} from 'lucide-react';

// HARDCODED PUBLISHING DESTINATIONS - Update these with your actual credentials
const PUBLISHING_DESTINATIONS = {
  shopify: [
    {
      id: 'shopify-1',
      name: 'Main Store',
      shopDomain: '6vj1n3-x1.myshopify.com',
      accessToken: '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',
      description: 'Primary e-commerce store',
      color: 'bg-green-600',
      isActive: true,
      priority: 10,
      defaultAuthor: 'Blog Bot',
    },
  ],
  wordpress: [
    {
      id: 'wp-1',
      name: 'Money Grower Blog',
      apiUrl: 'https://themoneygrower.com/wp-json/wp/v2/posts',
      username: 'tmgadmin',
      password: '5er9 92Hw Sgjv wwvd bU9E S8RC',
      description: 'Primary WordPress blog',
      color: 'bg-orange-600',
      isActive: true,
      priority: 10,
    },
    {
      id: 'wp-2',
      name: 'Outdoor Adventur Equipment',
      apiUrl: 'https://outdooradventureequipment.com/wp-json/wp/v2/posts',
      username: 'consultantsingh337',
      password: '9SGR 4GOr Jc2C DMuh 6vOh Luwh',
      description: 'Corporate blog site',
      color: 'bg-cyan-600',
      isActive: true,
      priority: 8,
    }
  ],
};

// Updated interface for multi-destination results
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
    images?: Array<{ url: string; alt: string; caption?: string }>;
  };
  publishingResults?: {
    shopify: Array<{
      success: boolean;
      platform: string;
      destination: string;
      destinationId: string;
      articleId?: string;
      url?: string;
      error?: string;
      publishedAt?: string;
    }>;
    wordpress: Array<{
      success: boolean;
      platform: string;
      destination: string;
      destinationId: string;
      postId?: string;
      url?: string;
      error?: string;
      publishedAt?: string;
    }>;
  };
  totalDestinations?: number;
  shopifyPublished?: number;
  wordpressPublished?: number;
  destinationResults?: {
    shopify: Array<{ name: string; published: number; errors: number }>;
    wordpress: Array<{ name: string; published: number; errors: number }>;
  };
  // Legacy compatibility
  shopifySuccess?: boolean;
  shopifyArticleId?: string;
  shopifyUrl?: string;
  shopifyError?: string;
  wordpressSuccess?: boolean;
  wordpressPostId?: string;
  wordpressUrl?: string;
  wordpressError?: string;
  error?: string;
}

interface HumanizedBlog {
  id: string;
  humanize_Data: string;
  created_at: string;
  multi_destination_results?: {
    shopify: Array<any>;
    wordpress: Array<any>;
  };
  total_destinations?: number;
  total_shopify_published?: number;
  total_wordpress_published?: number;
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

interface ConnectionTestResult {
  success: boolean;
  destinationId: string;
  destinationName: string;
  platform: 'shopify' | 'wordpress';
  message: string;
  responseTime?: number;
  lastTested: string;
}

interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  count: number;
  parent: number;
  destinationId: string;
  destinationName: string;
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

  // WordPress Categories state
  const [wordpressCategories, setWordpressCategories] = useState<WordPressCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<{ [destinationId: string]: number[] }>({});
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState<boolean>(false);

  // Get active destinations
  const activeDestinations = {
    shopify: PUBLISHING_DESTINATIONS.shopify.filter(dest => dest.isActive),
    wordpress: PUBLISHING_DESTINATIONS.wordpress.filter(dest => dest.isActive),
  };

  // Initialize with default selections (highest priority active destinations)
  const [selectedDestinations, setSelectedDestinations] = useState<{
    shopify: Set<string>;
    wordpress: Set<string>;
  }>(() => {
    const topShopify = activeDestinations.shopify
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2)
      .map(dest => dest.id);
    const topWordPress = activeDestinations.wordpress
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2)
      .map(dest => dest.id);

    return {
      shopify: new Set(topShopify),
      wordpress: new Set(topWordPress),
    };
  });

  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [connectionTests, setConnectionTests] = useState<ConnectionTestResult[]>([]);
  const [testingConnections, setTestingConnections] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);

  const processingStages = [
    'Fetching blog content...',
    'Extracting text and images...',
    'Enhancing with AI...',
    'Humanizing content...',
    'Publishing to destinations...',
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

  // Fetch WordPress categories for selected destinations
  const fetchWordPressCategories = async () => {
    setIsLoadingCategories(true);
    const allCategories: WordPressCategory[] = [];

    try {
      // Fetch categories for each selected WordPress destination
      for (const wpId of selectedDestinations.wordpress) {
        const destination = PUBLISHING_DESTINATIONS.wordpress.find(d => d.id === wpId);
        if (destination) {
          try {
            const wpAuth = btoa(`${destination.username}:${destination.password}`);
            const categoriesUrl = destination.apiUrl.replace('/posts', '/categories');

            const response = await fetch(`${categoriesUrl}?per_page=100`, {
              headers: {
                'Authorization': `Basic ${wpAuth}`,
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
              const categories = await response.json();
              const formattedCategories: WordPressCategory[] = categories.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
                description: cat.description,
                count: cat.count,
                parent: cat.parent,
                destinationId: destination.id,
                destinationName: destination.name,
              }));
              allCategories.push(...formattedCategories);
            } else {
              console.error(`Failed to fetch categories for ${destination.name}:`, response.status);
            }
          } catch (error) {
            console.error(`Error fetching categories for ${destination.name}:`, error);
          }
        }
      }

      setWordpressCategories(allCategories);
    } catch (err) {
      console.error('Failed to fetch WordPress categories:', err);
      setError('Failed to fetch WordPress categories');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // Initialize categories with default selections (first category for each site)
  useEffect(() => {
    if (wordpressCategories.length > 0) {
      const defaultSelections: { [destinationId: string]: number[] } = {};

      // Group categories by destination
      const categoriesByDestination = wordpressCategories.reduce((acc, cat) => {
        if (!acc[cat.destinationId]) {
          acc[cat.destinationId] = [];
        }
        acc[cat.destinationId].push(cat);
        return acc;
      }, {} as { [key: string]: WordPressCategory[] });

      // Select the first category (usually "Uncategorized") for each destination
      Object.keys(categoriesByDestination).forEach(destId => {
        const categories = categoriesByDestination[destId];
        if (categories.length > 0) {
          // Try to find "Uncategorized" first, or use the first category
          const uncategorized = categories.find(cat => cat.slug === 'uncategorized');
          const defaultCat = uncategorized || categories[0];
          defaultSelections[destId] = [defaultCat.id];
        }
      });

      setSelectedCategories(defaultSelections);
    }
  }, [wordpressCategories]);

  // Fetch categories when WordPress destinations change
  useEffect(() => {
    if (selectedDestinations.wordpress.size > 0) {
      fetchWordPressCategories();
    } else {
      setWordpressCategories([]);
      setSelectedCategories({});
    }
  }, [selectedDestinations.wordpress]);

  // Test connections for selected destinations
  const testSelectedConnections = async () => {
    setTestingConnections(true);
    const results: ConnectionTestResult[] = [];

    try {
      // Test selected Shopify destinations
      for (const shopifyId of selectedDestinations.shopify) {
        const destination = PUBLISHING_DESTINATIONS.shopify.find(d => d.id === shopifyId);
        if (destination) {
          const startTime = Date.now();
          try {
            const response = await fetch(`https://${destination.shopDomain}/admin/api/2023-10/shop.json`, {
              headers: {
                'X-Shopify-Access-Token': destination.accessToken,
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(10000),
            });

            const responseTime = Date.now() - startTime;

            if (response.ok) {
              const data = await response.json();
              results.push({
                success: true,
                destinationId: destination.id,
                destinationName: destination.name,
                platform: 'shopify',
                message: `Connected to ${data.shop.name}`,
                responseTime,
                lastTested: new Date().toISOString(),
              });
            } else {
              results.push({
                success: false,
                destinationId: destination.id,
                destinationName: destination.name,
                platform: 'shopify',
                message: `Connection failed: HTTP ${response.status}`,
                responseTime,
                lastTested: new Date().toISOString(),
              });
            }
          } catch (error) {
            results.push({
              success: false,
              destinationId: destination.id,
              destinationName: destination.name,
              platform: 'shopify',
              message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              responseTime: Date.now() - startTime,
              lastTested: new Date().toISOString(),
            });
          }
        }
      }

      // Test selected WordPress destinations
      for (const wpId of selectedDestinations.wordpress) {
        const destination = PUBLISHING_DESTINATIONS.wordpress.find(d => d.id === wpId);
        if (destination) {
          const startTime = Date.now();
          try {
            const wpAuth = btoa(`${destination.username}:${destination.password}`);
            const baseUrl = destination.apiUrl.replace('/posts', '');

            const response = await fetch(baseUrl, {
              headers: {
                'Authorization': `Basic ${wpAuth}`,
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(10000),
            });

            const responseTime = Date.now() - startTime;

            if (response.ok) {
              results.push({
                success: true,
                destinationId: destination.id,
                destinationName: destination.name,
                platform: 'wordpress',
                message: 'WordPress connection successful',
                responseTime,
                lastTested: new Date().toISOString(),
              });
            } else {
              results.push({
                success: false,
                destinationId: destination.id,
                destinationName: destination.name,
                platform: 'wordpress',
                message: `Connection failed: HTTP ${response.status}`,
                responseTime,
                lastTested: new Date().toISOString(),
              });
            }
          } catch (error) {
            results.push({
              success: false,
              destinationId: destination.id,
              destinationName: destination.name,
              platform: 'wordpress',
              message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              responseTime: Date.now() - startTime,
              lastTested: new Date().toISOString(),
            });
          }
        }
      }

      setConnectionTests(results);
      setLastTestTime(new Date().toISOString());
    } catch (err) {
      console.error('Connection test failed:', err);
      setError('Failed to test destination connections');
    } finally {
      setTestingConnections(false);
    }
  };

  // Get connection health status
  const getConnectionHealth = () => {
    if (connectionTests.length === 0) {
      return {
        status: 'unknown',
        message: 'No connections tested',
        color: 'bg-gray-600',
      };
    }

    const successCount = connectionTests.filter(r => r.success).length;
    const successRate = successCount / connectionTests.length;

    if (successRate === 1) {
      return {
        status: 'healthy',
        message: 'All destinations connected',
        color: 'bg-green-600',
      };
    } else if (successRate >= 0.5) {
      return {
        status: 'degraded',
        message: `${successCount}/${connectionTests.length} destinations connected`,
        color: 'bg-yellow-600',
      };
    } else {
      return {
        status: 'down',
        message: `Only ${successCount}/${connectionTests.length} destinations connected`,
        color: 'bg-red-600',
      };
    }
  };

  const connectionHealth = getConnectionHealth();

  const toggleDestination = (platform: 'shopify' | 'wordpress', destinationId: string) => {
    setSelectedDestinations(prev => {
      const newSet = new Set(prev[platform]);
      if (newSet.has(destinationId)) {
        newSet.delete(destinationId);
      } else {
        newSet.add(destinationId);
      }
      return { ...prev, [platform]: newSet };
    });
  };

  const selectAllDestinations = (platform: 'shopify' | 'wordpress') => {
    const allIds = activeDestinations[platform].map(dest => dest.id);
    setSelectedDestinations(prev => ({ ...prev, [platform]: new Set(allIds) }));
  };

  const deselectAllDestinations = (platform: 'shopify' | 'wordpress') => {
    setSelectedDestinations(prev => ({ ...prev, [platform]: new Set() }));
  };

  // Category selection functions
  const toggleCategory = (destinationId: string, categoryId: number) => {
    setSelectedCategories(prev => {
      const currentSelection = prev[destinationId] || [];
      const newSelection = currentSelection.includes(categoryId)
        ? currentSelection.filter(id => id !== categoryId)
        : [...currentSelection, categoryId];

      return { ...prev, [destinationId]: newSelection };
    });
  };

  const selectAllCategories = (destinationId: string) => {
    const destinationCategories = wordpressCategories
      .filter(cat => cat.destinationId === destinationId)
      .map(cat => cat.id);

    setSelectedCategories(prev => ({
      ...prev,
      [destinationId]: destinationCategories
    }));
  };

  const deselectAllCategories = (destinationId: string) => {
    setSelectedCategories(prev => ({
      ...prev,
      [destinationId]: []
    }));
  };

  // Get selected destination configurations
  const getSelectedDestinationConfigs = () => {
    const shopifyConfigs = PUBLISHING_DESTINATIONS.shopify.filter(dest =>
      selectedDestinations.shopify.has(dest.id)
    );
    const wordpressConfigs = PUBLISHING_DESTINATIONS.wordpress.filter(dest =>
      selectedDestinations.wordpress.has(dest.id)
    ).map(dest => ({
      ...dest,
      selectedCategories: selectedCategories[dest.id] || []
    }));

    return { shopify: shopifyConfigs, wordpress: wordpressConfigs };
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

    if (selectedDestinations.shopify.size === 0 && selectedDestinations.wordpress.size === 0) {
      setError('Please select at least one publishing destination');
      return;
    }

    // Check if WordPress destinations have categories selected
    const wpDestinations = Array.from(selectedDestinations.wordpress);
    for (const destId of wpDestinations) {
      const cats = selectedCategories[destId] || [];
      if (cats.length === 0) {
        setError('Please select at least one category for each WordPress destination');
        return;
      }
    }

    // Check connection health before processing
    const healthyConnections = connectionTests.filter(test => test.success);
    const selectedConnectionIds = [
      ...Array.from(selectedDestinations.shopify),
      ...Array.from(selectedDestinations.wordpress)
    ];
    const healthySelectedConnections = healthyConnections.filter(test =>
      selectedConnectionIds.includes(test.destinationId)
    );

    // Check for duplicates
    const isDuplicate = await checkDuplicateUrl(blogUrl);
    if (isDuplicate) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProcessingSteps([]);

    try {
      // Add processing steps with delays for better UX
      for (let i = 0; i < processingStages.length; i++) {
        addProcessingStep(processingStages[i]);
        if (i < processingStages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }

      const publishingDestinations = getSelectedDestinationConfigs();

      // Prepare the request data with categories
      const requestData = {
        url: blogUrl,
        action: 'humanize_and_publish',
        publishingDestinations,
        wordpressCategories: selectedCategories,
      };

      console.log('🚀 About to send request:', requestData);

      // Call your blog processing API
      const response = await fetch('/api/process-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

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

  // Categories Selection Modal Component
  const CategoriesModal = () => {
    const categoriesByDestination = wordpressCategories.reduce((acc, cat) => {
      if (!acc[cat.destinationId]) {
        acc[cat.destinationId] = [];
      }
      acc[cat.destinationId].push(cat);
      return acc;
    }, {} as { [key: string]: WordPressCategory[] });

    return (
      <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
        <div className='bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col'>
          <div className='flex items-center justify-between p-5 border-b border-gray-800'>
            <h3 className='text-xl font-semibold text-white flex items-center'>
              <Tag className='mr-2 h-5 w-5 text-blue-400' />
              Select WordPress Categories
            </h3>
            <button
              onClick={() => setShowCategoriesModal(false)}
              className='text-gray-400 hover:text-white transition-colors'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          <div className='p-5 overflow-y-auto flex-1'>
            {isLoadingCategories ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='h-8 w-8 mr-3 animate-spin text-blue-400' />
                <span className='text-gray-300'>Loading categories...</span>
              </div>
            ) : (
              <div className='space-y-6'>
                {Object.entries(categoriesByDestination).map(([destId, categories]) => {
                  const destination = PUBLISHING_DESTINATIONS.wordpress.find(d => d.id === destId);
                  const selectedCats = selectedCategories[destId] || [];

                  return (
                    <div key={destId} className='border border-gray-700 rounded-lg p-4'>
                      <div className='flex items-center justify-between mb-4'>
                        <h4 className='text-lg font-medium text-white flex items-center'>
                          <div className={`w-3 h-3 rounded-full ${destination?.color} mr-2`}></div>
                          {destination?.name} ({selectedCats.length}/{categories.length})
                        </h4>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => selectAllCategories(destId)}
                            className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => deselectAllCategories(destId)}
                            className='px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors'
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto'>
                        {categories.map((category) => {
                          const isSelected = selectedCats.includes(category.id);
                          return (
                            <div
                              key={category.id}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : 'border-gray-700 hover:border-gray-600'
                                }`}
                              onClick={() => toggleCategory(destId, category.id)}
                            >
                              <div className='flex items-center justify-between mb-1'>
                                <span className='font-medium text-white text-sm'>{category.name}</span>
                                {isSelected ? (
                                  <CheckCircle2 className='h-4 w-4 text-blue-500' />
                                ) : (
                                  <div className='h-4 w-4 border-2 border-gray-400 rounded'></div>
                                )}
                              </div>
                              <div className='flex items-center justify-between text-xs text-gray-400'>
                                <span>{category.slug}</span>
                                <span>{category.count} posts</span>
                              </div>
                              {category.description && (
                                <p className='text-xs text-gray-500 mt-1 truncate'>{category.description}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {Object.keys(categoriesByDestination).length === 0 && !isLoadingCategories && (
              <div className='text-center py-8'>
                <FolderOpen className='h-8 w-8 mx-auto mb-4 text-gray-600' />
                <p className='text-gray-400'>No WordPress destinations selected</p>
                <p className='text-gray-500 text-sm mt-2'>Select WordPress destinations first to load categories</p>
              </div>
            )}
          </div>

          <div className='p-4 border-t border-gray-800 flex justify-between items-center'>
            <div className='text-sm text-gray-400'>
              {Object.values(selectedCategories).reduce((acc, cats) => acc + cats.length, 0)} categories selected
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => setShowCategoriesModal(false)}
                className='px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCategoriesModal(false)}
                className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
              >
                Save Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Connection Status Modal Component
  const ConnectionStatusModal = () => (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
      <div className='bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col'>
        <div className='flex items-center justify-between p-5 border-b border-gray-800'>
          <h3 className='text-xl font-semibold text-white flex items-center'>
            <Activity className='mr-2 h-5 w-5 text-blue-400' />
            Connection Status
          </h3>
          <button
            onClick={() => setShowConnectionStatus(false)}
            className='text-gray-400 hover:text-white transition-colors'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='p-5 overflow-y-auto flex-1'>
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-4'>
              <div className={`px-3 py-1 rounded-full text-white text-sm ${connectionHealth.color}`}>
                {connectionHealth.message}
              </div>
              {lastTestTime && (
                <span className='text-gray-400 text-sm'>
                  Last tested: {formatDate(lastTestTime)}
                </span>
              )}
            </div>
            <button
              onClick={testSelectedConnections}
              disabled={testingConnections}
              className='flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50'
            >
              {testingConnections ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <RefreshCw className='h-4 w-4 mr-2' />
              )}
              Test Connections
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {connectionTests.map((test) => (
              <div
                key={test.destinationId}
                className={`p-4 rounded-lg border-2 ${test.success
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-red-500 bg-red-500/10'
                  }`}
              >
                <div className='flex items-start justify-between mb-2'>
                  <div className='flex items-center gap-2'>
                    {test.platform === 'shopify' ? (
                      <Store className='h-4 w-4 text-green-400' />
                    ) : (
                      <Database className='h-4 w-4 text-blue-400' />
                    )}
                    <h4 className='font-medium text-white'>{test.destinationName}</h4>
                  </div>
                  {test.success ? (
                    <CheckCircle2 className='h-5 w-5 text-green-500' />
                  ) : (
                    <X className='h-5 w-5 text-red-500' />
                  )}
                </div>
                <p className={`text-sm ${test.success ? 'text-green-300' : 'text-red-300'}`}>
                  {test.message}
                </p>
                {test.responseTime && (
                  <p className='text-xs text-gray-400 mt-1'>
                    Response time: {test.responseTime}ms
                  </p>
                )}
              </div>
            ))}
          </div>

          {connectionTests.length === 0 && (
            <div className='text-center py-8'>
              <Activity className='h-8 w-8 mx-auto mb-4 text-gray-600' />
              <p className='text-gray-400'>No connection tests performed yet</p>
              <button
                onClick={testSelectedConnections}
                className='mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
              >
                Test Selected Destinations
              </button>
            </div>
          )}
        </div>

        <div className='p-4 border-t border-gray-800 flex justify-end'>
          <button
            onClick={() => setShowConnectionStatus(false)}
            className='px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // Destination Selection Modal Component
  const DestinationSelectionModal = () => (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
      <div className='bg-gray-900 rounded-xl shadow-2xl max-w-6xl w-full max-h-[80vh] overflow-hidden flex flex-col'>
        <div className='flex items-center justify-between p-5 border-b border-gray-800'>
          <h3 className='text-xl font-semibold text-white flex items-center'>
            <Target className='mr-2 h-5 w-5 text-blue-400' />
            Select Publishing Destinations
          </h3>
          <button
            onClick={() => setShowDestinationModal(false)}
            className='text-gray-400 hover:text-white transition-colors'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='p-5 overflow-y-auto flex-1'>
          {/* Shopify Destinations */}
          <div className='mb-8'>
            <div className='flex items-center justify-between mb-4'>
              <h4 className='text-lg font-medium text-white flex items-center'>
                <Store className='mr-2 h-5 w-5 text-green-400' />
                Shopify Stores ({selectedDestinations.shopify.size}/{activeDestinations.shopify.length})
              </h4>
              <div className='flex gap-2'>
                <button
                  onClick={() => selectAllDestinations('shopify')}
                  className='px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors'
                >
                  Select All
                </button>
                <button
                  onClick={() => deselectAllDestinations('shopify')}
                  className='px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors'
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {activeDestinations.shopify.map((destination) => {
                const isSelected = selectedDestinations.shopify.has(destination.id);
                return (
                  <div
                    key={destination.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                      }`}
                    onClick={() => toggleDestination('shopify', destination.id)}
                  >
                    <div className='flex items-start justify-between mb-2'>
                      <div className='flex items-center gap-2'>
                        <div className={`w-3 h-3 rounded-full ${destination.color} flex-shrink-0`}></div>
                        <span className='text-xs bg-gray-700 px-2 py-1 rounded'>
                          Priority: {destination.priority}
                        </span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className='h-5 w-5 text-green-500' />
                      ) : (
                        <div className='h-5 w-5 border-2 border-gray-400 rounded'></div>
                      )}
                    </div>
                    <h5 className='font-medium text-white mb-1'>{destination.name}</h5>
                    <p className='text-sm text-gray-400 mb-2'>{destination.description}</p>
                    <p className='text-xs text-gray-500 font-mono truncate'>{destination.shopDomain}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WordPress Destinations */}
          <div>
            <div className='flex items-center justify-between mb-4'>
              <h4 className='text-lg font-medium text-white flex items-center'>
                <Database className='mr-2 h-5 w-5 text-blue-400' />
                WordPress Sites ({selectedDestinations.wordpress.size}/{activeDestinations.wordpress.length})
              </h4>
              <div className='flex gap-2'>
                <button
                  onClick={() => selectAllDestinations('wordpress')}
                  className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
                >
                  Select All
                </button>
                <button
                  onClick={() => deselectAllDestinations('wordpress')}
                  className='px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors'
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {activeDestinations.wordpress.map((destination) => {
                const isSelected = selectedDestinations.wordpress.has(destination.id);
                const selectedCats = selectedCategories[destination.id] || [];
                return (
                  <div
                    key={destination.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                      }`}
                    onClick={() => toggleDestination('wordpress', destination.id)}
                  >
                    <div className='flex items-start justify-between mb-2'>
                      <div className='flex items-center gap-2'>
                        <div className={`w-3 h-3 rounded-full ${destination.color} flex-shrink-0`}></div>
                        <span className='text-xs bg-gray-700 px-2 py-1 rounded'>
                          Priority: {destination.priority}
                        </span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className='h-5 w-5 text-blue-500' />
                      ) : (
                        <div className='h-5 w-5 border-2 border-gray-400 rounded'></div>
                      )}
                    </div>
                    <h5 className='font-medium text-white mb-1'>{destination.name}</h5>
                    <p className='text-sm text-gray-400 mb-2'>{destination.description}</p>
                    <p className='text-xs text-gray-500 font-mono truncate'>
                      {new URL(destination.apiUrl).hostname}
                    </p>
                    {isSelected && selectedCats.length > 0 && (
                      <div className='mt-2 flex items-center text-xs text-blue-300'>
                        <Tag className='h-3 w-3 mr-1' />
                        {selectedCats.length} categories selected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className='p-4 border-t border-gray-800 flex justify-between items-center'>
          <div className='text-sm text-gray-400'>
            Total selected: {selectedDestinations.shopify.size + selectedDestinations.wordpress.size} destinations
          </div>
          <div className='flex gap-3'>
            <button
              onClick={() => setShowDestinationModal(false)}
              className='px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowDestinationModal(false);
                // Automatically test connections when destinations are changed
                setTimeout(() => testSelectedConnections(), 500);
              }}
              className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
            >
              Save & Test Connections
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className='min-h-screen bg-gray-900 p-6'>
      {/* Connection Status Modal */}
      {showConnectionStatus && <ConnectionStatusModal />}

      {/* Destination Selection Modal */}
      {showDestinationModal && <DestinationSelectionModal />}

      {/* Categories Selection Modal */}
      {showCategoriesModal && <CategoriesModal />}

      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <div className='flex items-center justify-center mb-4'>
            <div className='bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-xl'>
              <span className='text-white text-2xl'>⚡</span>
            </div>
          </div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Multi-Destination Blog Humanizer
          </h1>
          <p className='text-gray-300 max-w-2xl mx-auto'>
            Transform any blog post into engaging, humanized content and
            automatically publish to multiple Shopify stores and WordPress sites with custom categories.
          </p>
        </div>

        {/* Publishing Destinations Summary */}
        <div className='bg-gray-800 rounded-xl p-5 shadow-lg mb-6 border border-gray-700'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold flex items-center'>
              <Target className='mr-2 h-5 w-5 text-blue-400' />
              Publishing Destinations
            </h2>
            <div className='flex gap-2'>
              <button
                onClick={() => setShowConnectionStatus(true)}
                className={`flex items-center px-3 py-2 text-white rounded-lg transition-colors text-sm ${connectionHealth.color}`}
              >
                {connectionHealth.status === 'healthy' ? (
                  <Wifi className='h-4 w-4 mr-2' />
                ) : connectionHealth.status === 'degraded' ? (
                  <AlertTriangle className='h-4 w-4 mr-2' />
                ) : (
                  <WifiOff className='h-4 w-4 mr-2' />
                )}
                {connectionHealth.message}
              </button>
              {selectedDestinations.wordpress.size > 0 && (
                <button
                  onClick={() => setShowCategoriesModal(true)}
                  className='flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors'
                >
                  <Tag className='h-4 w-4 mr-2' />
                  Categories ({Object.values(selectedCategories).reduce((acc, cats) => acc + cats.length, 0)})
                </button>
              )}
              <button
                onClick={() => setShowDestinationModal(true)}
                className='flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
              >
                <Settings className='h-4 w-4 mr-2' />
                Configure
              </button>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-green-900/20 border border-green-800 rounded-lg p-4'>
              <h3 className='text-green-400 font-medium mb-3 flex items-center'>
                <Store className='h-4 w-4 mr-2' />
                Shopify Stores ({selectedDestinations.shopify.size})
              </h3>
              <div className='space-y-2'>
                {Array.from(selectedDestinations.shopify).map(destId => {
                  const dest = PUBLISHING_DESTINATIONS.shopify.find(d => d.id === destId);
                  const testResult = connectionTests.find(t => t.destinationId === destId);
                  return dest ? (
                    <div key={destId} className='text-sm text-green-300 flex items-center justify-between'>
                      <div className='flex items-center'>
                        <div className={`w-2 h-2 rounded-full ${dest.color} mr-2`}></div>
                        {dest.name}
                      </div>
                      {testResult && (
                        <div className={`w-2 h-2 rounded-full ${testResult.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      )}
                    </div>
                  ) : null;
                })}
                {selectedDestinations.shopify.size === 0 && (
                  <div className='text-sm text-gray-500'>None selected</div>
                )}
              </div>
            </div>

            <div className='bg-blue-900/20 border border-blue-800 rounded-lg p-4'>
              <h3 className='text-blue-400 font-medium mb-3 flex items-center'>
                <Database className='h-4 w-4 mr-2' />
                WordPress Sites ({selectedDestinations.wordpress.size})
              </h3>
              <div className='space-y-2'>
                {Array.from(selectedDestinations.wordpress).map(destId => {
                  const dest = PUBLISHING_DESTINATIONS.wordpress.find(d => d.id === destId);
                  const testResult = connectionTests.find(t => t.destinationId === destId);
                  const selectedCats = selectedCategories[destId] || [];
                  return dest ? (
                    <div key={destId} className='text-sm text-blue-300'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center'>
                          <div className={`w-2 h-2 rounded-full ${dest.color} mr-2`}></div>
                          {dest.name}
                        </div>
                        {testResult && (
                          <div className={`w-2 h-2 rounded-full ${testResult.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        )}
                      </div>
                      {selectedCats.length > 0 && (
                        <div className='text-xs text-blue-400 ml-4 flex items-center'>
                          <Tag className='h-3 w-3 mr-1' />
                          {selectedCats.length} categories
                        </div>
                      )}
                    </div>
                  ) : null;
                })}
                {selectedDestinations.wordpress.size === 0 && (
                  <div className='text-sm text-gray-500'>None selected</div>
                )}
              </div>
            </div>
          </div>
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
                    disabled={
                      isProcessing ||
                      !blogUrl.trim() ||
                      (selectedDestinations.shopify.size === 0 && selectedDestinations.wordpress.size === 0)
                    }
                    className={`flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center ${(selectedDestinations.shopify.size === 0 && selectedDestinations.wordpress.size === 0)
                      ? 'opacity-60 cursor-not-allowed'
                      : ''
                      }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className='h-5 w-5 mr-2 animate-spin' />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className='h-4 w-4 mr-2' />
                        Humanize & Publish to {selectedDestinations.shopify.size + selectedDestinations.wordpress.size} destinations
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
                        <strong>Source:</strong>{' '}
                        {result.blogData.source_domain || 'Unknown'}
                      </p>
                      {result.blogData.images && result.blogData.images.length > 0 && (
                        <p>
                          <strong>Images:</strong>{' '}
                          {result.blogData.images.length} found
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Multi-Destination Results Summary */}
                {result.totalDestinations && (
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6'>
                    <div className='text-center p-3 bg-blue-900/20 rounded-lg'>
                      <div className='text-xl font-bold text-blue-400'>
                        {result.totalDestinations}
                      </div>
                      <div className='text-blue-300 text-xs'>Total Destinations</div>
                    </div>
                    <div className='text-center p-3 bg-green-900/20 rounded-lg'>
                      <div className='text-xl font-bold text-green-400'>
                        {(result.shopifyPublished || 0) + (result.wordpressPublished || 0)}
                      </div>
                      <div className='text-green-300 text-xs'>Successfully Published</div>
                    </div>
                    <div className='text-center p-3 bg-purple-900/20 rounded-lg'>
                      <div className='text-xl font-bold text-purple-400'>
                        {result.shopifyPublished || 0}
                      </div>
                      <div className='text-purple-300 text-xs'>Shopify</div>
                    </div>
                    <div className='text-center p-3 bg-orange-900/20 rounded-lg'>
                      <div className='text-xl font-bold text-orange-400'>
                        {result.wordpressPublished || 0}
                      </div>
                      <div className='text-orange-300 text-xs'>WordPress</div>
                    </div>
                  </div>
                )}

                {/* Detailed destination results */}
                {result.publishingResults && (
                  <div className='bg-gray-700/50 rounded-lg p-6 mb-6'>
                    <h4 className='font-medium text-white mb-4'>Publishing Details</h4>

                    {result.publishingResults.shopify && result.publishingResults.shopify.length > 0 && (
                      <div className='mb-4'>
                        <h5 className='text-sm font-medium text-green-400 mb-2 flex items-center'>
                          <Store className='h-4 w-4 mr-1' />
                          Shopify Stores
                        </h5>
                        <div className='space-y-2'>
                          {result.publishingResults.shopify.map((shopifyResult, index) => (
                            <div key={index} className='flex items-center justify-between text-sm p-2 bg-gray-800 rounded'>
                              <span className='text-gray-300'>{shopifyResult.destination}</span>
                              <div className='flex items-center gap-2'>
                                {shopifyResult.success ? (
                                  <>
                                    <span className='text-green-400'>✓ Published</span>
                                    {shopifyResult.url && (
                                      <a
                                        href={shopifyResult.url}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-blue-400 hover:text-blue-300'
                                      >
                                        🔗
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <span className='text-red-400'>✗ Failed</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.publishingResults.wordpress && result.publishingResults.wordpress.length > 0 && (
                      <div>
                        <h5 className='text-sm font-medium text-blue-400 mb-2 flex items-center'>
                          <Database className='h-4 w-4 mr-1' />
                          WordPress Sites
                        </h5>
                        <div className='space-y-2'>
                          {result.publishingResults.wordpress.map((wpResult, index) => (
                            <div key={index} className='flex items-center justify-between text-sm p-2 bg-gray-800 rounded'>
                              <span className='text-gray-300'>{wpResult.destination}</span>
                              <div className='flex items-center gap-2'>
                                {wpResult.success ? (
                                  <>
                                    <span className='text-green-400'>✓ Published</span>
                                    {wpResult.url && (
                                      <a
                                        href={wpResult.url}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-blue-400 hover:text-blue-300'
                                      >
                                        🔗
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <span className='text-red-400'>✗ Failed</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy results fallback for single destinations */}
                {!result.publishingResults && (result.shopifySuccess !== undefined || result.wordpressSuccess !== undefined) && (
                  <div className='grid md:grid-cols-2 gap-6 mb-6'>
                    {/* Shopify Results */}
                    {result.shopifySuccess !== undefined && (
                      <div className='bg-green-900/20 border border-green-800 rounded-lg p-6'>
                        <div className='flex items-center mb-4'>
                          <div className='bg-green-600 p-2 rounded-lg'>
                            <Store className='text-white h-5 w-5' />
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
                    )}

                    {/* WordPress Results */}
                    {result.wordpressSuccess !== undefined && (
                      <div className='bg-blue-900/20 border border-blue-800 rounded-lg p-6'>
                        <div className='flex items-center mb-4'>
                          <div className='bg-blue-600 p-2 rounded-lg'>
                            <Database className='text-white h-5 w-5' />
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
                    )}
                  </div>
                )}

                {/* Humanized Content Preview */}
                {result.humanizedContent && (
                  <div className='bg-gray-700 border border-gray-600 rounded-lg p-6 mb-6'>
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
                <div className='flex gap-4'>
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
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <RefreshCw className='h-4 w-4 mr-2' />
                )}
                Refresh
              </button>
            </div>

            {isLoadingRecords ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='h-8 w-8 mr-3 animate-spin text-blue-400' />
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
                          {record.total_destinations && (
                            <span className='ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full'>
                              {(record.total_shopify_published || 0) + (record.total_wordpress_published || 0)}/{record.total_destinations} published
                            </span>
                          )}
                        </div>
                        <div className='flex items-center text-sm text-gray-400 mb-2'>
                          <Calendar className='w-4 h-4 mr-1' />
                          <span>Created: {formatDate(record.created_at)}</span>
                        </div>
                        {record.source_info.original_url && (
                          <div className='flex items-center text-sm text-gray-400'>
                            <Globe className='w-4 h-4 mr-1' />
                            <a
                              href={record.source_info.original_url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-blue-400 hover:text-blue-300 truncate'
                            >
                              {record.source_info.original_url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className='grid md:grid-cols-2 gap-4 mt-4'>
                      {/* Shopify Status */}
                      <div className='flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-600'>
                        <div className='flex items-center'>
                          <Store className='text-green-400 mr-2 h-4 w-4' />
                          <span className='text-sm font-medium text-gray-300'>
                            Shopify: {record.total_shopify_published || 0} published
                          </span>
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
                          <Database className='text-blue-400 mr-2 h-4 w-4' />
                          <span className='text-sm font-medium text-gray-300'>
                            WordPress: {record.total_wordpress_published || 0} published
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