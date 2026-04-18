export const toUtcDate = (dateStr: string): Date =>
  new Date(dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
