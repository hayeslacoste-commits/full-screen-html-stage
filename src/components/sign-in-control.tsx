import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FolderOpen, LogIn, LogOut, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { lockSite, unlockSite } from "@/lib/gate.functions";
import { ALLOWED_EMAIL, isAllowedEmail, type GateContent } from "@/lib/gate-shared";

export function SignInControl({ gate }: { gate: GateContent }) {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const lock = useServerFn(lockSite);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setStep("email");
    setPassword("");
    setError(null);
    setPending(false);
  };

  const continueWithEmail = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isAllowedEmail(email)) {
      setError("This email does not have access to the game folder.");
      return;
    }
    setStep("password");
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await unlock({ data: { email, password } });
      if (!result.ok) {
        setError("Email or password is incorrect.");
        return;
      }
      setOpen(false);
      reset();
      await router.invalidate();
    } catch {
      setError("Sign-in could not finish. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (gate.unlocked) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground sm:flex">
          <FolderOpen className="size-3.5" aria-hidden="true" />
          {gate.email}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await lock();
              await router.invalidate();
            } finally {
              setPending(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-accent disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-accent"
        >
          <LogIn className="size-4" aria-hidden="true" />
          Sign in
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none">
          <Dialog.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close sign-in">
            <X className="size-4" aria-hidden="true" />
          </Dialog.Close>
          <Dialog.Title className="pr-8 text-xl font-semibold">
            {step === "email" ? "Open your game folder" : "Enter your password"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {step === "email"
              ? "Start with the email that has access to this private folder."
              : `Signing in as ${ALLOWED_EMAIL}`}
          </Dialog.Description>

          {step === "email" ? (
            <form onSubmit={continueWithEmail} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@example.com"
                />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={(event) => void signIn(event)} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" /> Back
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pending ? "Signing in…" : "Sign in"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
