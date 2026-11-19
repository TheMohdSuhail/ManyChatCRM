"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { upsertLeadFromManyChat } from "@/lib/leads";
import { isManyChatConfigured, addTagByName } from "@/lib/manychat";
import { isValidStatus, statusMeta } from "@/lib/statuses";
import { fromISTInput } from "@/lib/time";
import { syncLeadInstagramChat } from "@/lib/instagramSync";
import { getIgAccount, IG_TOKEN_KEY } from "@/lib/instagram";
import { setSetting } from "@/lib/settings";
import { requireAdmin, requireUser } from "@/lib/users";

function refresh(id: string) {
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function updateLeadStatus(id: string, status: string) {
  await requireUser();
  if (!isValidStatus(status)) throw new Error("Invalid status");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
  if (lead.status === status) return;
  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: { status } }),
    prisma.activity.create({
      data: {
        leadId: id,
        type: "STATUS",
        message: `Status: ${statusMeta(lead.status).label} → ${statusMeta(status).label}`,
      },
    }),
  ]);

  // Optional: ManyChat me bhi tag laga do (jaise "crm_converted") taaki wahan se flow chala sako
  if (process.env.MANYCHAT_SYNC_STATUS_TAGS === "true" && isManyChatConfigured() && !lead.subscriberId.startsWith("ig:")) {
    await addTagByName(lead.subscriberId, `crm_${status.toLowerCase()}`).catch((e) =>
      console.error("[manychat tag]", e)
    );
  }
  refresh(id);
}

export async function updateLeadDetails(id: string, formData: FormData) {
  await requireUser();
  const get = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const dealValue = get("dealValue");
  const followUpAt = get("followUpAt");
  await prisma.lead.update({
    where: { id },
    data: {
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      source: get("source"),
      dealValue: dealValue ? Number(dealValue) || null : null,
      // form ka time IST maana jayega (server UTC me hai)
      followUpAt: followUpAt ? fromISTInput(followUpAt) : null,
    },
  });
  await prisma.activity.create({ data: { leadId: id, type: "UPDATE", message: "Lead details update hui" } });
  refresh(id);
}

export async function addNote(id: string, formData: FormData) {
  await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await prisma.note.create({ data: { leadId: id, body: body.slice(0, 5000) } });
  refresh(id);
}

export async function deleteNote(noteId: string, leadId: string) {
  await requireUser();
  await prisma.note.delete({ where: { id: noteId } });
  refresh(leadId);
}

export async function syncLeadFromManyChat(id: string) {
  await requireUser();
  if (!isManyChatConfigured()) return { ok: false, error: "MANYCHAT_API_TOKEN .env me set karo" };
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
  if (lead.subscriberId.startsWith("ig:")) {
    return { ok: false, error: "Ye lead Instagram DM se aayi hai, ManyChat me abhi nahi hai — 'Instagram chat refresh' use karo" };
  }
  const { apiError } = await upsertLeadFromManyChat({
    subscriberId: lead.subscriberId,
    payload: { id: lead.subscriberId },
    mode: "sync",
  });
  refresh(id);
  return apiError ? { ok: false, error: apiError } : { ok: true };
}

export async function deleteLead(id: string) {
  await requireAdmin();
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  revalidatePath("/");
  redirect("/leads");
}

export async function refreshLeadInstagramChat(id: string) {
  await requireUser();
  try {
    const stats = await syncLeadInstagramChat(id);
    refresh(id);
    return { ok: true, message: `${stats.newMessages} naye messages` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Setup page se Instagram access token save karna (pehle check karta hai ki token chal raha hai) */
export async function saveInstagramToken(formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/setup?ig_error=" + encodeURIComponent("Token khali hai"));
  let username = "";
  try {
    const acc = await getIgAccount(token);
    username = acc.username ?? acc.id;
  } catch (e) {
    redirect("/setup?ig_error=" + encodeURIComponent(e instanceof Error ? e.message : String(e)));
  }
  await setSetting(IG_TOKEN_KEY, token);
  // naya token 24 ghante baad refresh ho sakta hai — kal se auto-refresh shuru
  await setSetting("ig_token_refreshed_at", String(Date.now() - 6 * 86400000));
  revalidatePath("/setup");
  redirect("/setup?ig_ok=" + encodeURIComponent(username));
}
