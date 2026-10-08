import { UserDocument, UserModel } from "../models/user.model";

export const findUserById = (userId: string): Promise<UserDocument | null> =>
  UserModel.findById(userId).exec();

export const findUserByEmail = (email: string): Promise<UserDocument | null> =>
  UserModel.findOne({ email: email.toLowerCase() }).exec();

/** Login needs the hash, which the schema hides from every other read. */
export const findUserByEmailWithPassword = (email: string): Promise<UserDocument | null> =>
  UserModel.findOne({ email: email.toLowerCase() }).select("+password").exec();
