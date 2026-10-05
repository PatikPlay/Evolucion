/** Shared settings for the H1 selection experiments. */
export const PASS_RATE = 0.8;

export function report(label: string, lines: string[]): void {
  console.log(`\n${label}\n${lines.join('\n')}`);
}
