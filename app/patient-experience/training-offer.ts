export const TRAINING_OFFER_FEATURES = Object.freeze([
  { title: "Planilha individual", description: "Montada a partir da sua avaliação, rotina e equipamentos disponíveis." },
  { title: "Ajustes periódicos", description: "Revisada junto com o seu acompanhamento nutricional." },
  { title: "Vídeos de execução", description: "Para não ficar dúvida sobre como fazer cada exercício." },
  { title: "Tudo no aplicativo", description: "O treino do dia aparece aqui, ao lado do plano alimentar." },
]);

export function buildTrainingWhatsAppUrl(input: Readonly<{
  phone: string;
  patientFirstName?: string;
  nutritionistName?: string;
}>) {
  const phone = input.phone.replace(/\D/g, "");
  const greeting = input.nutritionistName ? `Olá, ${input.nutritionistName}!` : "Olá!";
  const patient = input.patientFirstName
    ? ` Sou ${input.patientFirstName}, paciente do acompanhamento nutricional.`
    : " Sou paciente do acompanhamento nutricional.";
  const message = `${greeting}${patient} Gostaria de saber sobre o acompanhamento de treino.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
