import { Bag } from '@/types';
import { generateEmptyBoard, generateNewBag } from '@/utils';
import { relations } from 'drizzle-orm';
import { boolean, char, integer, json, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  board: char('board').array().array().notNull().$default(generateEmptyBoard),
  turn: text('turn'),
  gameStarted: boolean('game_started').notNull(),
  bag: json('bag').$type<Bag>().notNull().$default(generateNewBag),
  winner: text('winner'),
  wordsCreated: text('words_created').array().notNull().$default(() => []),
  blitz: boolean('fast_mode').notNull().default(false),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
  users: many(users),
}));

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  roomId: text('room_id'),
  ready: boolean('ready').notNull().default(false),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  rack: char('rack').array().notNull().$default(() => []),
  score: integer('score').notNull().default(0),
});

export const usersRelations = relations(users, ({ one }) => ({
  room: one(rooms, {
    fields: [users.roomId],
    references: [rooms.id],
  }),
}));
