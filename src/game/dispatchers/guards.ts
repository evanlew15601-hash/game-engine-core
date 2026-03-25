import type { Command } from '../command';

export function isCommand(cmd: unknown): cmd is Command {
  return Boolean(cmd) && typeof cmd === 'object' && 'type' in (cmd as any);
}
