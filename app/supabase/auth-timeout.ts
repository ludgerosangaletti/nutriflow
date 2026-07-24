export class AuthTimeoutError extends Error {
  constructor() {
    super("AUTH_REQUEST_TIMEOUT");
    this.name = "AuthTimeoutError";
  }
}

export async function withAuthTimeout<T>(
  request: PromiseLike<T>,
  timeoutMs = 20_000,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new AuthTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function signupErrorMessage(error: unknown) {
  if (error instanceof AuthTimeoutError) {
    return "A conexão com o sistema de cadastro demorou mais que o esperado. Verifique primeiro se recebeu o e-mail de confirmação. Se não recebeu, aguarde um minuto e tente novamente.";
  }
  if (error instanceof Error && error.message.toLowerCase().includes("already")) {
    return "Este e-mail já possui uma conta. Entre com sua senha ou use a recuperação de acesso.";
  }
  return "Não foi possível concluir o cadastro. Confira sua conexão e tente novamente em alguns instantes.";
}
