import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — StreamTube",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <h1 className="text-h1">Privacy Policy</h1>
      <p className="text-caption text-muted-foreground">Last updated: January 1, 2025</p>

      <section className="space-y-3">
        <h2 className="text-h2">1. Information We Collect</h2>
        <p className="text-body-md text-foreground">
          We collect information you provide directly to us when you create an account, upload
          videos, or interact with the platform. This includes:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-body-md text-foreground">
          <li>Account information (name, email address, password)</li>
          <li>Content you upload (videos, thumbnails, descriptions)</li>
          <li>Communications you send to us</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">2. How We Use Your Information</h2>
        <p className="text-body-md text-foreground">
          We use the information we collect to operate, maintain, and improve StreamTube,
          including to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-body-md text-foreground">
          <li>Create and manage your account</li>
          <li>Process and host your uploaded videos</li>
          <li>Send transactional emails (account confirmation, password reset)</li>
          <li>Respond to your comments and questions</li>
          <li>Monitor and analyze usage trends to improve the platform</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">3. Information Sharing</h2>
        <p className="text-body-md text-foreground">
          We do not sell, trade, or otherwise transfer your personal information to third parties
          except as described in this policy. We may share information with service providers
          who assist in operating the platform, provided they agree to keep it confidential.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">4. Data Storage and Security</h2>
        <p className="text-body-md text-foreground">
          Your data is stored on secure servers. We implement reasonable technical and
          organizational measures to protect your information against unauthorized access,
          alteration, disclosure, or destruction. However, no method of transmission over
          the internet is 100% secure.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">5. Cookies</h2>
        <p className="text-body-md text-foreground">
          We use session cookies to keep you logged in. These cookies are essential for the
          platform to function and do not track you across other websites.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">6. Your Rights</h2>
        <p className="text-body-md text-foreground">
          You have the right to access, correct, or delete the personal information we hold
          about you. You may also request that we restrict or stop processing your data.
          To exercise these rights, contact us using the details below.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">7. Children&apos;s Privacy</h2>
        <p className="text-body-md text-foreground">
          StreamTube is not directed at children under 13 years of age. We do not knowingly
          collect personal information from children under 13. If we learn that we have
          collected such information, we will delete it promptly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">8. Changes to This Policy</h2>
        <p className="text-body-md text-foreground">
          We may update this Privacy Policy from time to time. We will notify you of significant
          changes by posting the new policy on this page with an updated date.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">9. Contact Us</h2>
        <p className="text-body-md text-foreground">
          If you have questions or concerns about this Privacy Policy, please contact us at{" "}
          <a href="mailto:privacy@streamtube.local" className="text-link hover:underline">
            privacy@streamtube.local
          </a>
          .
        </p>
      </section>
    </div>
  );
}
