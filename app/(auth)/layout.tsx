/**
 * Layout for the auth pages (login and register): a centered card on
 * cream with the logo up top. These pages intentionally have no site
 * nav — the only job here is finishing the sign-in at hand.
 */
import Link from "next/link";
import { LogoLockup } from "@/components/buddies-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        className="mb-8 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <LogoLockup />
      </Link>
      <main className="w-full max-w-md">{children}</main>
      <p className="mt-8 max-w-md text-center text-sm text-ink-muted font-['Times_New_Roman']">
        Not officially affiliated with the University of Minnesota.
      </p>
    </div>
  );
}
