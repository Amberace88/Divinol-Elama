import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/admin/ui";
import { btn } from "@/components/admin/styles";

export default function AdminNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-white shadow-card">
      <EmptyState
        icon={SearchX}
        title="Ieraksts nav atrasts"
        description="Iespējams, tas ir dzēsts vai saite ir nepareiza."
        action={
          <Link href="/admin" className={btn("dark")}>
            Uz pārskatu
          </Link>
        }
      />
    </div>
  );
}
