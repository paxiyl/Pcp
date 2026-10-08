import { UserDocument } from "../models/user.model";

declare global {
  namespace Express {
    // Passport attaches the authenticated Mongoose user document to the request.
    interface User extends UserDocument {}
  }
}

export {};
