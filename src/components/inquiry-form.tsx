import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitInquiry } from "@/lib/api/inquiries";
import { CheckCircle2, Loader2 } from "lucide-react";

const SERVICES = [
  "Standard Service",
  "Premium Service",
  "Enterprise Service",
  "Consultation",
  "Other",
];

export function InquiryForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [service, setService] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitInquiry({ name, phone, vehicle, service, message, source: "website" });
      setDone(true);
      setName(""); setPhone(""); setVehicle(""); setService(""); setMessage("");
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <div className="font-semibold">Thank you for contacting us.</div>
            <p className="mt-1 text-sm text-emerald-900/80">
              Our team will review your inquiry and contact you within 4–5 business hours.
            </p>
            <Button variant="link" className="mt-2 px-0 text-emerald-700" onClick={() => setDone(false)}>
              Send another inquiry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="iq-name">Name</Label>
          <Input id="iq-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iq-phone">Phone</Label>
          <Input id="iq-phone" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="iq-vehicle">Vehicle</Label>
          <Input id="iq-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. Honda City / GJ01AB1234" maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iq-service">Service interested</Label>
          <select
            id="iq-service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select a service</option>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="iq-msg">Message</Label>
        <Textarea id="iq-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us a bit about what you need" rows={3} maxLength={1000} />
      </div>
      <Button type="submit" size="lg" disabled={submitting} className="mt-1 h-12 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-500 text-white shadow-lg shadow-blue-500/25">
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send inquiry"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We reply within 4–5 business hours. No spam, ever.
      </p>
    </form>
  );
}
