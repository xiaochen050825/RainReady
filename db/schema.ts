import {integer,sqliteTable,text,primaryKey} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{
 ownerId:text('owner_id').primaryKey(),
 revision:integer('revision').notNull(),
 objectKey:text('object_key').notNull(),
 updatedAt:text('updated_at').notNull(),
});
export const routeCache=sqliteTable('route_cache',{id:text('id').primaryKey(),data:text('data').notNull(),expiresAt:integer('expires_at').notNull()});
export const serviceLimits=sqliteTable('service_limits',{id:text('id').primaryKey(),nextAt:integer('next_at').notNull()});

export const workspaceChunks=sqliteTable('workspace_chunks',{objectKey:text('object_key').notNull(),part:integer('part').notNull(),content:text('content').notNull()},t=>[primaryKey({columns:[t.objectKey,t.part]})]);
