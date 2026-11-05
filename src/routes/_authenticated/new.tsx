import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { lookupCustomerByPhone, upsertCustomer, type Customer } from "@/lib/api/customers";
import { listVehiclesByCustomer, createVehicle, type Vehicle } from "@/lib/api/vehicles";
import { listServices, type Service } from "@/lib/api/services";
import { createQuote, approveQuote, convertQuoteToJob } from "@/lib/api/quotes";
import { uploadMediaFile } from "@/lib/api/media";
import { formatINR, normalizePhone, normalizeVehicleNumber, computeMoneyTotals } from "@/lib/format";
import { ArrowLeft, ArrowRight, Camera, Check, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { openQuoteForDownload } from "@/lib/print-download";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({
    meta: [
      { title: "New Quote | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewFlow,
});

type Step = "phone" | "customer" | "vehicle" | "services" | "context" | "media" | "done";

type LineItem = { key: string; service_id?: string | null; name: string; qty: number; unit_price: number };

function NewFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", address: "" });

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ number: "", brand: "", model: "", color: "", fuel_type: "" });

  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(18);
  const [notes, setNotes] = useState("");

  const [context, setContext] = useState<"at_garage" | "inquiry_only">("at_garage");
  const [wantMedia, setWantMedia] = useState<"yes" | "no" | null>(null);
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);

  const vehiclesQ = useQuery({
    queryKey: ["customer-vehicles", customer?.id],
    enabled: !!customer,
    queryFn: () => listVehiclesByCustomer(customer!.id),
  });

  const servicesQ = useQuery({ queryKey: ["services"], queryFn: listServices });

  const totals = useMemo(() => computeMoneyTotals(items, discount, taxRate), [items, discount, taxRate]);

  const lookupMut = useMutation({
    mutationFn: async () => {
      const p = normalizePhone(phone);
      if (p.length < 7) throw new Error("Enter a valid phone number");
      const c = await lookupCustomerByPhone(p);
      return c;
    },
    onSuccess: (c) => {
      if (c) {
        setCustomer(c);
        setStep("vehicle");
      } else {
        setStep("customer");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createCustomerMut = useMutation({
    mutationFn: async () => {
      if (!newCustomer.name.trim()) throw new Error("Name is required");
      return upsertCustomer({ phone, name: newCustomer.name, email: newCustomer.email, address: newCustomer.address });
    },
    onSuccess: ({ customer: c, existed }) => {
      setCustomer(c);
      if (existed) toast.info(`Found existing customer — loaded ${c.name}`);
      setStep("vehicle");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createVehicleMut = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error("Missing customer");
      if (!newVehicle.number.trim()) throw new Error("Vehicle number is required");
      return createVehicle({ customer_id: customer.id, ...newVehicle });
    },
    onSuccess: (v) => {
      setVehicle(v);
      setAddingVehicle(false);
      vehiclesQ.refetch();
      setStep("services");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveQuoteMut = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error("Missing customer");
      if (context === "at_garage" && !vehicle) throw new Error("Select a vehicle");
      if (items.length === 0) throw new Error("Add at least one item");
      const q = await createQuote({
        customer_id: customer.id,
        vehicle_id: vehicle?.id ?? null,
        context,
        items,
        discount,
        tax_rate: taxRate,
        notes,
      });
      return q;
    },
    onSuccess: (q) => {
      setCreatedQuoteId(q.id);
      toast.success(`Quote ${q.number} created`);
      if (context === "at_garage") setStep("media");
      else setStep("done");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function addService(s: Service) {
    setItems((prev) => [
      ...prev,
      { key: `s-${s.id}-${prev.length}`, service_id: s.id, name: s.name, qty: 1, unit_price: Number(s.price) },
    ]);
  }
  function addCustomItem() {
    setItems((prev) => [
      ...prev,
      { key: `c-${prev.length}-${Date.now()}`, name: "", qty: 1, unit_price: 0 },
    ]);
  }

  const stepIndex = ["phone", "customer", "vehicle", "services", "context", "media", "done"].indexOf(step);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">New Quote</h1>
        <span className="text-xs text-muted-foreground">Step {Math.min(stepIndex + 1, 6)} of 6</span>
      </div>

      {step === "phone" && (
        <Card className="p-5">
          <Label htmlFor="phone" className="text-base">Customer phone number</Label>
          <p className="mt-1 text-sm text-muted-foreground">We'll find them if they exist.</p>
          <Input
            id="phone"
            inputMode="tel"
            autoFocus
            className="mt-3 h-14 text-xl tracking-wide"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button className="mt-4 h-12 w-full" size="lg" disabled={lookupMut.isPending || phone.length < 7} onClick={() => lookupMut.mutate()}>
            {lookupMut.isPending ? "Searching…" : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === "customer" && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">New customer</Badge>
            <span className="text-sm text-muted-foreground">{phone}</span>
          </div>
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" className="mt-1 h-11" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" className="mt-1 h-11" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="addr">Address (optional)</Label>
            <Textarea id="addr" className="mt-1" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("phone")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button className="flex-1 h-11" disabled={createCustomerMut.isPending} onClick={() => createCustomerMut.mutate()}>
              Save & continue
            </Button>
          </div>
        </Card>
      )}

      {step === "vehicle" && customer && (
        <>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Customer</div>
            <div className="font-semibold">{customer.name}</div>
            <div className="text-sm text-muted-foreground">{customer.phone}</div>
          </Card>
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Select vehicle</h2>
              {!addingVehicle && (
                <Button size="sm" variant="secondary" onClick={() => setAddingVehicle(true)}><Plus className="mr-1 h-4 w-4" />Add</Button>
              )}
            </div>
            {!addingVehicle && (
              <div className="space-y-2">
                {(vehiclesQ.data ?? []).length === 0 && !vehiclesQ.isLoading && (
                  <p className="text-sm text-muted-foreground">No vehicles yet. Add one.</p>
                )}
                {(vehiclesQ.data ?? []).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setVehicle(v); setStep("services"); }}
                    className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-accent"
                  >
                    <div>
                      <div className="font-semibold">{v.number}</div>
                      <div className="text-xs text-muted-foreground">{[v.brand, v.model, v.color].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            {addingVehicle && (
              <div className="space-y-3">
                <div>
                  <Label>Vehicle number *</Label>
                  <Input className="mt-1 h-11 uppercase tracking-wider" value={newVehicle.number} onChange={(e) => setNewVehicle({ ...newVehicle, number: normalizeVehicleNumber(e.target.value) })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Brand</Label><Input className="mt-1" value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} /></div>
                  <div><Label>Model</Label><Input className="mt-1" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} /></div>
                  <div><Label>Color</Label><Input className="mt-1" value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })} /></div>
                  <div><Label>Fuel</Label><Input className="mt-1" value={newVehicle.fuel_type} onChange={(e) => setNewVehicle({ ...newVehicle, fuel_type: e.target.value })} /></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setAddingVehicle(false)}>Cancel</Button>
                  <Button className="flex-1" disabled={createVehicleMut.isPending} onClick={() => createVehicleMut.mutate()}>Save vehicle</Button>
                </div>
              </div>
            )}
            <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => { setVehicle(null); setStep("services"); }}>
              Skip (inquiry only)
            </button>
          </Card>
        </>
      )}

      {step === "services" && customer && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div><span className="text-xs text-muted-foreground">Customer </span><span className="font-semibold">{customer.name}</span></div>
              {vehicle && <div><span className="text-xs text-muted-foreground">· Vehicle </span><span className="font-semibold">{vehicle.number}</span></div>}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Add services</h2>
            <div className="flex flex-wrap gap-2">
              {(servicesQ.data ?? []).map((s) => (
                <button key={s.id} onClick={() => addService(s)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent">
                  {s.name} <span className="text-muted-foreground">· {formatINR(s.price)}</span>
                </button>
              ))}
              <button onClick={addCustomItem} className="rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">
                <Plus className="mr-1 inline h-3 w-3" /> Custom
              </button>
            </div>

            {items.length > 0 && (
              <div className="mt-3 space-y-2">
                {items.map((it, idx) => (
                  <div key={it.key} className="grid grid-cols-[minmax(0,1fr)_60px_90px_auto] items-center gap-2 rounded-lg border p-2">
                    <Input placeholder="Item name" value={it.name} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                    <Input type="number" min={1} value={it.qty} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) || 0 } : x))} />
                    <Input type="number" min={0} value={it.unit_price} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} />
                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label>Discount (₹)</Label>
                <Input type="number" min={0} className="mt-1" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label>GST (%)</Label>
                <Input type="number" min={0} className="mt-1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="mt-2 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>− {formatINR(discount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST ({taxRate}%)</span><span>{formatINR(totals.tax_amount)}</span></div>
              <div className="flex justify-between text-base font-semibold pt-1"><span>Total</span><span>{formatINR(totals.total)}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("vehicle")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
              <Button className="flex-1 h-11" onClick={() => setStep("context")} disabled={items.length === 0}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </Card>
        </>
      )}

      {step === "context" && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Vehicle status</h2>
          <RadioGroup value={context} onValueChange={(v) => setContext(v as any)} className="space-y-2">
            <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer">
              <RadioGroupItem value="at_garage" id="atg" />
              <div>
                <div className="font-medium">Vehicle at Garage</div>
                <div className="text-xs text-muted-foreground">Continue to pre-work photos and create a job.</div>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-4 cursor-pointer">
              <RadioGroupItem value="inquiry_only" id="ing" disabled={!vehicle && false} />
              <div>
                <div className="font-medium">Customer Inquiry Only</div>
                <div className="text-xs text-muted-foreground">Save the quote. No job card created.</div>
              </div>
            </label>
          </RadioGroup>
          {context === "at_garage" && !vehicle && (
            <p className="text-xs text-destructive">Select a vehicle to proceed with "At Garage".</p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("services")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button
              className="flex-1 h-11"
              disabled={saveQuoteMut.isPending || (context === "at_garage" && !vehicle)}
              onClick={() => saveQuoteMut.mutate()}
            >
              {saveQuoteMut.isPending ? "Saving…" : "Save quote"}<Check className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "media" && createdQuoteId && vehicle && customer && (
        <MediaStep
          vehicleId={vehicle.id}
          customerId={customer.id}
          quoteId={createdQuoteId}
          onDone={() => setStep("done")}
        />
      )}

      {step === "done" && createdQuoteId && (
        <Card className="p-6 text-center space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" /></div>
          <div>
            <h2 className="text-lg font-semibold">Quote saved</h2>
            <p className="text-sm text-muted-foreground">Total {formatINR(totals.total)}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => navigate({ to: "/quotes/$id", params: { id: createdQuoteId } })}>View quote</Button>
            <Button
              variant="secondary"
              onClick={() => openQuoteForDownload(navigate, createdQuoteId)}
            >
              Print quote PDF
            </Button>
            {context === "at_garage" && vehicle && (
              <Button
                className="sm:col-span-2"
                onClick={async () => {
                  try {
                    await approveQuote(createdQuoteId);
                    const job = await convertQuoteToJob(createdQuoteId);
                    toast.success(`Job ${job.number} created`);
                    navigate({ to: "/jobs/$id", params: { id: job.id } });
                  } catch (e: any) { toast.error(e.message); }
                }}
              >Approve & create job</Button>
            )}
            <Button variant="ghost" className="sm:col-span-2" onClick={() => navigate({ to: "/dashboard" })}>Done</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function MediaStep({ vehicleId, customerId, quoteId, onDone }: { vehicleId: string; customerId: string; quoteId: string; onDone: () => void }) {
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const m = await uploadMediaFile({ file, vehicle_id: vehicleId, customer_id: customerId, quote_id: quoteId, stage: "pre_work" });
        setUploaded((prev) => [...prev, m.storage_path]);
      }
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Pre-work photos & videos</h2>
        <p className="text-sm text-muted-foreground">Capture the vehicle condition before starting work.</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" className="h-14" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Camera className="mr-2 h-5 w-5" /> Camera
        </Button>
        <Button size="lg" variant="secondary" className="h-14" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="mr-2 h-5 w-5" /> Upload
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">{uploaded.length} uploaded{busy ? " · uploading…" : ""}</div>
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>Skip</Button>
        <Button className="flex-1" onClick={onDone}>Done</Button>
      </div>
    </Card>
  );
}
