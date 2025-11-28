"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, loginError } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="flex min-h-screen flex-col max-w-[500px] mx-auto border-r border-l">
      {/* Purple gradient header */}
      <div className="relative flex items-center justify-center flex-1 bg-linear-to-b from-purple-600 via-purple-500 to-purple-400 rounded-b-[3rem] pb-6 pt-12 px-6">
        <h1 className="text-4xl font-bold text-white text-center">Log In</h1>
      </div>

      {/* White form section */}
      <div className="flex-1 bg-white px-6">
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {loginError && (
            <p className="text-sm text-red-500">{loginError.message}</p>
          )}

          <Button
            type="submit"
            disabled={isLoggingIn}
            className="w-full"
            size="lg"
          >
            {isLoggingIn ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-center text-gray-600 text-sm">
            Need An Account?{" "}
            <Link href="/signup" className="text-purple-500 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
