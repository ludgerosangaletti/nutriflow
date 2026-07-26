import { getAdminSession } from "../../../supabase/server";

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  void request;
  return Response.json(
    { error: "Atualize a página e tente publicar o documento novamente." },
    { status: 409 },
  );
}
