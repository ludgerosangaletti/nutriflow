import LoginForm from "../entrar/login-form";

export const dynamic = "force-dynamic";

export default function AppEntryPage() {
  return (
    <main className="portal-shell auth-page app-entry-page">
      <LoginForm next="/area-cliente" confirmationError={false} appMode />
    </main>
  );
}
