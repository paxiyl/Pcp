import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { listCustomers, updateCustomer } from "../services/admin-customer.service";
import {
  adminCustomerQuerySchema,
  customerIdParamSchema,
  updateCustomerSchema,
} from "../validators/admin-customer.validator";

export const listCustomersController = asyncHandler(
  async (request: Request, response: Response) => {
    const query = adminCustomerQuerySchema.parse(request.query);
    const payload = await listCustomers(query);

    return response.status(HTTPSTATUS.OK).json({ message: "Customers", data: payload });
  },
);

export const updateCustomerController = asyncHandler(
  async (request: Request, response: Response) => {
    const { customerId } = customerIdParamSchema.parse(request.params);
    const input = updateCustomerSchema.parse(request.body);
    const customer = await updateCustomer(customerId, input);

    return response.status(HTTPSTATUS.OK).json({
      message: input.isActive ? "Account reinstated" : "Account suspended",
      data: { customer },
    });
  },
);
