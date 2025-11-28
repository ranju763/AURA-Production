"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import * as z from "zod";
import { tournamentsApi, venuesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import {
  ScrollablePage,
  ScrollablePageHeader,
  ScrollablePageContent,
} from "@/components/layout/ScrollablePage";
import { toast } from "sonner";

// Validation schema
const formSchema = z
  .object({
    name: z.string().min(1, "Tournament name is required"),
    description: z.string().min(1, "Description is required"),
    venue_id: z
      .string()
      .min(1, "Venue is required")
      .transform((val) => {
        const num = parseInt(val);
        if (isNaN(num)) throw new Error("Invalid venue ID");
        return num;
      }),
    match_format: z.object({
      eligible_gender: z.enum(["M", "W", "MW"], {
        required_error: "Eligible gender is required",
      }),
      min_age: z
        .string()
        .optional()
        .transform((val) => {
          if (!val || val === "") return undefined;
          const num = parseInt(val);
          return isNaN(num) ? undefined : num;
        }),
      max_age: z
        .string()
        .optional()
        .transform((val) => {
          if (!val || val === "") return undefined;
          const num = parseInt(val);
          return isNaN(num) ? undefined : num;
        }),
      metadata: z.object({
        set_rules: z.object({
          final: z.object({
            best_of: z.string().transform((val) => parseInt(val) || 7),
          }),
          semi_final: z.object({
            best_of: z.string().transform((val) => parseInt(val) || 5),
          }),
          league: z.object({
            _rounds: z.string().transform((val) => parseInt(val) || 4),
            best_of: z.string().transform((val) => parseInt(val) || 3),
          }),
        }),
      }),
    }),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    capacity: z
      .string()
      .min(1, "Capacity is required")
      .transform((val) => {
        const num = parseInt(val);
        if (isNaN(num) || num < 1)
          throw new Error("Capacity must be a positive number");
        return num;
      }),
    registration_fee: z
      .string()
      .default("0")
      .transform((val) => {
        const num = parseFloat(val || "0");
        return isNaN(num) ? 0 : num;
      }),
    image_url: z.string().url().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.match_format.min_age && data.match_format.max_age) {
        return data.match_format.max_age >= data.match_format.min_age;
      }
      return true;
    },
    {
      message: "Max age must be greater than or equal to min age",
      path: ["match_format", "max_age"],
    }
  )
  .refine(
    (data) => {
      const startTime = new Date(data.start_time);
      const endTime = new Date(data.end_time);
      return endTime > startTime;
    },
    {
      message: "End time must be after start time",
      path: ["end_time"],
    }
  );

