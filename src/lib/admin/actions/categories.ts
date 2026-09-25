"use server";

import { z } from "zod";
import { categorySchema, issuesToFieldErrors, type CategoryPayload } from "../schemas";
import { ActionError, adminAction, must, revalidateAdmin, revalidateCatalog, UUID_RE } from "../server";

const id = z.string().regex(UUID_RE, "Nederīgs ID");

export async function saveCategory(input: CategoryPayload) {
  return adminAction(
    async ({ supabase }) => {
      const parsed = categorySchema.safeParse(input);
      if (!parsed.success) throw new ActionError("Pārbaudiet iezīmētos laukus", issuesToFieldErrors(parsed.error.issues));
      const c = parsed.data;
      if (!c.i18n.lv?.name.trim()) throw new ActionError("Latviešu nosaukums ir obligāts", { "i18n.lv.name": "Obligāts lauks" });

      const dup = (must(await supabase.from("categories").select("id").eq("slug", c.slug).limit(2)) ?? []) as { id: string }[];
      if (dup.some((r) => r.id !== c.id)) throw new ActionError("Šāds slug jau eksistē", { slug: "Šāds slug jau eksistē" });

      const i18n: Record<string, unknown> = {};
      for (const [lang, t] of Object.entries(c.i18n)) if (t && t.name.trim()) i18n[lang] = { ...t, name: t.name.trim() };
      const row = { slug: c.slug, icon: c.icon, image: c.image, is_active: c.is_active, i18n };

      let categoryId = c.id ?? null;
      if (categoryId) {
        must(await supabase.from("categories").update(row).eq("id", categoryId));
      } else {
        const last = (must(await supabase.from("categories").select("sort").order("sort", { ascending: false }).limit(1)) ?? []) as { sort: number }[];
        const created = must(await supabase.from("categories").insert({ ...row, sort: (last[0]?.sort ?? 0) + 1 }).select("id").single()) as { id: string };
        categoryId = created.id;
      }
      revalidateCatalog();
      revalidateAdmin();
      return { id: categoryId, created: !c.id };
    },
    (d) => (d.created ? "Kategorija izveidota" : "Kategorija saglabāta"),
  );
}

export async function reorderCategories(ids: string[]) {
  return adminAction(async ({ supabase }) => {
    const list = z.array(id).min(1).max(200).parse(ids);
    for (const [i, cid] of list.entries()) {
      must(await supabase.from("categories").update({ sort: i + 1 }).eq("id", cid));
    }
    revalidateCatalog();
    return null;
  }, "Secība saglabāta");
}

export async function setCategoryActive(categoryId: string, value: boolean) {
  return adminAction(async ({ supabase }) => {
    id.parse(categoryId);
    must(await supabase.from("categories").update({ is_active: Boolean(value) }).eq("id", categoryId));
    revalidateCatalog();
    return null;
  }, value ? "Kategorija aktivizēta" : "Kategorija paslēpta");
}

export async function deleteCategory(categoryId: string) {
  return adminAction(async ({ supabase }) => {
    id.parse(categoryId);
    must(await supabase.from("categories").delete().eq("id", categoryId));
    revalidateCatalog();
    return null;
  }, "Kategorija dzēsta");
}
