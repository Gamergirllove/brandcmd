import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Privacy — BrandCMD",
  description: "What data BrandCMD collects, why, and how it is stored.",
};

/**
 * Factual description of what the application actually does with data,
 * written from the implementation rather than from a template.
 *
 * Google's OAuth verification requires a privacy policy URL for sensitive
 * scopes like youtube.readonly, so this page needs to exist and be
 * reachable. It is NOT a substitute for a reviewed legal document — see
 * the banner at the top.
 */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="heading text-lg">{title}</h2>
      <div className="space-y-3 text-sm text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="bg-surface"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/">
            <BrandLogo size={28} />
          </Link>
          <Link href="/" className="text-sm font-medium text-muted hover:text-[var(--text)]">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-12">
        <div>
          <h1 className="text-3xl font-bold">Privacy</h1>
          <p className="mt-2 text-sm text-dim">
            Describes BrandCMD as currently implemented.
          </p>
        </div>

        <div className="alert-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This page documents actual system behaviour. It has not been
            reviewed by a lawyer and is not a substitute for a legal privacy
            policy. Get it reviewed before opening the product to the public.
          </span>
        </div>

        <Section title="What we store">
          <p>When you use BrandCMD, the following is stored:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Account details</strong> — your email address and
              password, handled by Supabase Auth. Passwords are hashed by
              Supabase and are never visible to this application.
            </li>
            <li>
              <strong>Profile</strong> — the display name, creator handle and
              creator type you enter during onboarding.
            </li>
            <li>
              <strong>Platform credentials</strong> — OAuth access and refresh
              tokens for each platform you connect. These are encrypted before
              they are written to the database.
            </li>
            <li>
              <strong>Analytics</strong> — the follower, view, like, comment and
              share figures returned by each platform, plus goals you create.
            </li>
          </ul>
        </Section>

        <Section title="What we access on your platforms">
          <p>
            BrandCMD requests <strong>read-only</strong> access. It cannot post,
            edit, delete or modify anything on your accounts.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Twitch</strong> — your profile and email, follower count,
              subscriber count, and your archived broadcasts.
            </li>
            <li>
              <strong>YouTube</strong> — your channel details and the analytics
              reports YouTube exposes for your own channel.
            </li>
          </ul>
          <p>
            Use of information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </Section>

        <Section title="How tokens are protected">
          <p>
            Access and refresh tokens are encrypted with Fernet
            (AES-128-CBC with HMAC authentication) before being stored, using a
            key held only in the server environment. They are decrypted in
            memory when a request needs them, and are never sent to your
            browser.
          </p>
          <p>
            Row-level security is enabled on every table, so one account cannot
            read another&apos;s rows.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            Nobody. Your data is not sold, rented, or shared with advertisers or
            third parties. It moves between your browser, this application, and
            the platform APIs you explicitly connect.
          </p>
          <p>The infrastructure providers who process data on our behalf:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Supabase — database and authentication</li>
            <li>Render — application hosting</li>
            <li>Netlify — web hosting</li>
          </ul>
        </Section>

        <Section title="Disconnecting and deletion">
          <p>
            Disconnecting a platform in{" "}
            <strong>Settings → Connected Platforms</strong> deletes its stored
            tokens immediately.
          </p>
          <p>
            Deleting your account in <strong>Settings → Danger Zone</strong>{" "}
            removes your profile, goals, cached analytics and every stored
            token. This cannot be undone.
          </p>
          <p>
            You can revoke BrandCMD&apos;s access independently at any time from{" "}
            <a
              href="https://www.twitch.tv/settings/connections"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              Twitch connection settings
            </a>{" "}
            or{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              Google account permissions
            </a>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about your data can go to the address listed on the
            project&apos;s GitHub repository.
          </p>
        </Section>
      </main>

      <footer
        className="bg-surface"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div className="mx-auto max-w-3xl px-6 py-8 text-center text-sm text-dim">
          <span className="font-bold" style={{ color: "var(--text)" }}>
            BRAND
          </span>
          <span className="font-bold text-brand">CMD</span> © 2026
        </div>
      </footer>
    </div>
  );
}
