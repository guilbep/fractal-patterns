// Copy text to the clipboard. True on success; false when there is no clipboard (insecure context, blocked). Never throws.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
