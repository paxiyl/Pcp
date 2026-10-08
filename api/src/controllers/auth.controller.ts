import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import { findDefaultAddress } from "../services/address.service";
import { loginUser, registerUser } from "../services/auth.service";
import { clearJwtAuthCookie, setJwtAuthCookie } from "../utils/cookie";
import { loginSchema, registerSchema } from "../validators/auth.validator";

export const registerController = asyncHandler(async (request: Request, response: Response) => {
  const input = registerSchema.parse(request.body);
  const { accessToken, defaultAddress, hasAddress, user } = await registerUser(input);

  setJwtAuthCookie(response, accessToken);

  return response.status(HTTPSTATUS.CREATED).json({
    message: "Account created",
    data: { accessToken, defaultAddress, hasAddress, user },
  });
});

export const loginController = asyncHandler(async (request: Request, response: Response) => {
  const input = loginSchema.parse(request.body);
  const { accessToken, defaultAddress, hasAddress, user } = await loginUser(input);

  setJwtAuthCookie(response, accessToken);

  return response.status(HTTPSTATUS.OK).json({
    message: "Logged in",
    data: { accessToken, defaultAddress, hasAddress, user },
  });
});

export const logoutController = asyncHandler(async (_request: Request, response: Response) => {
  clearJwtAuthCookie(response);

  return response.status(HTTPSTATUS.OK).json({ message: "Logged out" });
});

export const currentUserController = asyncHandler(async (request: Request, response: Response) => {
  const user = request.user as UserDocument;
  const defaultAddress = await findDefaultAddress(user._id.toString());

  return response.status(HTTPSTATUS.OK).json({
    message: "Current user",
    data: { defaultAddress, hasAddress: defaultAddress !== null, user },
  });
});
