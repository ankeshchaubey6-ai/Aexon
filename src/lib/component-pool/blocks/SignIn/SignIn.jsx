import { useForm } from "../../hooks/useForm.js";
import { isEmail, isRequired } from "../../utils/validators.js";
import { Button } from "../../primitives/Button/Button.jsx";
import { Input } from "../../primitives/Input/Input.jsx";

/**
 * Production sign-in form with validation.
 * @param {(values:{email,password})=>Promise} onSubmit
 * @param {()=>void} onForgotPassword
 * @param {string} signUpHref
 * @param {React.ReactNode[]} oauthProviders - e.g. [<GoogleButton/>, <GithubButton/>]
 */
export function SignIn({ onSubmit, onForgotPassword, signUpHref = "/sign-up", oauthProviders = [], error }) {
  const form = useForm(
    { email: "", password: "" },
    {
      email:    (v) => !isRequired(v) ? "Email is required" : !isEmail(v) ? "Enter a valid email" : null,
      password: (v) => !isRequired(v) ? "Password is required" : v.length < 6 ? "At least 6 characters" : null,
    }
  );

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Don&apos;t have an account?{" "}
        <a href={signUpHref} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Sign up</a>
      </p>

      {oauthProviders.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {oauthProviders}
          <div className="relative flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/>
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/>
          </div>
        </div>
      )}

      <form className="mt-6 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{error}</div>}
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" {...form.field("email")} error={form.touched.email && form.errors.email} />
        <div>
          <Input label="Password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.field("password")} error={form.touched.password && form.errors.password} />
          {onForgotPassword && <button type="button" onClick={onForgotPassword} className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">Forgot password?</button>}
        </div>
        <Button type="submit" size="lg" fullWidth loading={form.isSubmitting} className="mt-2">Sign in</Button>
      </form>
    </div>
  );
}
