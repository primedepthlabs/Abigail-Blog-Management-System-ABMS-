export async function POST(request) {
  try {
    const { destinations } = await request.json();

    if (!destinations || !Array.isArray(destinations)) {
      return Response.json({ error: 'Invalid destinations provided' }, { status: 400 });
    }

    const allBlogs = [];

    // Fetch blogs for each destination
    for (const destination of destinations) {
      try {
        const response = await fetch(
          `https://${destination.shopDomain}/admin/api/2023-10/blogs.json`,
          {
            headers: {
              'X-Shopify-Access-Token': destination.accessToken,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const blogs = data.blogs || [];

          const formattedBlogs = blogs.map((blog) => ({
            id: blog.id,
            title: blog.title,
            handle: blog.handle,
            url: `https://${destination.shopDomain}/blogs/${blog.handle}`,
            commentable: blog.commentable,
            feedburner: blog.feedburner,
            feedburner_location: blog.feedburner_location,
            created_at: blog.created_at,
            updated_at: blog.updated_at,
            destinationId: destination.id,
            destinationName: destination.name,
            shopDomain: destination.shopDomain
          }));

          allBlogs.push(...formattedBlogs);
        } else {
          console.error(`Failed to fetch blogs for ${destination.name}:`, response.status);
        }
      } catch (error) {
        console.error(`Error fetching blogs for ${destination.name}:`, error);
      }
    }

    return Response.json({
      blogs: allBlogs,
      success: true
    });

  } catch (error) {
    console.error('API Error:', error);
    return Response.json({
      error: 'Failed to fetch blogs',
      details: error.message
    }, { status: 500 });
  }
}