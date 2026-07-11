export default function DeleteAccountPage() {
  return (
    <main className="public-policy-page">
      <section className="public-policy-panel">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Delete Your OWVO Account</h1>
        <p>
          OWVO customers and providers can delete their account and request removal of personal data
          from inside the OWVO app.
        </p>
        <ol>
          <li>Open the OWVO app.</li>
          <li>Go to Help.</li>
          <li>Select Delete Account and confirm the request.</li>
        </ol>
        <p>
          If you cannot access the app, email OWVO support with your account email address, role
          (customer or provider), and the words “Delete my OWVO account”.
        </p>
        <a href="mailto:support@owvo.co.uk?subject=Delete%20my%20OWVO%20account">
          Request deletion by email
        </a>
        <p className="public-policy-footnote">
          Some records may be retained where required for legal, tax, fraud-prevention, payment,
          dispute, or safety obligations. Personal data that is no longer required will be deleted
          or anonymised according to the OWVO retention policy.
        </p>
      </section>
    </main>
  );
}
