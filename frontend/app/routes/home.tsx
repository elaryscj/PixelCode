import { useEffect } from "react";
import { useNavigate } from "react-router";
import Hero from "../components/Hero";
import type { Route } from "./+types/home";
import { getCurrentUser } from "~/api/auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "PixelCode Arena" },
    { name: "description", content: "Real-time 1v1 coding duels: race through the arena, crack code doors, climb the ranks." },
  ];
}

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // If user is not authenticated, immediately redirect to /login
    const user = getCurrentUser();
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return (
    <>
      <div className="star-background"></div>
      <Hero />
    </>
  );
}
