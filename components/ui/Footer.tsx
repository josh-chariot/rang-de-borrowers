import { cn } from "./cn";

/**
 * Figma: Common Assets > Footer > Full (browsing pages), desktop and mobile.
 * Compact and Compact + security proof are not built yet.
 */
const NAV = ["FAQs", "About", "Social Investors", "Track Record", "Blog", "Contact", "Partner with Us"];
const SOCIAL = ["Facebook", "LinkedIn", "YouTube", "X", "Instagram"];
const POLICIES = [
  ["Terms", "Loan Terms & Conditions", "Pricing Structure Policy"],
  ["Privacy Policy", "Data Usage and Protection", "Grievance Redressal Policy"],
  ["Fair Practices Code", "Annual Returns"],
];

const LEGAL = "flex flex-col gap-4 text-h6 font-medium tracking-normal text-text-grey-64";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("pb-8 pt-r8", className)}>
      <div className="mx-auto flex w-full max-w-footer flex-col items-center gap-8 px-4">
        <div className="flex w-full flex-col items-center gap-r4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
          <img src="/brand/rangde-tree.svg" width={74} height={84} alt="" aria-hidden="true" className="my-2" />
          <nav className="flex flex-wrap justify-center gap-x-r4 gap-y-2 md:gap-x-8">
            {NAV.map((label) => (
              <a key={label} href="#" className="text-p1 font-bold text-text-grey-100 hover:text-primary-100">
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex w-full flex-col items-center justify-between gap-r4 md:flex-row">
          <div className="flex items-end gap-r4 text-p2 font-medium text-text-grey-80">
            <a href="#" className="hover:text-primary-100">Impact Partners</a>
            <span aria-hidden="true">·</span>
            <a href="#" className="hover:text-primary-100">In the Press</a>
          </div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/brand/social-icons.svg" width={226} height={20} alt="" aria-hidden="true" className="block" />
            <div className="absolute inset-zero grid grid-cols-5">
              {SOCIAL.map((label) => (
                <a key={label} href="#" aria-label={label} />
              ))}
            </div>
          </div>
        </div>

        <hr className="w-full border-text-grey-16" />

        <div className="flex w-full flex-col items-center justify-between gap-r4 text-center md:flex-row md:items-start md:text-left">
          <div className="flex flex-col items-center gap-4 md:max-w-2xl md:flex-row md:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- static PNG */}
            <img src="/brand/rbi-seal.png" width={48} height={48} alt="RBI seal" className="shrink-0 opacity-40" />
            <div className={LEGAL}>
              <p>Rang De is an RBI registered NBFC P2P platform vide Certificate of Registration (COR) No. : N - 02-00319</p>
              <p>
                Reserve Bank of India does not accept any responsibility for the correctness of any of the statements or
                representations made or opinions expressed by Rang De P2P Financial Services Pvt. Ltd, and does not provide
                any assurance for repayment of the loans lent on it.
              </p>
            </div>
          </div>
          <div className={cn(LEGAL, "items-center md:items-end md:text-right")}>
            <p>© 2024, Rang De P2P Financial Services Pvt. Ltd.</p>
            <p>
              {POLICIES.map((row, r) => (
                <span key={r} className="block">
                  {row.map((label, i) => (
                    <span key={label}>
                      {i > 0 && <span className="px-2">·</span>}
                      <a href="#" className="underline decoration-from-font hover:text-primary-100">
                        {label}
                      </a>
                    </span>
                  ))}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
