export async function POST(request) {
  try {
    const { destinations } = await request.json();

    if (!destinations || !Array.isArray(destinations)) {
      return Response.json({ error: 'Invalid destinations provided' }, { status: 400 });
    }

    const results = [];

    // Test each destination
    for (const destination of destinations) {
      const startTime = Date.now();

      try {
        const response = await fetch(
          `https://${destination.shopDomain}/admin/api/2023-10/shop.json`,
          {
            headers: {
              'X-Shopify-Access-Token': destination.accessToken,
              'Content-Type': 'application/json',
            },
          }
        );

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
        const responseTime = Date.now() - startTime;
        results.push({
          success: false,
          destinationId: destination.id,
          destinationName: destination.name,
          platform: 'shopify',
          message: `Connection error: ${error.message}`,
          responseTime,
          lastTested: new Date().toISOString(),
        });
      }
    }

    return Response.json({
      results,
      success: true
    });

  } catch (error) {
    console.error('API Error:', error);
    return Response.json({
      error: 'Failed to test connections',
      details: error.message
    }, { status: 500 });
  }
}
