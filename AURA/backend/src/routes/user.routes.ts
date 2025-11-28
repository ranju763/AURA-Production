import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { getUserDetails } from "@/controllers/user.controller";

export const userRoutes = new Hono<AuthContext>();

// GET /user/details - Get comprehensive user details
userRoutes.get("/details", authMiddleware, getUserDetails);
