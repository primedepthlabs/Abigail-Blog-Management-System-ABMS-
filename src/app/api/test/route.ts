import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const data = await req.json();

  console.log(data, 'here is the data');

  return NextResponse.json({ message: 'Data received successfully', data });
}

export async function GET() {
  return NextResponse.json({ message: 'Get also working' });
}
