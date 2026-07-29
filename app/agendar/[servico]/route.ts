const destinations = {
  presencial:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20agendar%20uma%20consulta%20presencial.",
  mentoria:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20agendar%20uma%20sess%C3%A3o%20de%20mentoria.",
  avaliacao:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20agendar%20uma%20avalia%C3%A7%C3%A3o%20f%C3%ADsica.",
  geral:
    "https://wa.me/5542999876280?text=Ol%C3%A1%2C%20recebi%20as%20informa%C3%A7%C3%B5es%20pelo%20atendimento%20autom%C3%A1tico%20e%20quero%20prosseguir%20com%20um%20agendamento.",
} as const;

type Service = keyof typeof destinations;

export async function GET(
  _request: Request,
  context: { params: Promise<{ servico: string }> },
) {
  const { servico } = await context.params;
  const destination =
    destinations[servico as Service] || destinations.geral;

  return Response.redirect(destination, 302);
}
