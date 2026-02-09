import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";

import { ArrowRight } from "lucide-react";
import { submitToGoogleSheets } from "@/lib/googleSheets";

const leadSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  company: z.string().min(2, "Please enter your company / venue name"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  need: z
    .string()
    .min(10, "Tell us a little more (at least 10 characters)")
    .max(1200, "Please keep it under 1200 characters"),
});

export default function ContactForm() {
  const form = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      need: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (values) => {
    try {
      const result = await submitToGoogleSheets({
        name: values.name,
        company: values.company,
        email: values.email,
        phone: values.phone || "",
        message: values.need,
        source: "landing_form",
      }, "leads");

      if (result.success) {
        toast.success("Request received", {
          description: "Submitted successfully. We'll get back to you shortly.",
        });
        form.reset();
      } else {
        throw new Error(result.message);
      }
    } catch {
      toast.message("Submission not sent", {
        description: "We couldn't submit right now. Please email us instead.",
      });
    }
  };

  return (
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
                <FormLabel>Company / venue</FormLabel>
                <FormControl>
                  <Input
                    className="rv2-input"
                    placeholder="Your venue name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <FormControl>
                  <Input className="rv2-input" placeholder="+91 …" {...field} />
                </FormControl>
                <FormDescription>For WhatsApp/call follow-up.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="need"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  className="rv2-input rv2-textarea"
                  placeholder="Tell us about your project..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className="rv2-btn rv2-btnNeon" type="submit">
          Send Message
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </Form>
  );
}
