// /api/shopify/collections/route.js

export async function POST(request) {
  try {
    const { destinations } = await request.json();

    if (!destinations || !Array.isArray(destinations)) {
      return Response.json({ error: 'Invalid destinations provided' }, { status: 400 });
    }

    const allCollections = [];

    for (const destination of destinations) {
      try {
        const shopDomain = destination.shopDomain;
        const accessToken = destination.accessToken;

        // Fetch both custom and smart collections
        const [customRes, smartRes] = await Promise.all([
          fetch(`https://${shopDomain}/admin/api/2024-01/custom_collections.json`, {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }),
          fetch(`https://${shopDomain}/admin/api/2024-01/smart_collections.json`, {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }),
        ]);

        const customData = customRes.ok ? await customRes.json() : { custom_collections: [] };
        const smartData = smartRes.ok ? await smartRes.json() : { smart_collections: [] };

        const combinedCollections = [
          ...customData.custom_collections,
          ...smartData.smart_collections,
        ];

        const formatted = combinedCollections.map((collection) => ({
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          description: collection.body_html || '',
          image: collection.image || null,
          published_scope: collection.published_scope,
          sort_order: collection.sort_order || '',
          products_count: collection.products_count || 0,
          collection_type: collection.rules ? 'smart' : 'custom',
          destinationId: destination.id,
          destinationName: destination.name,
        }));

        allCollections.push(...formatted);

      } catch (err) {
        console.error(`Error fetching collections for ${destination.name}:`, err);
      }
    }

    return Response.json({
      collections: allCollections,
      success: true,
    });

  } catch (err) {
    console.error('API Error:', err);
    return Response.json({
      error: 'Failed to fetch collections',
      details: err.message,
    }, { status: 500 });
  }
}
