import { Request, Response } from "express";
import { z } from "zod";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { SETTLEMENT_PARTIES } from "../models/settlement.model";
import { UserDocument } from "../models/user.model";
import {
  getOutstanding,
  listSettlements,
  settleRider,
  settleVendor,
} from "../services/settlement.service";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/**
 * `expectedNet` is the number the admin had on screen. Sending it back makes
 * the settle a check-and-set: if a delivery landed between the page loading and
 * the button being pressed, the amount is no longer the one they agreed to, and
 * the service refuses rather than paying out a figure nobody saw.
 */
const settleSchema = z.object({
  note: z.string().trim().max(300).optional(),
  expectedNet: z.number().int().optional(),
});

const settledBy = (request: Request): string =>
  (request.user as UserDocument)._id.toString();

export const outstandingController = asyncHandler(
  async (_request: Request, response: Response) => {
    const outstanding = await getOutstanding();

    return response
      .status(HTTPSTATUS.OK)
      .json({ message: "Outstanding balances", data: outstanding });
  },
);

export const settleRiderController = asyncHandler(async (request: Request, response: Response) => {
  const { riderId } = z.object({ riderId: objectId }).parse(request.params);
  const input = settleSchema.parse(request.body ?? {});

  const { settlement } = await settleRider(riderId, { ...input, settledBy: settledBy(request) });

  return response.status(HTTPSTATUS.CREATED).json({
    message:
      settlement.direction === "incoming"
        ? "Cash collected from the rider"
        : "Earnings paid to the rider",
    data: { settlement },
  });
});

export const settleVendorController = asyncHandler(async (request: Request, response: Response) => {
  const { kind, vendorId } = z
    .object({ kind: z.enum(["store", "restaurant"]), vendorId: objectId })
    .parse(request.params);
  const input = settleSchema.parse(request.body ?? {});

  const { settlement } = await settleVendor(kind, vendorId, {
    ...input,
    settledBy: settledBy(request),
  });

  return response
    .status(HTTPSTATUS.CREATED)
    .json({ message: "Paid out to the vendor", data: { settlement } });
});

export const settlementHistoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const query = z
      .object({
        party: z.enum(SETTLEMENT_PARTIES).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(request.query);

    const settlements = await listSettlements(query);

    return response
      .status(HTTPSTATUS.OK)
      .json({ message: "Settlement history", data: { settlements } });
  },
);
