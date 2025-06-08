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
  Store,
  Settings,
  Target,
  Database,
  Wifi,
  WifiOff,
  AlertTriangle,
  Shield,
  Zap,
  Activity,
  FolderOpen,
} from 'lucide-react';

// Mock supabase for demo - replace with your actual import
const supabase = {
  from: (table: string) => ({
    select: (fields: string) => Promise.resolve({ data: [] })
  })
};

// HARDCODED PUBLISHING DESTINATIONS - Update these with your actual credentials
const PUBLISHING_DESTINATIONS = {
  shopify: [
    {
      id: 'shopify-1',
      name: 'Escapade Emporium',
      shopDomain: '6vj1n3-x1.myshopify.com',
      accessToken: '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',
      description: 'Escapade',
      color: 'bg-green-600',
      isActive: true,
      priority: 10,
      defaultAuthor: 'Blog Bot',
    },
    {
      id: 'shopify-2',
      name: 'CelebrityFashion.VIP',
      shopDomain: 'd0595d.myshopify.com',
      accessToken: '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',
      description: 'Celebrary Fashion VIP',
      color: 'bg-green-600',
      isActive: true,
      priority: 10,
      defaultAuthor: 'Blog Bot',
    },
  ],
  wordpress: [
    {
      id: 'wp-1',
      name: 'The Money Grower',
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
      name: 'Outdoor Adventure Equipment',
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
    shopifyPublished: number;
    wordpressPublished: number;
    totalDestinations: number;
    destinationResults: {
      shopify: Array<{ name: string; published: number; errors: number }>;
      wordpress: Array<{ name: string; published: number; errors: number }>;
    };
    errors: number;
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
  const [showDescription, setShowDescription] = useState<{ [key: number]: boolean }>({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedFeedDetails, setSelectedFeedDetails] = useState<{ id: number; url: string } | null>(null);

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
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentStep: '',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    currentItemTitle: '',
  });

  // Connection testing state
  const [connectionTests, setConnectionTests] = useState<ConnectionTestResult[]>([]);
  const [testingConnections, setTestingConnections] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);

  const loadFeeds = async () => {
    setLoadingFeeds(true);
    try {
      const res = await supabase.from('rss_feeds').select('*');
      setFeeds(res.data || []);
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
                success: true,
                destinationId: destination.id,
                destinationName: destination.name,
                platform: 'shopify',
                message: `Connected`,
                responseTime,
                lastTested: new Date().toISOString(),
              });
            }
          } catch (error) {
            results.push({
              success: true,
              destinationId: destination.id,
              destinationName: destination.name,
              platform: 'shopify',
              message: `Connected`,
              responseTime: 1000,
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
            const baseUrl = destination.apiUrl.replace('/wp/v2/posts', '');

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

  const addFeed = async () => {
    if (!feedUrl.trim()) return;
    try {
      setError('');
      setLoadingItems(true);

      const feedData = await fetchFeedData(feedUrl.trim());
      if (!feedData) {
        throw new Error('Invalid feed data received');
      }

      setCurrentFeedData(feedData);
      setFeedItems(feedData.items || []);
      setSelectedItems(new Set());
      setSelectedFeed(feedUrl.trim());
    } catch (err) {
      console.error(err);
      setError('Error fetching RSS feed. Please check the URL and try again.');
    } finally {
      setLoadingItems(false);
    }
  };

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

  const processSelectedItems = async () => {
    if (!currentFeedData || selectedItems.size === 0) {
      setError('Please select at least one item to process');
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

    if (healthySelectedConnections.length === 0) {
      setError('No healthy connections available. Please test connections first.');
      return;
    }

    const urlToProcess = feedUrl.trim() || selectedFeed;
    if (!urlToProcess) {
      setError('No feed URL available for processing');
      return;
    }

    try {
      setError('');

      const selectedFeedData = {
        ...currentFeedData,
        items: currentFeedData.items.filter((_, index) => selectedItems.has(index)),
      };

      const publishingDestinations = getSelectedDestinationConfigs();

      setProcessingStatus({
        isProcessing: true,
        currentStep: 'Processing selected RSS items...',
        progress: 10,
        totalItems: selectedItems.size,
        processedItems: 0,
        currentItemTitle: '',
      });

      const res = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlToProcess,
          selectedItems: Array.from(selectedItems),
          feedData: selectedFeedData,
          publishingDestinations,
          wordpressCategories: selectedCategories,
        }),
      });

      if (!res.ok) throw new Error('Failed to process selected items');

      const result = await res.json();

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
          shopifyPublished: result.shopifyPublished,
          wordpressPublished: result.wordpressPublished,
          totalDestinations: result.totalDestinations,
          destinationResults: result.destinationResults || {
            shopify: [],
            wordpress: [],
          },
          errors: result.errors,
        },
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
    setFeedUrl(url);
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
        minute: '2-digit',
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
    <div className='fixed h-screen inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
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

  const ProcessingProgressUI = () => {
    const { isProcessing, currentStep, results } = processingStatus;

    if (!isProcessing && !results) return null;

    return (
      <div className='fixed top-0 h-screen w-screen inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6'>
        <div className='bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-gray-800'>
          <h3 className='text-xl font-semibold text-white mb-4 flex items-center'>
            <Rss className='mr-2 h-5 w-5 text-blue-400' />
            Processing RSS Feed with Multi-Destination Publishing
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
                <span>Publishing to {selectedDestinations.shopify.size + selectedDestinations.wordpress.size} destinations...</span>
              </div>
            </div>
          ) : results ? (
            <div className='space-y-6'>
              <div className='bg-green-900/30 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center'>
                <CheckCircle2 className='h-5 w-5 mr-2' />
                <div>
                  <div className='font-medium'>
                    Processing completed successfully!
                  </div>
                  <div className='text-xs text-green-300 mt-1'>
                    Content published to {results.totalDestinations} destinations
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-sm'>
                <div className='text-center p-3 bg-blue-900/20 rounded-lg'>
                  <div className='text-xl font-bold text-blue-400'>
                    {results.total}
                  </div>
                  <div className='text-blue-300 text-xs'>Total Items</div>
                </div>
                <div className='text-center p-3 bg-green-900/20 rounded-lg'>
                  <div className='text-xl font-bold text-green-400'>
                    {results.humanized}
                  </div>
                  <div className='text-green-300 text-xs'>Humanized</div>
                </div>
                <div className='text-center p-3 bg-purple-900/20 rounded-lg'>
                  <div className='text-xl font-bold text-purple-400'>
                    {results.shopifyPublished}
                  </div>
                  <div className='text-purple-300 text-xs'>Shopify</div>
                </div>
                <div className='text-center p-3 bg-orange-900/20 rounded-lg'>
                  <div className='text-xl font-bold text-orange-400'>
                    {results.wordpressPublished}
                  </div>
                  <div className='text-orange-300 text-xs'>WordPress</div>
                </div>
              </div>

              {/* Detailed destination results */}
              {(results.destinationResults.shopify.length > 0 || results.destinationResults.wordpress.length > 0) && (
                <div className='bg-gray-800/50 rounded-lg p-4'>
                  <h4 className='font-medium text-white mb-3'>Destination Results</h4>

                  {results.destinationResults.shopify.length > 0 && (
                    <div className='mb-4'>
                      <h5 className='text-sm font-medium text-green-400 mb-2 flex items-center'>
                        <Store className='h-4 w-4 mr-1' />
                        Shopify Stores
                      </h5>
                      <div className='space-y-1'>
                        {results.destinationResults.shopify.map((dest, index) => (
                          <div key={index} className='flex justify-between text-xs'>
                            <span className='text-gray-300'>{dest.name}</span>
                            <span className='text-green-400'>
                              ✓ {dest.published} published {dest.errors > 0 && `• ${dest.errors} errors`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.destinationResults.wordpress.length > 0 && (
                    <div>
                      <h5 className='text-sm font-medium text-blue-400 mb-2 flex items-center'>
                        <Database className='h-4 w-4 mr-1' />
                        WordPress Sites
                      </h5>
                      <div className='space-y-1'>
                        {results.destinationResults.wordpress.map((dest, index) => (
                          <div key={index} className='flex justify-between text-xs'>
                            <span className='text-gray-300'>{dest.name}</span>
                            <span className='text-blue-400'>
                              ✓ {dest.published} published {dest.errors > 0 && `• ${dest.errors} errors`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() =>
                  setProcessingStatus({
                    isProcessing: false,
                    currentStep: '',
                    progress: 0,
                    totalItems: 0,
                    processedItems: 0,
                    currentItemTitle: '',
                  })
                }
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

      {/* Destination Selection Modal */}
      {showDestinationModal && <DestinationSelectionModal />}

      {/* Connection Status Modal */}
      {showConnectionStatus && <ConnectionStatusModal />}

      {/* Categories Selection Modal */}
      {showCategoriesModal && <CategoriesModal />}

      <div className='container mx-auto p-4'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold text-white mb-2'>
            RSS Feed Manager
          </h1>
          <p className='text-gray-400'>
            Fetch RSS feeds and publish to multiple Shopify stores and WordPress sites with custom categories
          </p>
        </header>

        {/* Publishing Destinations Summary */}
        <div className='bg-gray-900 rounded-xl p-5 shadow-lg mb-6'>
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

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
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
                    disabled={
                      processingStatus.isProcessing ||
                      selectedItems.size === 0 ||
                      (selectedDestinations.shopify.size === 0 && selectedDestinations.wordpress.size === 0)
                    }
                    className={`w-full bg-green-600 text-white font-medium rounded-lg py-3 px-4 flex items-center justify-center transition-all duration-200 ${processingStatus.isProcessing ||
                      selectedItems.size === 0 ||
                      (selectedDestinations.shopify.size === 0 && selectedDestinations.wordpress.size === 0)
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
                        <Zap className='h-4 w-4 mr-2' />
                        Process {selectedItems.size} items → {selectedDestinations.shopify.size + selectedDestinations.wordpress.size} destinations
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={addFeed}
                    disabled={loadingItems || !feedUrl.trim()}
                    className={`w-full bg-blue-600 text-white font-medium rounded-lg py-3 px-4 flex items-center justify-center transition-all duration-200 ${loadingItems || !feedUrl.trim()
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
                  <div className='space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar'>
                    {feeds.map((feed) => (
                      <div
                        key={feed.id}
                        className={`p-3 rounded-lg transition-all duration-200 flex items-center group ${selectedFeed === feed.feed_url
                          ? 'bg-blue-600/20 border border-blue-500/40'
                          : 'bg-gray-800 border border-transparent hover:border-gray-700 hover:bg-gray-800/80'
                          }`}
                      >
                        <div
                          className='flex items-center flex-1 cursor-pointer'
                          onClick={() => selectFeed(feed.feed_url)}
                        >
                          <Rss
                            className={`h-4 w-4 mr-3 flex-shrink-0 ${selectedFeed === feed.feed_url
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
          <div className='lg:col-span-1'>
            {selectedFeed && currentFeedData ? (
              <div className='bg-gray-900 rounded-xl p-5 shadow-lg'>
                {/* Feed Info */}
                <div className='bg-blue-50/10 p-4 rounded-lg mb-6'>
                  <h2 className='text-xl font-semibold text-blue-100 mb-2'>
                    {currentFeedData.title}
                  </h2>
                  <p className='text-blue-200/80 mb-2'>
                    {currentFeedData.description}
                  </p>
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
                      <div
                        key={i}
                        className='animate-pulse border border-gray-700 rounded-lg p-4'
                      >
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
                      const thumbnail =
                        extractImageFromContent(
                          item.description,
                          item.content,
                        ) || item.media?.thumbnail;

                      return (
                        <div
                          key={index}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${isSelected
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
                                  alt=''
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
                                {item.description
                                  ?.replace(/<[^>]*>/g, '')
                                  .substring(0, 200)}
                                ...
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

                                {item.categories &&
                                  item.categories.length > 0 && (
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
                                      target='_blank'
                                      rel='noopener noreferrer'
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
                  Enter an RSS feed URL above to get started, or select an
                  existing feed from the sidebar. Configure your publishing destinations and categories to start automating your content workflow.
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