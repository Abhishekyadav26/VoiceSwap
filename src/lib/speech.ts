export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

export interface PreviewSummary {
  fromSymbol: string;
  toSymbol: string;
  payUi: string;
  receiveUi: string;
  rate: string;
  priceImpactPct: string;
  slippageLimit: string;
  blocked: boolean;
  simulationPass: boolean | null;
}

export function buildPreviewSummary(p: PreviewSummary): string {
  const verdict = p.blocked
    ? "This swap is currently blocked by safety checks."
    : p.simulationPass === false
      ? "Warning: simulation failed."
      : "Simulation passed and safety checks look good.";
  return (
    `Swap preview. You pay ${p.payUi} ${p.fromSymbol} and receive about ` +
    `${p.receiveUi} ${p.toSymbol}. Rate ${p.rate}. ` +
    `Price impact ${p.priceImpactPct} percent. Slippage limit ${p.slippageLimit}. ${verdict}`
  );
}
