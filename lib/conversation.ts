import { getPrisma } from "@/lib/db";

export async function getOrCreateConversation(userId: string, merchantId: string | null, accountType: "MERCHANT" | "CONSUMER") {
  const prisma = getPrisma();
  if (!prisma) return null;

  // Get the most recent conversation for this user/role
  const existing = await prisma.conversation.findFirst({
    where: { userId, accountType },
    orderBy: { createdAt: "desc" },
  });

  if (existing && new Date().getTime() - existing.updatedAt.getTime() < 3600000) {
    // If conversation is less than 1 hour old, reuse it
    return existing;
  }

  // Create new conversation
  return await prisma.conversation.create({
    data: { userId, merchantId, accountType },
  });
}

export async function addMessage(conversationId: string, role: "user" | "assistant", content: string, toolActivity?: string[]) {
  const prisma = getPrisma();
  if (!prisma) return null;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolData = toolActivity ? (JSON.parse(JSON.stringify(toolActivity)) as any) : null;

  return await prisma.conversationMessage.create({
    data: {
      conversationId,
      role,
      content,
      toolActivity: toolData,
    },
  });
}

export async function getConversationContext(conversationId: string, limit = 10) {
  const prisma = getPrisma();
  if (!prisma) return [];

  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: -limit, // last N messages
  });

  return messages.map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content,
  }));
}

