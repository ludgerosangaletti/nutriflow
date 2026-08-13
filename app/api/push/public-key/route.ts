export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return Response.json({ error: "push_not_configured" }, { status: 503 });
  }

  return Response.json(
    { publicKey },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
