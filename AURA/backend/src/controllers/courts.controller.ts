import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type {
  courtIdSchema,
  createCourtSchema,
  updateCourtSchema,
  venueIdSchema,
} from "@/utils/validation";

// GET /courts - Get all courts
export async function getAllCourts(c: Context<AuthContext>) {
  try {
    const venueId = c.req.query("venue_id");

    let query = supabase
      .from("courts")
      .select(
        `
        id,
        venue_id,
        court_number,
        venue (
          id,
          name,
          address
        )
      `
      )
      .order("venue_id", { ascending: true })
      .order("court_number", { ascending: true });

    if (venueId) {
      query = query.eq("venue_id", parseInt(venueId));
    }

    const { data: courts, error } = await query;

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { courts } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /venues/:id/courts - Get all courts for a venue
export async function getVenueCourts(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof venueIdSchema>;
    const venueId = parseInt(params.id);

    if (isNaN(venueId)) {
      throw new HTTPException(400, { message: "Invalid venue ID" });
    }

    const { data: courts, error } = await supabase
      .from("courts")
      .select("id, venue_id, court_number")
      .eq("venue_id", venueId)
      .order("court_number", { ascending: true });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { courts } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /courts/:id - Get court by ID
export async function getCourtById(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof courtIdSchema>;
    const courtId = parseInt(params.id);

    if (isNaN(courtId)) {
      throw new HTTPException(400, { message: "Invalid court ID" });
    }

    const { data: court, error } = await supabase
      .from("courts")
      .select(
        `
        id,
        venue_id,
        court_number,
        venue (
          id,
          name,
          address
        )
      `
      )
      .eq("id", courtId)
      .single();

    if (error || !court) {
      throw new HTTPException(404, { message: "Court not found" });
    }

    return c.json({ data: court });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /courts - Create a new court
export async function createCourt(c: Context<AuthContext>) {
  try {
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof createCourtSchema>;

    // Verify venue exists
    const { data: venue } = await supabase
      .from("venue")
      .select("id")
      .eq("id", body.venue_id)
      .single();

    if (!venue) {
      throw new HTTPException(404, { message: "Venue not found" });
    }

    // Check if court number already exists for this venue
    const { data: existingCourt } = await supabase
      .from("courts")
      .select("id")
      .eq("venue_id", body.venue_id)
      .eq("court_number", body.court_number)
      .single();

    if (existingCourt) {
      throw new HTTPException(409, {
        message: "Court number already exists for this venue",
      });
    }

    const { data: court, error } = await supabase
      .from("courts")
      .insert({
        venue_id: body.venue_id,
        court_number: body.court_number,
      })
      .select()
      .single();

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: court }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// PUT /courts/:id - Update court
export async function updateCourt(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof courtIdSchema>;
    const courtId = parseInt(params.id);
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof updateCourtSchema>;

    if (isNaN(courtId)) {
      throw new HTTPException(400, { message: "Invalid court ID" });
    }

    // Verify court exists
    const { data: existingCourt } = await supabase
      .from("courts")
      .select("venue_id, court_number")
      .eq("id", courtId)
      .single();

    if (!existingCourt) {
      throw new HTTPException(404, { message: "Court not found" });
    }

    // Verify venue exists if provided
    if (body.venue_id) {
      const { data: venue } = await supabase
        .from("venue")
        .select("id")
        .eq("id", body.venue_id)
        .single();

      if (!venue) {
        throw new HTTPException(404, { message: "Venue not found" });
      }
    }

    // Check if court number already exists for this venue
    const venueId = body.venue_id || existingCourt.venue_id;
    if (body.court_number) {
      const { data: existingCourtWithNumber } = await supabase
        .from("courts")
        .select("id")
        .eq("venue_id", venueId)
        .eq("court_number", body.court_number)
        .neq("id", courtId)
        .single();

      if (existingCourtWithNumber) {
        throw new HTTPException(409, {
          message: "Court number already exists for this venue",
        });
      }
    }

    const updateData: any = {};
    if (body.venue_id !== undefined) updateData.venue_id = body.venue_id;
    if (body.court_number !== undefined) updateData.court_number = body.court_number;

    const { data: court, error } = await supabase
      .from("courts")
      .update(updateData)
      .eq("id", courtId)
      .select()
      .single();

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: court });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /courts/:id - Delete court
export async function deleteCourt(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof courtIdSchema>;
    const courtId = parseInt(params.id);

    if (isNaN(courtId)) {
      throw new HTTPException(400, { message: "Invalid court ID" });
    }

    // Check if court is used in matches
    const { data: matches } = await supabase
      .from("matches")
      .select("id")
      .eq("court_id", courtId)
      .limit(1);

    if (matches && matches.length > 0) {
      throw new HTTPException(400, {
        message: "Cannot delete court that is used in matches",
      });
    }

    const { error } = await supabase.from("courts").delete().eq("id", courtId);

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

