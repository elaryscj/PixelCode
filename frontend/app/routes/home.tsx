import { useEffect } from "react";
import { useNavigate } from "react-router";
import Hero from "../components/Hero";
import type { Route } from "./+types/home";
import { getCurrentUser } from "~/api/auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "PixelCode Arena" },
    { name: "description", content: "Welcome to PixelCode Arena" },
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
      <h3 className="font-pixel text-4xl text-yellow hover:text-glow-sm text-center lg:hidden">
        Sorry, the game is not yet available for your device...
      </h3>
    </>
  );
}
