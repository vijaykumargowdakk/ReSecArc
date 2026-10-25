export function slug(name: string, fallback = 'architecture'): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

export function downloadUrl(fileName: string, url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
}

export function downloadText(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  downloadUrl(fileName, url);
  URL.revokeObjectURL(url);
}
