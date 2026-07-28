import LegalLayout from "../legal-layout";

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Condições dos serviços digitais"
      title="Termos de Uso"
      intro="Ao utilizar este site, a área do paciente ou o canal automatizado no WhatsApp, você concorda com as condições descritas abaixo."
    >
      <section>
        <h2>1. Finalidade</h2>
        <p>
          O site apresenta serviços de nutrição, permite cadastro e contratação,
          disponibiliza recursos de acompanhamento e oferece informações iniciais
          por meio do WhatsApp profissional.
        </p>
      </section>

      <section>
        <h2>2. Informações e atendimento profissional</h2>
        <p>
          Conteúdos públicos e respostas automáticas têm caráter informativo.
          Eles não constituem diagnóstico, prescrição ou orientação nutricional
          individualizada. Condutas clínicas dependem de avaliação profissional
          e das informações apresentadas pelo paciente.
        </p>
      </section>

      <section>
        <h2>3. Cadastro e segurança</h2>
        <p>
          O usuário deve fornecer informações verdadeiras, manter suas credenciais
          em segurança e comunicar suspeitas de acesso indevido. O acesso à área
          do paciente é pessoal e não deve ser compartilhado.
        </p>
      </section>

      <section>
        <h2>4. Pagamentos</h2>
        <p>
          Pagamentos são concluídos em ambiente de fornecedor especializado. As
          condições, parcelas, juros e meios disponíveis são apresentados antes
          da confirmação. O site não armazena os dados completos do cartão.
        </p>
      </section>

      <section>
        <h2>5. Uso adequado</h2>
        <p>
          Não é permitido tentar acessar contas de terceiros, interferir no
          funcionamento do serviço, explorar vulnerabilidades, transmitir
          conteúdo ilícito ou utilizar os canais para assédio, fraude ou spam.
        </p>
      </section>

      <section>
        <h2>6. Disponibilidade e alterações</h2>
        <p>
          Recursos digitais podem passar por manutenção, atualização ou
          indisponibilidade temporária. Funcionalidades e estes termos poderão
          ser ajustados quando necessário, preservados os direitos aplicáveis.
        </p>
      </section>

      <section>
        <h2>7. Privacidade e contato</h2>
        <p>
          O tratamento de dados está descrito na{" "}
          <a href="/politica-de-privacidade">Política de Privacidade</a>. Para
          dúvidas sobre estes termos, utilize o WhatsApp profissional{" "}
          <a href="https://wa.me/5542999876280">+55 42 99987-6280</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
