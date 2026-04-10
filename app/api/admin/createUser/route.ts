import { NextResponse } from "next/server";

export async function POST(request: Request) {
  return NextResponse.json(
    { error: "This admin endpoint has been removed. Use the client-side admin UI to create users." },
    { status: 410 }
  );
}
