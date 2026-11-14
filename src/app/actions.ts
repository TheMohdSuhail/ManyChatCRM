"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { upsertLeadFromManyChat } from "@/lib/leads";
import { isManyChatConfigured, addTagByName } from "@/lib/manychat";
import { isValidStatus, statusMeta } from "@/lib/statuses";

function refresh(id: string) {
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function updateLeadStatus(id: string, status: string) {
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
  if (process.env.MANYCHAT_SYNC_STATUS_TAGS === "true" && isManyChatConfigured()) {
    await addTagByName(lead.subscriberId, `crm_${status.toLowerCase()}`).catch((e) =>
      console.error("[manychat tag]", e)
    );
  }
  refresh(id);
}

export async function updateLeadDetails(id: string, formData: FormData) {
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
      followUpAt: followUpAt ? new Date(followUpAt) : null,
    },
  });
  await prisma.activity.create({ data: { leadId: id, type: "UPDATE", message: "Lead details update hui" } });
  refresh(id);
}

export async function addNote(id: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await prisma.note.create({ data: { leadId: id, body: body.slice(0, 5000) } });
  refresh(id);
}

export async function deleteNote(noteId: string, leadId: string) {
  await prisma.note.delete({ where: { id: noteId } });
  refresh(leadId);
}

export async function syncLeadFromManyChat(id: string) {
  if (!isManyChatConfigured()) return { ok: false, error: "MANYCHAT_API_TOKEN .env me set karo" };
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
  const { apiError } = await upsertLeadFromManyChat({
    subscriberId: lead.subscriberId,
    payload: { id: lead.subscriberId },
    mode: "sync",
  });
  refresh(id);
  return apiError ? { ok: false, error: apiError } : { ok: true };
}

export async function deleteLead(id: string) {
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  revalidatePath("/");
  redirect("/leads");
}
