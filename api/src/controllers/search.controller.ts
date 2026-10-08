import { Request, Response } from "express";
import { z } from "zod";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { searchCatalogue } from "../services/search.service";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Enter something to search for").max(80),
});

export const searchController = asyncHandler(async (request: Request, response: Response) => {
  const { q } = searchQuerySchema.parse(request.query);
  const { dishes, restaurants } = await searchCatalogue(q);

  return response.status(HTTPSTATUS.OK).json({
    message: "Search results",
    data: { query: q, restaurants, dishes },
  });
});
