"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RequireAuth({ children }) {
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  return <>{children}</>;
}
