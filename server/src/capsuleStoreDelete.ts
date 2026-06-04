export async function deleteCapsuleForStore({
  email,
  capsuleId,
  deleteCapsuleByIdForEmailImpl,
}: {
  email: string;
  capsuleId: string;
  deleteCapsuleByIdForEmailImpl;
}): Promise<boolean> {
  return Boolean(await deleteCapsuleByIdForEmailImpl({ email, capsuleId }));
}
