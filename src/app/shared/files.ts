export function backupFileName(date = new Date()): string {
  return 'pinch-hitter-' + date.toISOString().slice(0, 10) + '.json';
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || !navigator.canShare) {
    return false;
  }
  try {
    const testFile = new File(['{}'], 'test.json', { type: 'application/json' });
    return !!navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function shareFile(
  content: string,
  name: string,
  type: string,
  title = 'Pinch Hitter Notebook',
): Promise<string> {
  const file = new File([content], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: 'Pinch Hitter notebook backup',
      });
      return 'Notebook saved. Your data is with you.';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'Sharing canceled. Your notebook is unchanged.';
      }
    }
  }
  downloadFile(content, name, type);
  return 'Notebook downloaded. Save it to iCloud Drive, Google Drive, or your files.';
}

