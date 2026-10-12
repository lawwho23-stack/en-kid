import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Auth.js tables (required by @auth/drizzle-adapter, PostgreSQL variant).
// Identity lives here; the app stores only a reference (see `parents`).
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// App tables (from docs/architecture.md section 10).
// UUIDs are generated client-side so no Postgres extension is needed.
// ---------------------------------------------------------------------------

export const parents = pgTable("parents", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  authUserId: text("auth_user_id").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const childProfiles = pgTable("child_profiles", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => parents.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  ageBand: text("age_band").notNull(), // '1-2' | '3-4' | '5'
  avatarId: text("avatar_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const wordProgress = pgTable(
  "word_progress",
  {
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),
    mastery: smallint("mastery").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    missCount: integer("miss_count").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.childId, t.wordId] })],
);

export const stickers = pgTable(
  "stickers",
  {
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    stickerId: text("sticker_id").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.stickerId] })],
);

export const childState = pgTable("child_state", {
  childId: uuid("child_id")
    .primaryKey()
    .references(() => childProfiles.id, { onDelete: "cascade" }),
  totalStars: integer("total_stars").notNull().default(0),
  unlockedWorlds: text("unlocked_worlds")
    .array()
    .notNull()
    .default(["animal-farm"]),
  outfitIds: text("outfit_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const playSessions = pgTable("play_sessions", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  childId: uuid("child_id")
    .notNull()
    .references(() => childProfiles.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  durationSec: integer("duration_sec"),
  worldId: text("world_id"),
});

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  ],
);