export default function CreateTournamentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Set default datetime values
  const now = new Date();
  const startTime = new Date(now.getTime() + 60 * 60 * 1000);
  const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Fetch venues
  const { data: venuesData, isLoading: venuesLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const response = await venuesApi.getAll();
      return response.data.data;
    },
  });

  const venues = venuesData?.venues || [];

  // Create tournament mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await tournamentsApi.create(data);
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success("Tournament created successfully!");
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      router.push(`/tournaments/${data.tournament.id}`);
    },
    onError: (error) => {
      console.log(error);
      toast.error(
        error.response?.data?.message || "Failed to create tournament"
      );
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      venue_id: "",
      match_format: {
        eligible_gender: "MW",
        min_age: "",
        max_age: "",
        metadata: {
          set_rules: {
            final: {
              best_of: "7",
            },
            semi_final: {
              best_of: "5",
            },
            league: {
              _rounds: "4",
              best_of: "3",
            },
          },
        },
      },
      start_time: startTime.toISOString().slice(0, 16),
      end_time: endTime.toISOString().slice(0, 16),
      capacity: "",
      registration_fee: "0",
      image_url: "",
    },
    validators: {
      onChange: formSchema,
      onBlur: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        // Parse and validate with Zod schema to get transformed values
        const parsed = formSchema.parse(value);

        // Build metadata object
        const metadata = {
          set_rules: {
            final: {
              best_of:
                parseInt(value.match_format.metadata.set_rules.final.best_of) ||
                7,
            },
            semi_final: {
              best_of:
                parseInt(
                  value.match_format.metadata.set_rules.semi_final.best_of
                ) || 5,
            },
            league: {
              _rounds:
                parseInt(
                  value.match_format.metadata.set_rules.league._rounds
                ) || 4,
              best_of:
                parseInt(
                  value.match_format.metadata.set_rules.league.best_of
                ) || 3,
            },
          },
        };

        // Prepare submit data - ensure all numeric values are actually numbers
        const submitData = {
          name: parsed.name,
          description: parsed.description,
          venue_id: Number(parsed.venue_id),
          match_format: {
            min_age:
              parsed.match_format.min_age !== undefined &&
              parsed.match_format.min_age !== null
                ? Number(parsed.match_format.min_age)
                : undefined,
            max_age:
              parsed.match_format.max_age !== undefined &&
              parsed.match_format.max_age !== null
                ? Number(parsed.match_format.max_age)
                : undefined,
            eligible_gender: parsed.match_format.eligible_gender,
            metadata: metadata,
          },
          start_time: new Date(parsed.start_time).toISOString(),
          end_time: new Date(parsed.end_time).toISOString(),
          capacity: Number(parsed.capacity),
          registration_fee: Number(parsed.registration_fee) || 0,
          image_url: parsed.image_url || undefined,
        };

        createMutation.mutate(submitData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast.error("Please fix the form errors before submitting");
          console.error("Validation errors:", error.errors);
        } else {
          toast.error("An error occurred while submitting the form");
          console.error("Submit error:", error);
        }
      }
    },
  });

  return (
    <ScrollablePage>
      <ScrollablePageHeader>
        <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-bold">Create Tournament</h1>
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </header>
      </ScrollablePageHeader>

      <ScrollablePageContent>
        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                id="create-tournament-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
              >
                <FieldGroup>
                  {/* Name */}
                  <form.Field
                    name="name"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Tournament Name *
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Enter tournament name"
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* Description */}
                  <form.Field
                    name="description"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Description *
                          </FieldLabel>
                          <textarea
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Enter tournament description"
                            rows={4}
                            className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* Venue */}
                  <form.Field
                    name="venue_id"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Venue *</FieldLabel>
                          <select
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            disabled={venuesLoading}
                            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
                          >
                            <option value="">Select a venue</option>
                            {venues.map((venue) => (
                              <option key={venue.id} value={venue.id}>
                                {venue.name} - {venue.address}
                              </option>
                            ))}
                          </select>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* Match Format Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-semibold">Match Format *</h3>

                    {/* Eligible Gender */}
                    <form.Field
                      name="match_format.eligible_gender"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Eligible Gender *
                            </FieldLabel>
                            <select
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            >
                              <option value="MW">
                                Mixed (M & W) - Auto: Mixed Doubles
                              </option>
                              <option value="M">
                                Male Only - Auto: Men's Doubles
                              </option>
                              <option value="W">
                                Female Only - Auto: Women's Doubles
                              </option>
                            </select>
                            <FieldDescription>
                              Match type will be automatically generated based
                              on your selection
                            </FieldDescription>
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    />

                    {/* Age Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <form.Field
                        name="match_format.min_age"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Min Age
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="number"
                                min="1"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-invalid={isInvalid}
                                placeholder="Optional"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      />
                      <form.Field
                        name="match_format.max_age"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Max Age
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="number"
                                min="1"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-invalid={isInvalid}
                                placeholder="Optional"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      />
                    </div>

                    {/* Round Formation Rules */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="text-sm font-semibold">
                        Round Formation Rules
                      </h3>

                      {/* Final */}
                      <form.Field
                        name="match_format.metadata.set_rules.final.best_of"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Final - Best Of
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="number"
                                min="1"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-invalid={isInvalid}
                                placeholder="7"
                              />
                              <FieldDescription>
                                Number of sets in the final match (e.g., 7 means
                                first to win 4 sets wins)
                              </FieldDescription>
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      />

                      {/* Semi Final */}
                      <form.Field
                        name="match_format.metadata.set_rules.semi_final.best_of"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Semi Final - Best Of
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="number"
                                min="1"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-invalid={isInvalid}
                                placeholder="5"
                              />
                              <FieldDescription>
                                Number of sets in semi final matches (e.g., 5
                                means first to win 3 sets wins)
                              </FieldDescription>
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      />

                      {/* League */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium">
                          League
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <form.Field
                            name="match_format.metadata.set_rules.league._rounds"
                            children={(field) => {
                              const isInvalid =
                                field.state.meta.isTouched &&
                                !field.state.meta.isValid;
                              return (
                                <Field data-invalid={isInvalid}>
                                  <FieldLabel htmlFor={field.name}>
                                    Number of Rounds
                                  </FieldLabel>
                                  <Input
                                    id={field.name}
                                    name={field.name}
                                    type="number"
                                    min="1"
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                      field.handleChange(e.target.value)
                                    }
                                    aria-invalid={isInvalid}
                                    placeholder="4"
                                  />
                                  {isInvalid && (
                                    <FieldError
                                      errors={field.state.meta.errors}
                                    />
                                  )}
                                </Field>
                              );
                            }}
                          />
                          <form.Field
                            name="match_format.metadata.set_rules.league.best_of"
                            children={(field) => {
                              const isInvalid =
                                field.state.meta.isTouched &&
                                !field.state.meta.isValid;
                              return (
                                <Field data-invalid={isInvalid}>
                                  <FieldLabel htmlFor={field.name}>
                                    Best Of
                                  </FieldLabel>
                                  <Input
                                    id={field.name}
                                    name={field.name}
                                    type="number"
                                    min="1"
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                      field.handleChange(e.target.value)
                                    }
                                    aria-invalid={isInvalid}
                                    placeholder="3"
                                  />
                                  {isInvalid && (
                                    <FieldError
                                      errors={field.state.meta.errors}
                                    />
                                  )}
                                </Field>
                              );
                            }}
                          />
                        </div>
                        <FieldDescription>
                          League will have{" "}
                          {form.state.values.match_format.metadata.set_rules
                            .league._rounds || 4}{" "}
                          rounds, where each match is best of{" "}
                          {form.state.values.match_format.metadata.set_rules
                            .league.best_of || 3}{" "}
                          sets
                        </FieldDescription>
                      </div>
                    </div>
                  </div>

                  {/* Start Time */}
                  <form.Field
                    name="start_time"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Start Time *
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="datetime-local"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* End Time */}
                  <form.Field
                    name="end_time"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            End Time *
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="datetime-local"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* Capacity */}
                  <form.Field
                    name="capacity"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Capacity *
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="number"
                            min="1"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Enter maximum number of participants"
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* Registration Fee */}
                  <form.Field
                    name="registration_fee"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Registration Fee
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="number"
                            min="0"
                            step="0.01"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="0.00"
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  {/* Image URL */}
                  <form.Field
                    name="image_url"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Image URL
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="url"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="https://example.com/image.jpg"
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  />
                </FieldGroup>
              </form>
            </CardContent>
            <div className="px-6 pb-6">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  form="create-tournament-form"
                  className="flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? "Creating..."
                    : "Create Tournament"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </ScrollablePageContent>
    </ScrollablePage>
  );
}
