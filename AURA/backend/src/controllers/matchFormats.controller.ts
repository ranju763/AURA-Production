import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type {
  matchFormatIdSchema,
  createMatchFormatSchema,
  updateMatchFormatSchema,
} from "@/utils/validation";

// GET /match-formats - Get all match formats
export async function getAllMatchFormats(c: Context<AuthContext>) {
  try {
    const { data: matchFormats, error } = await supabase
      .from("match_format")
      .select("id, type, min_age, max_age, eligible_gender, total_rounds, metadata")
      .order("type", { ascending: true });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { match_formats: matchFormats } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /match-formats/:id - Get match format by ID
export async function getMatchFormatById(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof matchFormatIdSchema>;
    const matchFormatId = parseInt(params.id);

    if (isNaN(matchFormatId)) {
      throw new HTTPException(400, { message: "Invalid match format ID" });
    }

    const { data: matchFormat, error } = await supabase
      .from("match_format")
      .select("id, type, min_age, max_age, eligible_gender, total_rounds, metadata")
      .eq("id", matchFormatId)
      .single();

    if (error || !matchFormat) {
      throw new HTTPException(404, { message: "Match format not found" });
    }

    return c.json({ data: matchFormat });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /match-formats - Create a new match format
export async function createMatchFormat(c: Context<AuthContext>) {
  try {
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof createMatchFormatSchema>;

    // Validate age range
    if (body.min_age !== undefined && body.max_age !== undefined && body.max_age < body.min_age) {
      throw new HTTPException(400, { message: "max_age must be >= min_age" });
    }

    const { data: matchFormat, error } = await supabase
      .from("match_format")
      .insert({
        type: body.type,
        min_age: body.min_age || null,
        max_age: body.max_age || null,
        eligible_gender: body.eligible_gender,
        total_rounds: body.total_rounds || 0,
        metadata: body.metadata || null,
      })
      .select()
      .single();

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: matchFormat }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// PUT /match-formats/:id - Update match format
export async function updateMatchFormat(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof matchFormatIdSchema>;
    const matchFormatId = parseInt(params.id);
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof updateMatchFormatSchema>;

    if (isNaN(matchFormatId)) {
      throw new HTTPException(400, { message: "Invalid match format ID" });
    }

    // Validate age range if both are provided
    if (body.min_age !== undefined && body.max_age !== undefined && body.max_age < body.min_age) {
      throw new HTTPException(400, { message: "max_age must be >= min_age" });
    }

    const updateData: any = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.min_age !== undefined) updateData.min_age = body.min_age;
    if (body.max_age !== undefined) updateData.max_age = body.max_age;
    if (body.eligible_gender !== undefined) updateData.eligible_gender = body.eligible_gender;
    if (body.total_rounds !== undefined) updateData.total_rounds = body.total_rounds;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data: matchFormat, error } = await supabase
      .from("match_format")
      .update(updateData)
      .eq("id", matchFormatId)
      .select()
      .single();

    if (error || !matchFormat) {
      throw new HTTPException(404, { message: "Match format not found" });
    }

    return c.json({ data: matchFormat });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /match-formats/:id - Delete match format
export async function deleteMatchFormat(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof matchFormatIdSchema>;
    const matchFormatId = parseInt(params.id);

    if (isNaN(matchFormatId)) {
      throw new HTTPException(400, { message: "Invalid match format ID" });
    }

    // Check if match format is used in tournaments
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("id")
      .eq("match_format_id", matchFormatId)
      .limit(1);

    if (tournaments && tournaments.length > 0) {
      throw new HTTPException(400, {
        message: "Cannot delete match format that is used in tournaments",
      });
    }

    const { error } = await supabase
      .from("match_format")
      .delete()
      .eq("id", matchFormatId);

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

