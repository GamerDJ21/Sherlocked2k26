// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const teams=sqliteTable('teams',{id:text().primaryKey(),name:text().notNull().unique(),code:text().notNull().unique()});
export const members=sqliteTable('members',{id:text().primaryKey(),team:text().notNull()});
export const questions=sqliteTable('questions',{id:text().primaryKey(),title:text().notNull(),prompt:text().notNull(),format:text().notNull(),options:text().notNull(),answer:text().notNull(),points:integer().notNull(),published:integer().notNull(),opens:integer().notNull(),closes:integer().notNull()});
export const attempts=sqliteTable('attempts',{id:text().primaryKey(),team:text().notNull(),question:text().notNull(),answer:text().notNull(),correct:integer().notNull(),at:integer().notNull()});
export const solves=sqliteTable('solves',{id:text().primaryKey(),team:text().notNull(),question:text().notNull(),points:integer().notNull(),at:integer().notNull(),duration:integer()},t=>[uniqueIndex('one_solve').on(t.team,t.question)]);
export const starts=sqliteTable('question_starts',{id:text().primaryKey(),team:text().notNull(),question:text().notNull(),at:integer().notNull()},t=>[uniqueIndex('one_start').on(t.team,t.question)]);
export const events=sqliteTable('events',{id:text().primaryKey(),team:text().notNull(),kind:text().notNull(),question:text().notNull(),at:integer().notNull()});
export const throttles=sqliteTable('throttles',{id:text().primaryKey(),at:integer().notNull()});
