"use client";

import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark as darkTheme } from "@clerk/themes";
import { useTheme } from "next-themes";

const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? darkTheme : undefined,
        variables: {
          colorPrimary: "#6366f1",
        },
      }}
      signInUrl="/agency/sign-in"
      signUpUrl="/agency/sign-up"
      afterSignInUrl="/agency"
      afterSignUpUrl="/agency"
    >
      {children}
    </ClerkProvider>
  );
};

export default AuthProvider;