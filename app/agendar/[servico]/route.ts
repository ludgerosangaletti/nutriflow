const serviceMessages: Record<string, string> = {
  presencial: "uma consulta presencial",
  mentoria: "uma sessão de mentoria",
  avaliacao: "uma avaliação física",
  geral: "um atendimento",
};

const periodMessages: Record<string, string> = {
  manha: "manhã",
  tarde: "tarde",
  noite: "noite",
  combinar: "a combinar",
};

const dayMessages: Record<string, string> = {
  segunda: "segunda-feira",
  terca: "terça-feira",
  quarta: "quarta-feira",
  quinta: "quinta-feira",
  sexta: "sexta-feira",
  sabado: "sábado",
  domingo: "domingo",
  flexivel: "sem preferência",
};

const appointmentMessages: Record<string, string> = {
  primeira: "Este será meu primeiro atendimento.",
  retorno: "Já sou paciente.",
  "nao-informado": "",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ servico: string }> },
) {
  const { servico } = await context.params;
  const [
    service = "geral",
    period = "combinar",
    day = "flexivel",
    ...appointmentParts
  ] = servico.split("-");
  const appointment = appointmentParts.join("-") || "nao-informado";
  const serviceMessage = serviceMessages[service] || serviceMessages.geral;
  const periodMessage = periodMessages[period] || periodMessages.combinar;
  const dayMessage = dayMessages[day] || dayMessages.flexivel;
  const appointmentMessage = appointmentMessages[appointment] || "";
  const message = [
    `Olá! Recebi as informações pelo atendimento automático e quero agendar ${serviceMessage}.`,
    `Meu dia de preferência é: ${dayMessage}.`,
    `Minha preferência de período é: ${periodMessage}.`,
    appointmentMessage,
  ]
    .filter(Boolean)
    .join("\n");
  const destination = `https://wa.me/5542999876280?text=${encodeURIComponent(message)}`;

  return Response.redirect(destination, 302);
}
