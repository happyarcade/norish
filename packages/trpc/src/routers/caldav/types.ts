export type {
  CaldavItemType,
  CaldavSubscriptionEvents,
  CaldavSyncStatus,
} from "@norish/queue/events/caldav";

import { z } from "zod";

export const SaveCaldavConfigInputSchema = z.object({
  serverUrl: z.url(),
  calendarUrl: z.url().optional().nullable(),
  username: z.string().min(1),
  password: z.string().optional(),
  enabled: z.boolean(),
  breakfastTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  lunchTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  dinnerTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  snackTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
});

export const TestCaldavConnectionInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const DeleteCaldavConfigInputSchema = z.object({
  deleteEvents: z.boolean().default(false),
});

export const GetSyncStatusInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  statusFilter: z.enum(["pending", "synced", "failed", "removed"]).optional(),
});

export const FetchCalendarsInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export type SaveCaldavConfigInput = z.infer<typeof SaveCaldavConfigInputSchema>;
export type TestCaldavConnectionInput = z.infer<typeof TestCaldavConnectionInputSchema>;
export type DeleteCaldavConfigInput = z.infer<typeof DeleteCaldavConfigInputSchema>;
export type GetSyncStatusInput = z.infer<typeof GetSyncStatusInputSchema>;
export type FetchCalendarsInput = z.infer<typeof FetchCalendarsInputSchema>;
