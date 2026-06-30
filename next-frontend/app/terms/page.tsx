import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — StreamTube",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <h1 className="text-h1">Terms of Service</h1>
      <p className="text-caption text-muted-foreground">Last updated: January 1, 2025</p>

      <section className="space-y-3">
        <h2 className="text-h2">1. Acceptance of Terms</h2>
        <p className="text-body-md text-foreground">
          By accessing or using StreamTube you agree to be bound by these Terms of Service.
          If you do not agree to these terms, please do not use our platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">2. Use of the Service</h2>
        <p className="text-body-md text-foreground">
          StreamTube grants you a limited, non-exclusive, non-transferable license to access and
          use the platform for personal, non-commercial purposes. You agree not to misuse the
          service or help anyone else do so.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">3. User Accounts</h2>
        <p className="text-body-md text-foreground">
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activities that occur under your account. You must notify us immediately
          of any unauthorized use of your account.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">4. Content</h2>
        <p className="text-body-md text-foreground">
          You retain ownership of any content you upload to StreamTube. By uploading content
          you grant us a worldwide, royalty-free license to host, store, and display that
          content solely for the purpose of operating the platform.
        </p>
        <p className="text-body-md text-foreground">
          You must not upload content that is unlawful, harmful, threatening, abusive,
          defamatory, or otherwise objectionable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">5. Prohibited Activities</h2>
        <ul className="list-disc pl-6 space-y-1 text-body-md text-foreground">
          <li>Uploading copyrighted material without permission</li>
          <li>Impersonating another person or entity</li>
          <li>Attempting to gain unauthorized access to the platform</li>
          <li>Distributing spam or malicious content</li>
          <li>Interfering with the normal operation of the service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">6. Termination</h2>
        <p className="text-body-md text-foreground">
          We reserve the right to suspend or terminate your account at any time if you violate
          these Terms of Service. You may also delete your account at any time by contacting us.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">7. Disclaimer of Warranties</h2>
        <p className="text-body-md text-foreground">
          StreamTube is provided &ldquo;as is&rdquo; without warranty of any kind. We do not
          guarantee that the service will be uninterrupted, error-free, or free of harmful
          components.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">8. Changes to These Terms</h2>
        <p className="text-body-md text-foreground">
          We may update these Terms of Service from time to time. Continued use of StreamTube
          after any changes constitutes your acceptance of the new terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">9. Contact</h2>
        <p className="text-body-md text-foreground">
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:support@streamtube.local" className="text-link hover:underline">
            support@streamtube.local
          </a>
          .
        </p>
      </section>
    </div>
  );
}
