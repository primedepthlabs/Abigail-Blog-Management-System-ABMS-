export const config = {
  runtime: 'edge',
  schedule: '0 * * * *', // Runs every hour
};

export default async function handler(request: Request) {
  // Your logic here
  console.log('Cron job executed at', new Date());

  return new Response('Cron task executed', {
    status: 200,
  });
}
