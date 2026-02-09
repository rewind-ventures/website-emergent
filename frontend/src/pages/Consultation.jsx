import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MOCK } from "@/mock";
import { submitToGoogleSheets } from "@/lib/googleSheets";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";

import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";

const SPORTS = [
  { key: "tennis", label: "Tennis" },
  { key: "badminton", label: "Badminton" },
  { key: "pickleball", label: "Pickleball" },
  { key: "squash", label: "Squash" },
  { key: "padel", label: "Padel" },
];

const schema = z
  .object({
    name: z.string().min(2, "Please enter your name"),
    email: z.string().email("Please enter a valid email"),
    company: z.string().min(2, "Please enter your company / venue name"),
    details: z.string().min(10, "Tell us a little more (at least 10 characters)"),
    area_sqft: z
      .string()
      .refine((v) => !v || !Number.isNaN(Number(v)), "Area must be a number")
      .optional(),
    facility_name: z.string().optional(),
    google_maps_url: z
      .string()
      .refine((v) => !v || v.startsWith("http"), "Please paste a valid URL")
      .optional(),
    mode: z.enum(["single", "multi"]),
    single_sport: z.string().optional(),
    single_courts: z.string().optional(),
    multi_sports: z.array(z.string()).optional(),
    courts_by_sport: z.record(z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "single") {
      if (!val.single_sport) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a sport",
          path: ["single_sport"],
        });
      }
      if (!val.single_courts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select number of courts",
          path: ["single_courts"],
        });
      }
    } else {
      if (!val.multi_sports || val.multi_sports.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select at least one sport",
          path: ["multi_sports"],
        });
      }
      (val.multi_sports || []).forEach((s) => {
        const count = val.courts_by_sport?.[s];
        if (!count) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Select number of courts for ${s}`,
            path: ["courts_by_sport"],
          });
        }
      });
    }
  });

function normalizeMapsEmbed(url) {
  if (!url) return "";
  if (!url.includes("google.com/maps")) return "";
  if (url.includes("output=embed")) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}output=embed`;
}

export default function Consultation() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [mapsUrl, setMapsUrl] = useState("");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      details: "",
      area_sqft: "",
      facility_name: "",
      google_maps_url: "",
      mode: "single",
      single_sport: "",
      single_courts: "",
      multi_sports: [],
      courts_by_sport: {},
    },
    mode: "onTouched",
  });

  const mode = form.watch("mode");
  const selectedMulti = form.watch("multi_sports") || [];

  const courtOptions = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= 30; i += 1) arr.push(String(i));
    return arr;
  }, []);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      // Prepare sports data
      const sportsData =
        values.mode === "single"
          ? `${values.single_sport}: ${values.single_courts} courts`
          : (values.multi_sports || [])
              .map((s) => `${s}: ${values.courts_by_sport?.[s] || 0} courts`)
              .join(", ");

      const result = await submitToGoogleSheets({
        name: values.name,
        email: values.email,
        company: values.company,
        details: values.details,
        area_sqft: values.area_sqft || "",
        facility_type: values.mode,
        sports: sportsData,
        facility_name: values.facility_name,
        google_maps_url: values.google_maps_url,
        source: "consultation_form",
      }, "consultations");

      if (result.success) {
        toast.success("Thank you for reaching out!", {
          description: "We'll get back to you shortly.",
        });

        form.reset();
        setMapsUrl("");
        
        // Redirect to home page after short delay
        setTimeout(() => {
          window.location.href = "/#/";
        }, 1500);
      } else {
        throw new Error(result.message);
      }
    } catch (e) {
      toast.message("Could not submit", {
        description:
          "Please try again or email us directly at hello@rewind-ventures.com.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rv2-page">
      <div className="rv2-header">
        <div className="rv2-container">
          <div className="rv2-headerRow">
            <Button
              className="rv2-btn rv2-btnSecondary"
              variant="outline"
              type="button"
              onClick={() => navigate("/")}
              aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="rv2-logo" aria-label="Rewind Ventures">
              <span className="rv2-logoMark" aria-hidden>
                <span className="rv2-logoMonogram">RV</span>
              </span>
              <span className="rv2-logoText">{MOCK.brand.name}</span>
            </div>

            <Button
              className="rv2-btn rv2-btnPrimary"
              type="button"
              onClick={() => (window.location.href = `mailto:${MOCK.brand.email}`)}>
              Email us
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="rv2-main">
        <section className="rv2-section">
          <div className="rv2-container">
            <div className="rv2-sectionHead">
              <Badge className="rv2-sectionTag" variant="secondary">
                BOOK A CONSULTATION
              </Badge>
              <h1 className="rv2-heroTitle" style={{ marginTop: 14 }}>
                Share your site details
              </h1>
              <p className="rv2-p">
                The more context you share, the faster we can propose the right setup.
              </p>
            </div>

            <Card className="rv2-panel" style={{ maxWidth: 980, margin: "0 auto" }}>
              <CardHeader>
                <CardTitle className="rv2-panelTitle">Basic information</CardTitle>
                <CardDescription className="rv2-panelDesc">
                  Share the details below and we'll reach out soon.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="rv2-form">
                    <div className="rv2-formGrid">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input className="rv2-input" placeholder="Your name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                className="rv2-input"
                                placeholder="you@company.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="rv2-formGrid">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company name</FormLabel>
                            <FormControl>
                              <Input className="rv2-input" placeholder="Company" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="area_sqft"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Area (sq.ft) (optional)</FormLabel>
                            <FormControl>
                              <Input
                                className="rv2-input"
                                placeholder="e.g., 12000"
                                inputMode="numeric"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Rough estimate is fine.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator className="rv-sep" />

                    <div className="rv2-sectionHead" style={{ textAlign: "left", marginBottom: 0 }}>
                      <h2 className="rv2-h2" style={{ margin: 0, fontSize: "1.4rem" }}>
                        Sport setup
                      </h2>
                      <p className="rv2-p" style={{ marginTop: 8 }}>
                        Choose single-sport or multi-sport, then set courts per sport.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facility type</FormLabel>
                          <FormControl>
                            <div className="rv2-outcomes" style={{ justifyContent: "flex-start" }}>
                              <Button
                                type="button"
                                className={`rv2-btn ${field.value === "single" ? "rv2-btnPrimary" : "rv2-btnSecondary"}`}
                                variant={field.value === "single" ? "default" : "outline"}
                                onClick={() => field.onChange("single")}>
                                Single sport
                              </Button>
                              <Button
                                type="button"
                                className={`rv2-btn ${field.value === "multi" ? "rv2-btnPrimary" : "rv2-btnSecondary"}`}
                                variant={field.value === "multi" ? "default" : "outline"}
                                onClick={() => field.onChange("multi")}>
                                Multi-sport
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {mode === "single" ? (
                      <div className="rv2-formGrid">
                        <FormField
                          control={form.control}
                          name="single_sport"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sport</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="rv2-input">
                                  <SelectValue placeholder="Select sport" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SPORTS.map((s) => (
                                    <SelectItem key={s.key} value={s.key}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="single_courts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>No. of courts</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="rv2-input">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {courtOptions.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <>
                        <FormField
                          control={form.control}
                          name="multi_sports"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Select sports</FormLabel>
                              <FormControl>
                                <div className="rv2-cardGrid3" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                  {SPORTS.map((s) => {
                                    const checked = (field.value || []).includes(s.key);
                                    return (
                                      <label key={s.key} className="rv2-panel" style={{ padding: 12, cursor: "pointer" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={(v) => {
                                              const next = new Set(field.value || []);
                                              if (v) next.add(s.key);
                                              else next.delete(s.key);
                                              field.onChange(Array.from(next));
                                            }}
                                          />
                                          <span style={{ fontWeight: 900 }}>{s.label}</span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="rv2-form" style={{ marginTop: 8 }}>
                          {selectedMulti.length > 0 ? (
                            selectedMulti.map((sKey) => {
                              const label = SPORTS.find((s) => s.key === sKey)?.label || sKey;
                              return (
                                <FormField
                                  key={sKey}
                                  control={form.control}
                                  name={`courts_by_sport.${sKey}`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>No. of courts — {label}</FormLabel>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="rv2-input">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {courtOptions.map((c) => (
                                            <SelectItem key={c} value={c}>
                                              {c}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              );
                            })
                          ) : (
                            <div className="rv2-p" style={{ color: "rgba(255,255,255,0.6)" }}>
                              Select sports above to set courts.
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <Separator className="rv-sep" />

                    <FormField
                      control={form.control}
                      name="details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tell us a little more about your project</FormLabel>
                          <FormControl>
                            <Textarea
                              className="rv2-input rv2-textarea"
                              placeholder="Timeline, goals, constraints, existing tools, etc."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator className="rv-sep" />

                    <div className="rv2-sectionHead" style={{ textAlign: "left", marginBottom: 0 }}>
                      <h2 className="rv2-h2" style={{ margin: 0, fontSize: "1.4rem" }}>
                        Site location
                      </h2>
                      <p className="rv2-p" style={{ marginTop: 8 }}>
                        Paste a Google Maps link (we'll preview it if possible).
                      </p>
                    </div>

                    <div className="rv2-formGrid">
                      <FormField
                        control={form.control}
                        name="facility_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Facility / site name (if already operational)</FormLabel>
                            <FormControl>
                              <Input
                                className="rv2-input"
                                placeholder="e.g., Rewind Sports Arena"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Optional</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="google_maps_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Maps link (optional)</FormLabel>
                            <FormControl>
                              <Input
                                className="rv2-input"
                                placeholder="https://www.google.com/maps/..."
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setMapsUrl(e.target.value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {normalizeMapsEmbed(mapsUrl) ? (
                      <div className="rv2-panel" style={{ padding: 10, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 6px 10px" }}>
                          <span className="rv2-iconBox" aria-hidden>
                            <MapPin className="h-5 w-5" />
                          </span>
                          <div style={{ fontWeight: 950 }}>Map preview</div>
                        </div>
                        <iframe
                          title="Map preview"
                          src={normalizeMapsEmbed(mapsUrl)}
                          style={{ width: "100%", height: 320, border: 0, borderRadius: 14 }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    ) : mapsUrl ? (
                      <div className="rv2-panel" style={{ padding: 12, color: "rgba(255,255,255,0.72)" }}>
                        Preview is available for <b>google.com/maps</b> links. We'll still record the URL you provided.
                      </div>
                    ) : null}

                    <Button
                      className="rv2-btn rv2-btnNeon"
                      type="submit"
                      disabled={submitting}>
                      {submitting ? "Submitting…" : "Submit"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <div style={{ color: "rgba(255,255,255,0.55)", fontWeight: 750, fontSize: 13 }}>
                      By submitting, you agree we may contact you via email or phone.
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
