import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "../services/address.service";
import { addressIdSchema, addressSchema } from "../validators/address.validator";

const currentUserId = (request: Request) => (request.user as UserDocument)._id.toString();

export const listAddressesController = asyncHandler(
  async (request: Request, response: Response) => {
    const addresses = await listAddresses(currentUserId(request));

    return response.status(HTTPSTATUS.OK).json({
      message: "Addresses",
      data: { addresses },
    });
  },
);

export const createAddressController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = addressSchema.parse(request.body);
    const address = await createAddress(currentUserId(request), input);

    return response.status(HTTPSTATUS.CREATED).json({
      message: "Address saved",
      data: { address },
    });
  },
);

export const updateAddressController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = addressIdSchema.parse(request.params);
    const input = addressSchema.parse(request.body);
    const address = await updateAddress(currentUserId(request), id, input);

    return response.status(HTTPSTATUS.OK).json({
      message: "Address updated",
      data: { address },
    });
  },
);

export const setDefaultAddressController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = addressIdSchema.parse(request.params);
    const address = await setDefaultAddress(currentUserId(request), id);

    return response.status(HTTPSTATUS.OK).json({
      message: "Default address updated",
      data: { address },
    });
  },
);

export const deleteAddressController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = addressIdSchema.parse(request.params);
    await deleteAddress(currentUserId(request), id);

    return response.status(HTTPSTATUS.OK).json({ message: "Address removed" });
  },
);
