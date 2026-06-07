"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "~/trpc/react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = api.auth.register.useMutation({
    onSuccess: async () => {
      // Auto sign-in after a successful registration (use the cleaned email).
      await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
      toast.success("Account created.");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => {
      // Prefer a friendly field message over the raw Zod JSON.
      const fieldError =
        err.data?.zodError?.fieldErrors?.email?.[0] ??
        err.data?.zodError?.fieldErrors?.password?.[0] ??
        err.data?.zodError?.fieldErrors?.name?.[0];
      toast.error(fieldError ?? err.message);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Trim before sending so accidental spaces never reach validation.
    register.mutate({ name: name.trim(), email: email.trim(), password });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Create account</h1>
        <Field label="Name" type="text" value={name} onChange={setName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password (min 8 chars)" type="password" value={password} onChange={setPassword} />
        <button
          type="submit"
          disabled={register.isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {register.isPending ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
