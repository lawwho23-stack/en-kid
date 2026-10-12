import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "./lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "./lib/db/schema";

/**
 * Auth.js v5 config. Email magic link is the only production provider
 * (parent signs up with email, child never sees login).
 *
 * ALLOW_DEV_LOGIN=true adds a passwordless "Dev login" button that accepts
 * any email. It exists so the full parent flow can be tested end-to-end
 * without real SMTP. NEVER enable it in production.
 */
const providers: Provider[] = [
  Nodemailer({
    server: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    from: process.env.SMTP_FROM ?? "Kids English <login@example.com>",
  }),
];

if (process.env.ALLOW_DEV_LOGIN === "true") {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev login",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        if (!email || !email.includes("@")) return null;
        return { id: email, email };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  // Credentials (dev login) requires JWT sessions; email links work with
  // either strategy. Users are still created in the DB via the adapter.
  session: { strategy: "jwt" },
  trustHost: true,
  debug: process.env.AUTH_DEBUG === "true",
});
