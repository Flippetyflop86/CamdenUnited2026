import nodemailer from "nodemailer";

interface EmailPayload {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailPayload): Promise<boolean> {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || '"ClubFlow" <noreply@clubflow.org.uk>';

    if (!host || !user || !pass) {
        console.log("\n=======================================================");
        console.log(`[DEV MODE] MOCK EMAIL SENT`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:\n${text}`);
        console.log("=======================================================\n");
        return true;
    }

    try {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass,
            },
        });

        await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html: html || text.replace(/\n/g, "<br>"),
        });

        return true;
    } catch (error) {
        console.error("Failed to send email via SMTP:", error);
        // Fallback to console in case of failure to not block test flow
        console.log("\n=======================================================");
        console.log(`[SMTP FAIL MOCK FALLBACK] EMAIL DETAILED BELOW`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:\n${text}`);
        console.log("=======================================================\n");
        return false;
    }
}
