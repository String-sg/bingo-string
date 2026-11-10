export async function copyLink(input, status) {
  let copied = false;
  try {
    await navigator.clipboard.writeText(input.value);
    copied = true;
  } catch {
    input.focus();
    input.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      // Keep the link selected when the browser blocks programmatic copying.
    }
  }
  status.textContent = copied ? "Link copied." : "Link selected. Use your device’s Copy command.";
}
