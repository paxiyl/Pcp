import { OAuth2Client, TokenPayload } from "google-auth-library";

import { BadRequestException, UnauthorizedException } from "../utils/app-error";
import { Env } from "./env.config";

/**
 * Verifying the ID token the client already obtained from Google.
 *
 * Deliberately not a server-side OAuth redirect dance. The admin app and the
 * phone app each get an ID token from Google directly, post it here, and the
 * server checks the signature and issues its own JWT. One code path serves both
 * surfaces, and the server never handles a client secret or a session cookie.
 */

/**
 * Accepts several ids because the web app and the Android app are separate
 * OAuth clients, and the audience on the token is whichever one issued it.
 */
const audiences = (): string[] =>
  Env.GOOGLE_CLIENT_IDS.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

let client: OAuth2Client | null = null;

/** Whether the server was configured for Google at all. */
export const isGoogleSignInConfigured = (): boolean => audiences().length > 0;

export const verifyGoogleIdToken = async (idToken: string): Promise<TokenPayload> => {
  const audience = audiences();

  if (audience.length === 0) {
    throw new BadRequestException("Google sign-in is not configured on this server");
  }

  client ??= new OAuth2Client();

  // Checks the signature against Google's keys, the issuer, the expiry, and
  // that the token was minted for one of OUR clients. Without the audience
  // check, a token issued to any other Google app would be accepted here.
  const ticket = await client.verifyIdToken({ audience, idToken });
  const payload = ticket.getPayload();

  if (!payload) throw new UnauthorizedException("Google sign-in failed");

  return payload;
};
