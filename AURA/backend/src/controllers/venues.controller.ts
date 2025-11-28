import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type {
  venueIdSchema,
  createVenueSchema,
  updateVenueSchema,
} from "@/utils/validation";

// GET /venues - Get all venues
export async function getAllVenues(c: Context<AuthContext>) {
  try {
    const { data: venues, error } = await supabase
      .from("venue")
      .select("id, name, address, metadata, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { venues } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /venues/:id - Get venue by ID
export async function getVenueById(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof venueIdSchema>;
    const venueId = parseInt(params.id);

    if (isNaN(venueId)) {
      throw new HTTPException(400, { message: "Invalid venue ID" });
    }

    const { data: venue, error } = await supabase
      .from("venue")
      .select("id, name, address, metadata, created_at, updated_at")
      .eq("id", venueId)
      .single();

    if (error || !venue) {
      throw new HTTPException(404, { message: "Venue not found" });
    }

    // Get courts for this venue
    const { data: courts } = await supabase
      .from("courts")
      .select("id, court_number")
      .eq("venue_id", venueId)
      .order("court_number", { ascending: true });

    return c.json({
      data: {
        ...venue,
        courts: courts || [],
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /venues - Create a new venue
export async function createVenue(c: Context<AuthContext>) {
  try {
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof createVenueSchema>;

    const { data: venue, error } = await supabase
      .from("venue")
      .insert({
        name: body.name,
        address: body.address,
        metadata: body.metadata || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: venue }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// PUT /venues/:id - Update venue
export async function updateVenue(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof venueIdSchema>;
    const venueId = parseInt(params.id);
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof updateVenueSchema>;

    if (isNaN(venueId)) {
      throw new HTTPException(400, { message: "Invalid venue ID" });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const { data: venue, error } = await supabase
      .from("venue")
      .update(updateData)
      .eq("id", venueId)
      .select()
      .single();

    if (error || !venue) {
      throw new HTTPException(404, { message: "Venue not found" });
    }

    return c.json({ data: venue });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /venues/:id - Delete venue
export async function deleteVenue(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof venueIdSchema>;
    const venueId = parseInt(params.id);

    if (isNaN(venueId)) {
      throw new HTTPException(400, { message: "Invalid venue ID" });
    }

    const { error } = await supabase
      .from("venue")
      .delete()
      .eq("id", venueId);

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

