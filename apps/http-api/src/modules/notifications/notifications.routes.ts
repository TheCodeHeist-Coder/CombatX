import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  getNotifications,
  postMarkRead,
} from "./notifications.controller.js";

/**
 * Notification routes.
 *
 * Both require an account and both read the caller's identity from the token
 * rather than a path parameter — there is deliberately no way to ask for
 * somebody else's notifications, so no ownership check can be forgotten.
 */
export const notificationRoutes: Router = Router();

notificationRoutes.get(
  "/me/notifications",
  requireAuth,
  asyncHandler(getNotifications),
);
notificationRoutes.post(
  "/me/notifications/read",
  requireAuth,
  asyncHandler(postMarkRead),
);
