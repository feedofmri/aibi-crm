import { Link } from "react-router";
import { Compass } from "lucide-react";
import { EmptyState, buttonClass } from "@/components/ui";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={
        <Link to="/pipeline" className={buttonClass("primary")}>
          Go to pipeline
        </Link>
      }
    />
  );
}
