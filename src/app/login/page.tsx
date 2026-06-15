import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand" aria-label="OWVO">
          <span className="brand-mark" />
          <span className="brand-word">owvo</span>
        </div>
        <div className="login-copy">
          <h1>Operations control for OWVO London.</h1>
          <p>
            Secure admin and staff access for bookings, providers, reports, payouts, and launch
            operations connected to the existing OWVO backend.
          </p>
        </div>
      </section>
      <section className="login-form-panel">
        <LoginForm />
      </section>
    </main>
  );
}
