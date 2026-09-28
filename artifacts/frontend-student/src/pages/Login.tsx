function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendDone, setResendDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: authApi.login,

    onSuccess: async (res) => {
      // Native Android app:
      // Persist the bearer token before navigating so subsequent API
      // requests can authenticate even if the WebView does not retain cookies.
      //
      // Browser:
      // Continue using the existing cookie-based authentication.
      if (isNativeApp()) {
        try {
          await setNativeAuthToken(res.token);
        } catch (err) {
          console.warn('Could not persist native auth token:', err);
        }
      }

      const refreshed = queryClient.invalidateQueries();

      if (isNativeApp()) {
        await refreshed;
      }

      setLocation('/dashboard');
    },

    onError: (err: unknown, vars) => {
      setResendDone(false);

      if (err instanceof ApiRequestError) {
        setError(err.message);

        const code = (err.data as { code?: string } | null)?.code;

        setUnverifiedEmail(
          code === 'EMAIL_NOT_VERIFIED' ? vars.email : null
        );
      } else {
        // Diagnostic behavior:
        // Show the real Android/native/network error instead of hiding it
        // behind "Something went wrong".
        setError(
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : String(err)
        );

        setUnverifiedEmail(null);
      }
    },
  });

  const resend = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => setResendDone(true),
  });

  return (
    <AuthLayout>
      <div className="w-full">

        <div className="font-mono-app text-[10px] uppercase tracking-[.16em] text-primary">
          Welcome back
        </div>

        <h1 className="mt-3 font-display text-4xl tracking-[-.04em]">
          Sign in to your desk.
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your next clear step is waiting.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();

            setError(null);
            setUnverifiedEmail(null);

            const f = new FormData(e.currentTarget);

            login.mutate({
              email: String(f.get('email')),
              password: String(f.get('password')),
            });
          }}
          className="mt-8 space-y-4"
        >

          <label className="block text-xs font-bold">
            Email

            <div className="relative mt-2">

              <Mail
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@college.edu"
                className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition-shadow focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                data-testid="input-login-email"
              />

            </div>
          </label>

          <label className="block text-xs font-bold">
            Password

            <div className="relative mt-2">

              <LockKeyhole
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                required
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="At least 8 characters"
                className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-11 text-sm outline-none transition-shadow focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                data-testid="input-login-password"
              />

              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                data-testid="button-toggle-login-password"
              >
                {showPassword ? (
                  <EyeOff size={15} />
                ) : (
                  <Eye size={15} />
                )}
              </button>

            </div>
          </label>

          <div className="flex justify-end">

            <Link
              href="/forgot-password"
              className="text-xs font-bold text-primary hover:underline"
              data-testid="button-forgot-password"
            >
              Forgot password?
            </Link>

          </div>

          {error && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive"
              data-testid="text-login-error"
            >

              {error}

              {unverifiedEmail && (
                <div className="mt-2">

                  {resendDone ? (
                    <span className="font-bold text-primary">
                      Verification email sent — check your inbox.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resend.mutate(unverifiedEmail)}
                      disabled={resend.isPending}
                      className="font-bold text-primary underline disabled:opacity-50"
                      data-testid="button-resend-verification"
                    >
                      {resend.isPending
                        ? 'Sending…'
                        : 'Resend verification email'}
                    </button>
                  )}

                </div>
              )}

            </div>
          )}

          <button
            disabled={login.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-extrabold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            data-testid="button-login-submit"
          >

            {login.isPending && <BrandSpinner size={14} />}

            {login.isPending ? 'Signing in…' : 'Sign in'}

          </button>

        </form>

        <p className="mt-7 text-center text-xs text-muted-foreground">

          New to the desk?{' '}

          <Link
            href="/register"
            className="font-bold text-primary hover:underline"
            data-testid="link-register"
          >
            Create a student account
          </Link>

        </p>

      </div>
    </AuthLayout>
  );
}