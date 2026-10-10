import { BanknoteIcon, BikeIcon, CoinsIcon, HeadphonesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/features/settings/use-settings";
import { ApiError } from "@/lib/axios-client";
import { formatMoney } from "@/lib/format";

/** The distance the example payout is worked out for. */
const EXAMPLE_KM = 3.2;

type FormState = {
  basePay: string;
  payPerKm: string;
  commission: string;
  serviceFee: string;
  codEnabled: boolean;
  /** Rupees in the form, paise on the wire. */
  codMaxOrderValue: string;
  codMaxOpenOrders: string;
};

const toMinor = (value: string) => Math.round(Number(value || 0) * 100);
const toMajor = (cents: number) => (cents / 100).toFixed(2);

/** A section header with its icon, repeated for each card in the design. */
function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BikeIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-0.5">
        <CardTitle>{title}</CardTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { data, isLoading } = useSettings();
  const update = useUpdateSettings();

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The form mirrors the saved settings until the admin edits it.
  useEffect(() => {
    if (!data) return;

    setForm({
      basePay: toMajor(data.driverBasePay),
      codEnabled: data.codEnabled,
      codMaxOpenOrders: String(data.codMaxOpenOrders),
      codMaxOrderValue: toMajor(data.codMaxOrderValue),
      commission: String(Math.round(data.restaurantCommissionRate * 100)),
      payPerKm: toMajor(data.driverPayPerKm),
      serviceFee: String(Math.round(data.serviceFeeRate * 100)),
    });
  }, [data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const reset = () => {
    if (!data) return;

    setErrors({});
    setForm({
      basePay: toMajor(data.driverBasePay),
      codEnabled: data.codEnabled,
      codMaxOpenOrders: String(data.codMaxOpenOrders),
      codMaxOrderValue: toMajor(data.codMaxOrderValue),
      commission: String(Math.round(data.restaurantCommissionRate * 100)),
      payPerKm: toMajor(data.driverPayPerKm),
      serviceFee: String(Math.round(data.serviceFeeRate * 100)),
    });
  };

  const dirty =
    Boolean(data && form) &&
    (toMinor(form!.basePay) !== data!.driverBasePay ||
      toMinor(form!.payPerKm) !== data!.driverPayPerKm ||
      Number(form!.commission) !== Math.round(data!.restaurantCommissionRate * 100) ||
      Number(form!.serviceFee) !== Math.round(data!.serviceFeeRate * 100) ||
      form!.codEnabled !== data!.codEnabled ||
      toMinor(form!.codMaxOrderValue) !== data!.codMaxOrderValue ||
      Number(form!.codMaxOpenOrders) !== data!.codMaxOpenOrders);

  const save = () => {
    if (!form) return;

    const nextErrors: Record<string, string> = {};
    if (Number(form.basePay) < 0) nextErrors.basePay = "Base pay cannot be negative";
    if (Number(form.payPerKm) < 0) nextErrors.payPerKm = "The rate cannot be negative";
    if (Number(form.commission) < 0 || Number(form.commission) > 50) {
      nextErrors.commission = "Commission must be between 0 and 50%";
    }
    if (Number(form.serviceFee) < 0 || Number(form.serviceFee) > 20) {
      nextErrors.serviceFee = "The service fee must be between 0 and 20%";
    }
    // Only checked when cash is on: a stale ceiling behind a disabled switch is
    // not something to block a save over.
    if (form.codEnabled) {
      if (Number(form.codMaxOrderValue) <= 0) {
        nextErrors.codMaxOrderValue = "Set a ceiling, or turn cash on delivery off";
      }
      if (Number(form.codMaxOpenOrders) < 1 || Number(form.codMaxOpenOrders) > 20) {
        nextErrors.codMaxOpenOrders = "Allow between 1 and 20 open cash orders";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    update.mutate(
      {
        driverBasePay: toMinor(form.basePay),
        driverPayPerKm: toMinor(form.payPerKm),
        codEnabled: form.codEnabled,
        codMaxOpenOrders: Number(form.codMaxOpenOrders),
        codMaxOrderValue: toMinor(form.codMaxOrderValue),
        restaurantCommissionRate: Number(form.commission) / 100,
        serviceFeeRate: Number(form.serviceFee) / 100,
      },
      {
        onError: (error) =>
          toast.error("Could not save the settings", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () => toast.success("Settings saved"),
      },
    );
  };

  if (isLoading || !form || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const distancePay = Math.round(EXAMPLE_KM * toMinor(form.payPerKm));
  const examplePayout = toMinor(form.basePay) + distancePay;
  const commission = Number(form.commission || 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage platform fees and rider payout rates.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionTitle
              description="Set how rider earnings are calculated for each delivery."
              icon={BikeIcon}
              title="Rider payouts"
            />
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <Field data-invalid={errors.basePay ? true : undefined}>
                <FieldLabel htmlFor="base-pay">Base pay</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>$</InputGroupAddon>
                  <InputGroupInput
                    aria-invalid={errors.basePay ? true : undefined}
                    id="base-pay"
                    min={0}
                    onChange={(event) => set("basePay", event.target.value)}
                    step="0.01"
                    type="number"
                    value={form.basePay}
                  />
                </InputGroup>
                <FieldDescription>
                  {errors.basePay ?? "Fixed amount paid for every completed delivery."}
                </FieldDescription>
              </Field>

              <Field data-invalid={errors.payPerKm ? true : undefined}>
                <FieldLabel htmlFor="per-km">Per-kilometre rate</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>$</InputGroupAddon>
                  <InputGroupInput
                    aria-invalid={errors.payPerKm ? true : undefined}
                    id="per-km"
                    min={0}
                    onChange={(event) => set("payPerKm", event.target.value)}
                    step="0.01"
                    type="number"
                    value={form.payPerKm}
                  />
                  <InputGroupAddon align="inline-end">/ km</InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {errors.payPerKm ?? "Added based on the delivery distance."}
                </FieldDescription>
              </Field>

              {/* The same arithmetic the API uses, so the number is not a guess. */}
              <div className="bg-primary/5 flex flex-col gap-1 rounded-xl p-4">
                <p className="text-primary font-semibold">Example payout</p>
                <p className="text-muted-foreground text-sm">{EXAMPLE_KM} km delivery</p>
                <p className="text-muted-foreground text-sm">
                  {formatMoney(toMinor(form.basePay))} + ({EXAMPLE_KM} ×{" "}
                  {formatMoney(toMinor(form.payPerKm))})
                </p>
                <p className="text-3xl font-bold tracking-tight">{formatMoney(examplePayout)}</p>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                description="Cash is carried by the rider, so these are operational limits rather than pricing ones."
                icon={BanknoteIcon}
                title="Cash on delivery"
              />
            </CardHeader>

            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <div>
                    <FieldLabel htmlFor="cod-enabled">Accept cash on delivery</FieldLabel>
                    <FieldDescription>
                      Off removes the option from checkout entirely.
                    </FieldDescription>
                  </div>
                  <Switch
                    checked={form.codEnabled}
                    id="cod-enabled"
                    onCheckedChange={(value) => set("codEnabled", value)}
                  />
                </Field>

                <Field data-invalid={errors.codMaxOrderValue ? true : undefined}>
                  <FieldLabel htmlFor="cod-max">Largest cash order</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>₹</InputGroupAddon>
                    <InputGroupInput
                      aria-invalid={errors.codMaxOrderValue ? true : undefined}
                      disabled={!form.codEnabled}
                      id="cod-max"
                      min={0}
                      onChange={(event) => set("codMaxOrderValue", event.target.value)}
                      type="number"
                      value={form.codMaxOrderValue}
                    />
                  </InputGroup>
                  <FieldDescription>
                    {errors.codMaxOrderValue ??
                      "Caps how much a rider carries. Above this, checkout asks for online payment."}
                  </FieldDescription>
                </Field>

                <Field data-invalid={errors.codMaxOpenOrders ? true : undefined}>
                  <FieldLabel htmlFor="cod-open">Open cash orders per customer</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      aria-invalid={errors.codMaxOpenOrders ? true : undefined}
                      disabled={!form.codEnabled}
                      id="cod-open"
                      max={20}
                      min={1}
                      onChange={(event) => set("codMaxOpenOrders", event.target.value)}
                      type="number"
                      value={form.codMaxOpenOrders}
                    />
                  </InputGroup>
                  <FieldDescription>
                    {errors.codMaxOpenOrders ??
                      "What a repeat no-show runs into before cash is refused."}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle
                description="Percentage Raket keeps from each order."
                icon={CoinsIcon}
                title="Platform commission"
              />
            </CardHeader>

            <CardContent>
              <FieldGroup>
                <Field data-invalid={errors.commission ? true : undefined}>
                  <FieldLabel htmlFor="commission">Commission rate</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      aria-invalid={errors.commission ? true : undefined}
                      id="commission"
                      max={50}
                      min={0}
                      onChange={(event) => set("commission", event.target.value)}
                      type="number"
                      value={form.commission}
                    />
                    <InputGroupAddon align="inline-end">%</InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    {errors.commission ??
                      "Applied to restaurants without a negotiated rate of their own."}
                  </FieldDescription>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <p className="text-muted-foreground text-sm">Restaurant receives</p>
                    <p className="text-2xl font-bold tracking-tight">{100 - commission}%</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-muted-foreground text-sm">Raket commission</p>
                    <p className="text-2xl font-bold tracking-tight">{commission}%</p>
                  </div>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle
                description="Fee charged to customers at checkout."
                icon={HeadphonesIcon}
                title="Customer service fee"
              />
            </CardHeader>

            <CardContent>
              <Field data-invalid={errors.serviceFee ? true : undefined}>
                <FieldLabel htmlFor="service-fee">Service fee rate</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    aria-invalid={errors.serviceFee ? true : undefined}
                    id="service-fee"
                    max={20}
                    min={0}
                    onChange={(event) => set("serviceFee", event.target.value)}
                    type="number"
                    value={form.serviceFee}
                  />
                  <InputGroupAddon align="inline-end">%</InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {errors.serviceFee ??
                    "Charged on the basket subtotal. Applies to new baskets and orders straight away."}
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Last updated{" "}
            {new Date(data.updatedAt).toLocaleString([], {
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>

          <div className="flex items-center gap-2">
            <Button disabled={!dirty || update.isPending} onClick={reset} variant="outline">
              Discard changes
            </Button>
            <Button disabled={!dirty || update.isPending} onClick={save}>
              {update.isPending ? <Spinner data-icon="inline-start" /> : null}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
