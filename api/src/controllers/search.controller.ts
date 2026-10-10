import { Request, Response } from "express";
import { z } from "zod";

import { HTTPSTATUS } from "../config/http-status.config";
import { NotFoundException } from "../utils/app-error";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { DEMAND_MODES } from "../models/demand-signal.model";
import { UserDocument } from "../models/user.model";
import {
  listDemand,
  noteMiss,
  recordMiss,
  setDemandResolved,
} from "../services/demand-signal.service";
import { searchCatalogue } from "../services/search.service";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Enter something to search for").max(80),
  /** Which half of the app the search came from, for the demand signal only. */
  mode: z.enum(DEMAND_MODES).optional(),
});

const askSchema = z.object({
  term: z.string().trim().min(3, "Tell us what you were looking for").max(80),
  mode: z.enum(DEMAND_MODES),
});

export const searchController = asyncHandler(async (request: Request, response: Response) => {
  const { q, mode } = searchQuerySchema.parse(request.query);
  const { dishes, products, restaurants, stores } = await searchCatalogue(q);

  const found = products.length + stores.length + restaurants.length + dishes.length;

  // The search that returns nothing is the one worth keeping: it is a customer
  // naming something to stock. Not awaited — a demand signal must never make a
  // search slower, or fail one.
  if (found === 0) {
    noteMiss({
      mode: mode ?? "grocery",
      term: q,
      userId: (request.user as UserDocument | undefined)?._id.toString(),
    });
  }

  return response.status(HTTPSTATUS.OK).json({
    message: "Search results",
    // All four groups. These used to stop at restaurants and dishes, so every
    // grocery search returned an empty list however much stock was listed.
    data: { query: q, products, stores, restaurants, dishes },
  });
});

/**
 * "We want this." A deliberate request from the empty state, which counts for
 * more than the search that got them there.
 */
export const requestItemController = asyncHandler(
  async (request: Request, response: Response) => {
    const { term, mode } = askSchema.parse(request.body);

    // Awaited, unlike the passive miss: the customer is waiting to be told it
    // was heard, and telling them so falsely is worse than telling them it
    // failed.
    await recordMiss({
      asked: true,
      mode,
      term,
      userId: (request.user as UserDocument | undefined)?._id.toString(),
    });

    return response.status(HTTPSTATUS.OK).json({
      message: "Thanks — we have passed that on to our shops",
      data: { term, mode },
    });
  },
);

/** The admin view: what people keep asking for that nobody has listed. */
export const listDemandController = asyncHandler(async (request: Request, response: Response) => {
  const query = z
    .object({
      mode: z.enum(DEMAND_MODES).optional(),
      includeResolved: z.coerce.boolean().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .parse(request.query);

  const signals = await listDemand(query);

  return response.status(HTTPSTATUS.OK).json({
    message: "Unmet demand",
    data: { signals },
  });
});

/** Ticks a term off once something matching it is listed, or puts it back. */
export const resolveDemandController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = z.object({ id: z.string().length(24) }).parse(request.params);
    const { resolved } = z.object({ resolved: z.boolean() }).parse(request.body);

    const signal = await setDemandResolved(id, resolved);

    if (!signal) throw new NotFoundException("That request is no longer listed");

    return response.status(HTTPSTATUS.OK).json({
      message: resolved ? "Marked as stocked" : "Put back on the list",
      data: { signal },
    });
  },
);
