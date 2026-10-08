const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export type SignInFields = "email" | "password";
export type SignUpFields = "name" | "email" | "phone" | "password";

export const validateSignIn = (values: {
  email: string;
  password: string;
}): FieldErrors<SignInFields> => {
  const errors: FieldErrors<SignInFields> = {};

  if (!values.email.trim()) errors.email = "Enter your email address";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address";

  if (!values.password) errors.password = "Enter your password";

  return errors;
};

export const validateSignUp = (values: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): FieldErrors<SignUpFields> => {
  const errors: FieldErrors<SignUpFields> = {};

  if (values.name.trim().length < 2) errors.name = "Enter your full name";

  if (!values.email.trim()) errors.email = "Enter your email address";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address";

  const digits = values.phone.replace(/\D/g, "");
  if (!digits) errors.phone = "Enter your phone number";
  else if (digits.length < 7) errors.phone = "Enter a valid phone number";

  if (values.password.length < 8) errors.password = "Use at least 8 characters";

  return errors;
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3;
  label: string;
};

export const scorePassword = (password: string): PasswordStrength => {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || (/[A-Za-z]/.test(password) && /\d/.test(password))) score += 1;

  const label = score >= 3 ? "Strong password" : score === 2 ? "Good password" : "Weak password";

  return { score: Math.min(score, 3) as PasswordStrength["score"], label };
};
