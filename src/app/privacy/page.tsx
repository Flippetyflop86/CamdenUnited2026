import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Mail } from "lucide-react";

export const metadata = {
    title: "Privacy Policy | ClubFlow",
    description:
        "UK GDPR Privacy Policy, Youth Safeguarding, and Data Protection notice for ClubFlow (clubflow.org.uk).",
};

export default function PrivacyPolicyPage() {
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
                        href="/terms"
                        className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                    >
                        Terms of Service →
                    </Link>
                </div>

                <div className="rounded-3xl bg-[#0d1322] border border-white/10 p-6 sm:p-10 space-y-8 shadow-2xl">
                    <div className="space-y-3 border-b border-white/10 pb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5" /> UK GDPR &amp; Data Protection Act 2018
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            Privacy Policy
                        </h1>
                        <p className="text-xs text-neutral-400">
                            Effective Date: 15 November 2026 • Applies to{" "}
                            <span className="text-neutral-200 font-semibold">www.clubflow.org.uk</span>
                        </p>
                    </div>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">1. Who We Are &amp; Controller vs. Processor Roles</h2>
                        <p>
                            ClubFlow (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides cloud software for grassroots,
                            semi-professional, and academy football clubs to manage squads, fixtures, attendance, and
                            club payments.
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5 text-neutral-300">
                            <li>
                                <strong className="text-white">Club Administrators &amp; Account Holders:</strong> ClubFlow acts as
                                the <strong>Data Controller</strong> for account registration, billing, and platform security data of
                                club managers, coaches, treasurers, and secretaries who register a workspace.
                            </li>
                            <li>
                                <strong className="text-white">Squad Players &amp; Club Members:</strong> Each football club acts as
                                the <strong>Data Controller</strong> for the squad roster, attendance records, fitness notes, and
                                payment requests entered into its private workspace, while ClubFlow acts as the{" "}
                                <strong>Data Processor</strong> acting strictly on that club&apos;s instructions.
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">2. Information We Collect</h2>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>
                                <strong className="text-white">Account &amp; Staff Details:</strong> Name, email address, encrypted
                                authentication credentials, club role, and workspace permissions.
                            </li>
                            <li>
                                <strong className="text-white">Squad &amp; Football Operations Data:</strong> Player names, shirt
                                numbers, playing positions, match appearances, goals, assists, disciplinary cards, training
                                attendance, and optional contact details (such as email address for automated availability
                                or payment notifications).
                            </li>
                            <li>
                                <strong className="text-white">Availability &amp; Fitness Status:</strong> Optional availability
                                responses and sporting injury status entered by club staff or players solely for team
                                selection.
                            </li>
                            <li>
                                <strong className="text-white">Payment &amp; Payout Metadata:</strong> Payment request amounts, due
                                dates, settlement status, and Stripe session identifiers.{" "}
                                <strong className="text-emerald-300">
                                    ClubFlow never collects, sees, or stores full debit/credit card numbers or bank login
                                    credentials
                                </strong>{" "}
                                — all card, Apple Pay, Google Pay, and bank verification flows are processed directly by{" "}
                                <strong>Stripe Payments UK Ltd</strong> (PCI-DSS Level 1 certified).
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">3. Youth &amp; Academy Players (Under-18 Safeguarding)</h2>
                        <p>
                            Clubs managing youth or academy squads are responsible for ensuring appropriate parental or
                            guardian consent is obtained before entering under-18 player details. For youth teams, clubs
                            should enter a <strong>parent or legal guardian&apos;s email address</strong> rather than a child&apos;s
                            personal email for availability and subs notifications. Public payment and availability links
                            expose only minimal necessary fields and never publish private contact details or internal
                            coaching notes.
                        </p>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">4. Lawful Basis &amp; How Data Is Used</h2>
                        <p>We process personal data solely to:</p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Provide and secure your club&apos;s workspace (Contractual Necessity);</li>
                            <li>
                                Deliver transactional club notifications such as match/training availability links, staff
                                invites, and unanswered payment reminders requested by your club (Legitimate Interests /
                                Contractual Necessity);
                            </li>
                            <li>
                                Process club subscriptions and player-to-club payments via Stripe Connect, and maintain
                                statutory accounting records (Legal Obligation).
                            </li>
                        </ul>
                        <p className="font-semibold text-white">
                            We never sell, rent, or share club or player data with third-party advertisers.
                        </p>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">5. Trusted Infrastructure &amp; Sub-Processors</h2>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>
                                <strong className="text-white">Supabase:</strong> Encrypted database storage and authentication.
                            </li>
                            <li>
                                <strong className="text-white">Stripe:</strong> Payment processing, Apple Pay / Google Pay checkout,
                                and Stripe Connect club bank payouts.
                            </li>
                            <li>
                                <strong className="text-white">Vercel:</strong> Secure cloud application hosting and TLS encryption.
                            </li>
                            <li>
                                <strong className="text-white">Transactional SMTP Provider:</strong> Delivery of club invites and
                                payment/availability emails.
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-2.5 text-sm text-neutral-300 leading-relaxed">
                        <h2 className="text-lg font-bold text-white">6. Data Retention &amp; Your UK GDPR Rights</h2>
                        <p>
                            Club Managers can edit or permanently delete players, fixtures, payment requests, or their
                            entire club workspace at any time from inside the application. Under the UK GDPR, individuals
                            have the right to access, rectify, export, restrict, or request erasure of their personal data,
                            and the right to lodge a complaint with the UK Information Commissioner&apos;s Office (
                            <span className="text-neutral-200">ico.org.uk</span>).
                        </p>
                    </section>

                    <section className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 text-neutral-300">
                            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>
                                Privacy, GDPR &amp; Data Deletion Requests:{" "}
                                <a
                                    href="mailto:support@clubflow.org.uk"
                                    className="text-white font-bold underline hover:text-emerald-300"
                                >
                                    support@clubflow.org.uk
                                </a>
                            </span>
                        </div>
                        <a
                            href="mailto:support@clubflow.org.uk"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold shrink-0"
                        >
                            <Mail className="w-3.5 h-3.5" /> Contact Privacy Team
                        </a>
                    </section>
                </div>
            </div>
        </div>
    );
}
