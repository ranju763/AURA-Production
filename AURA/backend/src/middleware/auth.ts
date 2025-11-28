import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";

export interface AuthContext {
  Variables: {
    userId: string;
    playerId: string;
    userEmail: string | null;
  };
}

export const authMiddleware = async (c: Context, next: Next) => {

  // c.set("userId", "f2c6833f-d6db-4bf2-b82c-60b880a74f70");
  // c.set("playerId", "p1");
  // c.set("userEmail", "player1@test.com");

  // await next();
  // return;
  
  try {
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader) {
      throw new HTTPException(401, { message: "Missing Authorization header" });
    }

    // Extract Bearer token
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      throw new HTTPException(401, { message: "Missing token" });
    }

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }

    // Get player ID from players table using user_id
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (playerError || !player) {
      throw new HTTPException(404, { message: "Player not found for user" });
    }

    // Attach user and player IDs to context
    c.set("userId", user.id);
    c.set("playerId", player.id);
    c.set("userEmail", user.email || null);

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: "Authentication error" });
  }
};

