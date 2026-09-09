export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function shareFile(content: string, name: string, type: string): Promise<string> {
  const file = new File([content], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Pinch Hitter' });
      return 'File shared.';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return 'Sharing canceled. Your data is unchanged.';
    }
  }
  downloadFile(content, name, type);
  return 'File downloaded. You can send it to another coach.';
}
