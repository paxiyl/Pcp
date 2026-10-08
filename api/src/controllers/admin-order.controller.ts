import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  findOrder,
  listOrders,
  refundAdminOrder,
  releaseRider,
  updateOrderStatus,
} from "../services/admin-order.service";
import {
  adminOrderQuerySchema,
  orderIdParamSchema,
  refundOrderSchema,
  updateStatusSchema,
} from "../validators/admin-order.validator";

export const listOrdersController = asyncHandler(async (request: Request, response: Response) => {
  const query = adminOrderQuerySchema.parse(request.query);
  const payload = await listOrders(query);

  return response.status(HTTPSTATUS.OK).json({ message: "Orders", data: payload });
});

export const getOrderController = asyncHandler(async (request: Request, response: Response) => {
  const { orderId } = orderIdParamSchema.parse(request.params);
  const order = await findOrder(orderId);

  return response.status(HTTPSTATUS.OK).json({ message: "Order", data: { order } });
});

export const releaseRiderController = asyncHandler(
  async (request: Request, response: Response) => {
    const { orderId } = orderIdParamSchema.parse(request.params);
    const admin = request.user as UserDocument;
    const order = await releaseRider(orderId, admin.name);

    return response.status(HTTPSTATUS.OK).json({ message: "Rider released", data: { order } });
  },
);

export const updateOrderStatusController = asyncHandler(
  async (request: Request, response: Response) => {
    const { orderId } = orderIdParamSchema.parse(request.params);
    const { status } = updateStatusSchema.parse(request.body);
    const admin = request.user as UserDocument;
    const order = await updateOrderStatus(orderId, status, admin.name);

    return response.status(HTTPSTATUS.OK).json({ message: "Order updated", data: { order } });
  },
);

export const refundOrderController = asyncHandler(async (request: Request, response: Response) => {
  const { orderId } = orderIdParamSchema.parse(request.params);
  const input = refundOrderSchema.parse(request.body);
  const order = await refundAdminOrder(orderId, input);

  return response.status(HTTPSTATUS.OK).json({ message: "Refund issued", data: { order } });
});
