import {
  ActivityIcon,
  BarChart3Icon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import loginBackground from "@/assets/login-bg-img.png";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useLogin } from "@/features/auth/use-auth";
import { ApiError } from "@/lib/axios-client";

type Errors = { email?: string; password?: string };

const HIGHLIGHTS = [
  { icon: ActivityIcon, label: "Live orders" },
  { icon: LockIcon, label: "Secure access" },
  { icon: BarChart3Icon, label: "Real-time updates" },
];

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  /** Where the guard bounced them from, so login returns them there. */
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Errors = {};
    if (!email.trim()) nextErrors.email = "Enter your email address";
    if (!password) nextErrors.password = "Enter your password";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (response) => {
          // The API authenticates any role; only an admin belongs in here.
          if (response.data.user.role !== "admin") {
            toast.error("This account cannot use the backoffice", {
              description: "Sign in with an admin account.",
            });

            return;
          }

          void navigate(from, { replace: true });
        },
        onError: (error) => {
          const message =
            error instanceof ApiError ? error.message : "Something went wrong. Try again.";

          toast.error("We could not sign you in", { description: message });
        },
      },
    );
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-[49fr_51fr]">
      {/* Brand side: decorative, so it drops away rather than stacking on mobile. */}
      <div className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col">
        <img
          alt=""
          className="absolute inset-x-0 bottom-0 h-[58%] w-full object-cover"
          src={loginBackground}
          // A diagonal reveal: teal above, photography below.
          style={{ clipPath: "polygon(0 22%, 100% 0, 100% 100%, 0 100%)" }}
        />

        <div className="relative flex flex-1 flex-col p-10">
          <Wordmark size="lg" />

          {/* Sits in the teal band above the photo rather than centred over it. */}
          <div className="mt-12 flex flex-col gap-4">
            <p className="text-primary-foreground/70 text-xs font-semibold tracking-[0.2em] uppercase">
              OnlineMall operations
            </p>
            <h2 className="max-w-md text-4xl font-bold tracking-tight text-balance">
              Everything your delivery network needs.
            </h2>
            <p className="text-primary-foreground/85 max-w-sm text-base">
              Manage orders, restaurants, riders and customers from one place.
            </p>
          </div>

          <div className="mt-auto flex items-center gap-5 text-sm font-medium">
            {HIGHLIGHTS.map(({ icon: Icon, label }, index) => (
              <div className="flex items-center gap-5" key={label}>
                {index > 0 ? <span className="bg-primary-foreground/25 h-5 w-px" /> : null}
                <span className="flex items-center gap-2">
                  <Icon className="size-4" />
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="bg-muted/50 flex flex-col p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <form className="w-full max-w-md" onSubmit={submit} noValidate>
            <div className="mb-8 flex flex-col gap-2">
              <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
                Admin portal
              </p>
              <h1 className="text-4xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-muted-foreground">Sign in to manage OnlineMall operations.</p>
            </div>

            <FieldGroup>
              <Field data-invalid={errors.email ? true : undefined}>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <InputGroup className="bg-background h-12">
                  <InputGroupAddon>
                    <MailIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    aria-invalid={errors.email ? true : undefined}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@onlinemall.in"
                    value={email}
                  />
                </InputGroup>
                {errors.email ? <FieldDescription>{errors.email}</FieldDescription> : null}
              </Field>

              <Field data-invalid={errors.password ? true : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <InputGroup className="bg-background h-12">
                  <InputGroupAddon>
                    <LockIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={errors.password ? true : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    value={password}
                  />
                  <InputGroupAddon align="inline-end">
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setShowPassword((current) => !current)}
                      type="button"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </InputGroupAddon>
                </InputGroup>
                {errors.password ? <FieldDescription>{errors.password}</FieldDescription> : null}
              </Field>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(value) => setRemember(value === true)}
                  />
                  Remember me
                </label>

                <button
                  className="text-primary cursor-pointer text-sm font-medium hover:underline"
                  onClick={() =>
                    toast("Ask another admin to reset it", {
                      description: "Self-service password reset is not built yet.",
                    })
                  }
                  type="button"
                >
                  Forgot password?
                </button>
              </div>

              <Button className="h-12 text-base" type="submit" disabled={login.isPending}>
                {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                Sign in
              </Button>

              <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
                <ShieldCheckIcon className="size-4" />
                Protected admin access
              </p>
            </FieldGroup>
          </form>
        </div>

        <p className="text-muted-foreground text-right text-xs">
          © {new Date().getFullYear()} OnlineMall (Hindaun)
        </p>
      </div>
    </div>
  );
}
