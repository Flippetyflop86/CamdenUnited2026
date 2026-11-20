import Link from "next/link";
import { ArrowLeft, FileText, CreditCard, Mail } from "lucide-react";

export const metadata = {
    title: "Terms of Service & Payment Policy | ClubFlow",
    description:
        "Terms of Service, Subscription Terms, and Stripe Connect Refund & Dispute Policy for ClubFlow (clubflow.org.uk).",
};

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-[#060911] text-neutral-200 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to ClubFlow
                    </Link>
                    <Link
                        href="/privacy"
                        className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                    >
                        Privacy Policy →
                    </Link>
                </div>

                <div className="rounded-3xl bg-[#0d1322] border border-white/10 p-6 sm:p-10 space-y-8 shadow-2xl">
                    <div className="space-y-3 border-b border-white/10 pb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5" /> SaaS Terms &amp; Payment Policy
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            Terms of Service
                        </h1>
                        <p className="text-xs text-neutral-400">
                            Effective Date: 15 November 2026 • Applies to{" "}
                            <span className="text-neutral-200 font-semibold">www.clubflow.org.uk</span>
                        </p>
                    </div>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
                        <p>
                            By creating a club workspace, accepting a staff invitation, or completing a payment via
                            ClubFlow (<span className="text-white">clubflow.org.uk</span>), you agree to these Terms of
                            Service and our{" "}
                            <Link href="/privacy" className="text-red-400 underline hover:text-red-300">
                                Privacy Policy
                            </Link>
                            . You confirm that you are authorised to act on behalf of your football club when creating or
                            managing a club workspace or connecting a club bank account.
                        </p>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">2. Club Ownership of Data &amp; Acceptable Use</h2>
                        <p>
                            Your football club retains <strong>100% ownership</strong> of all squad lists, match records,
                            scouting notes, and financial records uploaded to your workspace. You agree not to upload
                            unlawful content, send unsolicited spam to individuals outside your club, or attempt to access
                            another club&apos;s workspace without authorisation.
                        </p>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">3. ClubFlow SaaS Subscriptions &amp; Cancellation</h2>
                        <p>
                            Paid ClubFlow workspace plans are billed monthly in GBP (£) via Stripe Checkout following any
                            applicable free trial period. Club Managers or Treasurers can cancel a subscription at any time
                            in one click under <strong>Administration → Billing</strong> with zero cancellation fees.
                            Cancellations stop future recurring renewals immediately.
                        </p>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-indigo-400" />
                            4. ClubFlow Pay &amp; Stripe Connect (Player Subs, Fees &amp; Fines)
                        </h2>
                        <p>
                            Clubs collecting player match subs, monthly memberships, signing-on fees, kit orders, or club
                            fines through ClubFlow Pay connect their own club or treasurer bank account via{" "}
                            <strong>Stripe Connect</strong> and are bound by the{" "}
                            <a
                                href="https://stripe.com/gb/legal/connect-account"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-300 underline hover:text-indigo-200"
                            >
                                Stripe Connected Account Agreement
                            </a>
                            .
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>
                                <strong className="text-white">Direct Club Settlement:</strong> Player payments are collected on
                                behalf of the connected football club and settled directly to the club&apos;s verified bank
                                account minus transparent processing/platform fees shown prior to checkout.
                            </li>
                            <li>
                                <strong className="text-white">Authorised Signatory:</strong> Where a Club Manager delegates bank
                                setup to a Club Treasurer or Secretary, the individual completing Stripe Connect onboarding
                                confirms they are authorised by the club committee to operate the nominated bank account.
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">5. Refund &amp; Payment Dispute Policy</h2>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>
                                <strong className="text-white">Player Subs, Match Fees &amp; Club Payments:</strong> Because player
                                payments are collected directly for your football club, refund requests for overpaid subs,
                                cancelled fixtures, or waived fines should be directed first to your{" "}
                                <strong>Club Manager or Club Treasurer</strong>, who can issue a refund from their Stripe
                                Express Payouts Dashboard. Each connected club is financially responsible for refunds,
                                reversals, or card chargebacks on its own player payments.
                            </li>
                            <li>
                                <strong className="text-white">ClubFlow Workspace Subscriptions:</strong> If your club was charged
                                in error for a ClubFlow SaaS subscription, contact{" "}
                                <a
                                    href="mailto:support@clubflow.org.uk"
                                    className="text-white underline hover:text-emerald-300"
                                >
                                    support@clubflow.org.uk
                                </a>{" "}
                                within 14 days of the charge and we will review and refund duplicate or accidental charges
                                promptly.
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">6. Service Availability, Liability &amp; Governing Law</h2>
                        <p>
                            ClubFlow is provided on an &ldquo;as available&rdquo; basis. To the maximum extent permitted by UK law,
                            ClubFlow&apos;s aggregate liability to any club shall not exceed the total SaaS subscription fees
                            paid by that club in the preceding 12 months. Nothing in these Terms excludes liability that
                            cannot be excluded under English law. These Terms are governed by the laws of{" "}
                            <strong>England and Wales</strong>.
                        </p>
                    </section>

                    <section className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <span className="text-neutral-300">
                            Questions, billing help, or support:{" "}
                            <a
                                href="mailto:support@clubflow.org.uk"
                                className="text-white font-bold underline hover:text-indigo-300"
                            >
                                support@clubflow.org.uk
                            </a>
                        </span>
                        <a
                            href="mailto:support@clubflow.org.uk"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold shrink-0"
                        >
                            <Mail className="w-3.5 h-3.5" /> Email Support
                        </a>
                    </section>
                </div>
            </div>
        </div>
    );
}
