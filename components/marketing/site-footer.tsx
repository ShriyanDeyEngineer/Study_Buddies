/**
 * Site footer — page links, the team, contact, and the affiliation
 * disclaimer the spec requires on every page. Primary-dark background per
 * the design system (accent/white text both clear WCAG AA on it).
 */
import Link from "next/link";
import { LogoLockup } from "@/components/buddies-logo";
import { CONTACT_EMAIL } from "@/lib/site";

/* The team. Two contributors asked not to be publicly named (they appear
   as "anonymous"); respect that. */
const TEAM = ["Shriyan Dey", "anonymous", "Aadi Sharma", "anonymous"];

export function SiteFooter() {
  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div>
          <LogoLockup dark />
          <p className="mt-3 text-sm text-white/70">
            Find your study buddies!
          </p>
        </div>

        <nav aria-label="Footer" className="text-sm">
          <h2 className="mb-3 font-medium text-accent-light">Pages</h2>
          <ul className="space-y-2">
            {/* Footer sits on primary-dark, so — unlike the rest of the app
                — the focus ring stays accent here, not the site-wide primary
                default: a primary ring would vanish against this background. */}
            <li><Link href="/" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Home</Link></li>
            <li><Link href="/about" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">About us</Link></li>
            <li><Link href="/why" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Why Use it</Link></li>
            <li><Link href="/testimonials" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Testimonials</Link></li>
            <li><Link href="/communityRulesGuidelines" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Community Guidelines</Link></li>
            <li><Link href="/accessibility" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Accessibility</Link></li>
            <li><Link href="/register" className="rounded text-white/80 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Sign up</Link></li>
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="mb-3 font-medium text-accent-light">The Team</h2>
          <p className="text-white/80">{TEAM.join(" · ")}</p>
          <p className="mt-3 text-white/80 font-bold font-['Times_New_Roman']">
            Please send any feedback or report any issues to our email: &#8200;
            <a href={`mailto:${CONTACT_EMAIL}`} className="rounded text-white/80 underline underline-offset-2 hover:text-accent-light font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-3 text-white/80 font-['Times_New_Roman']">
            <span className="font-bold">Socials: &#8200;</span>
            <ul>
              <li>
                Instagram: &#8200;
                <a href="https://www.instagram.com/studybuddiesmn?igsi=MXB6dzg3MHEyaGJubA==" target="_blank" rel="noopener noreferrer" className="rounded text-white/80 underline underline-offset-2 hover:text-accent-light font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">
                  @studybuddiesmn
                </a>
              </li>
            </ul>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60 font-['Times_New_Roman']">
        Built by UMN students, for UMN students. Study Buddies is an independent project and is not affiliated with, sponsored by, or endorsed by the University of Minnesota. &ldquo;University of Minnesota&rdquo; and related names and marks are trademarks of the University of Minnesota, used here only to identify the community this tool serves.

        <p className="mt-2 text-center text-xs text-white/60">
          <Link href="/terms_of_service" target="_self" className="rounded text-white/80 hover:text-accent-light font-['Times_New_Roman'] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Terms & Conditions</Link>
          &#8200;||&#8200;
          <Link href="/privacy_policy" target="_self" className="rounded text-white/80 hover:text-accent-light font-['Times_New_Roman'] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light">Privacy Policy</Link>
        </p>
        <p className="mt-2 text-center text-xs text-white/60 font-['Times_New_Roman']">
          &copy; 2026 Study Buddies
        </p>
      </div>
    </footer>
  );
}
