import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useRefundOrder } from "@/features/orders/use-admin-orders";
import { apiMessage } from "@/lib/axios-client";
import { formatMoney } from "@/lib/format";

type Props = {
  orderId: string;
  reference: string;
  /** Paise. */
  total: number;
  alreadyRefunded: number;
  paymentMethod: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function RefundDialog({
  orderId,
  reference,
  total,
  alreadyRefunded,
  paymentMethod,
  onOpenChange,
  open,
}: Props) {
  const refundable = total - alreadyRefunded;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const refund = useRefundOrder();

  useEffect(() => {
    if (!open) return;

    // Blank means "the whole balance", which is the common case and should not
    // require retyping a total.
    setAmount("");
    setReason("");
  }, [open]);

  const cash = paymentMethod === "cod";
  const requested = amount ? Math.round(Number(amount) * 100) : refundable;
  const invalid = requested <= 0 || requested > refundable;

  const submit = async () => {
    if (reason.trim().length < 3) return toast.error("Say why, for the audit trail");
    if (invalid) return toast.error(`Refund must be at most ${formatMoney(refundable)}`);

    try {
      await refund.mutateAsync({
        orderId,
        reason: reason.trim(),
        ...(amount ? { amount: requested } : {}),
      });

      toast.success(
        cash
          ? "Refund recorded — settle the cash with the customer"
          : "Refund issued to the original payment method",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(apiMessage(error, "Could not issue that refund."));
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund {reference}</DialogTitle>
          <DialogDescription>
            {/* The two cases are genuinely different, and saying "on its way" for
                a cash order when nobody has sent anything is how a customer ends
                up waiting for money that was never moving. */}
            {cash
              ? "This was a cash order, so there is nothing to reverse. Recording it here marks what the shop owes back."
              : "Goes back to the method they paid with, usually within 5–7 working days."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          {alreadyRefunded > 0 ? (
            <p className="text-muted-foreground text-sm">
              {formatMoney(alreadyRefunded)} already refunded ·{" "}
              <span className="text-foreground font-medium">
                {formatMoney(refundable)} remaining
              </span>
            </p>
          ) : null}

          <Field data-invalid={invalid && amount ? true : undefined}>
            <FieldLabel htmlFor="refund-amount">Amount</FieldLabel>
            <InputGroup>
              <InputGroupAddon>₹</InputGroupAddon>
              <InputGroupInput
                aria-invalid={invalid && amount ? true : undefined}
                id="refund-amount"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder={String(refundable / 100)}
                value={amount}
              />
            </InputGroup>
            <FieldDescription className={invalid && amount ? "text-destructive" : undefined}>
              {invalid && amount
                ? `Cannot exceed ${formatMoney(refundable)}.`
                : `Leave blank to refund the full ${formatMoney(refundable)}. A full refund cancels the order and puts its stock back.`}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
            <Input
              id="refund-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Item unavailable at the shop"
              value={reason}
            />
            <FieldDescription>Stored on the order for the audit trail.</FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            disabled={refund.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={refund.isPending} onClick={() => void submit()} variant="destructive">
            {refund.isPending ? <Spinner className="size-4" /> : null}
            {cash ? "Record refund" : `Refund ${formatMoney(requested)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
