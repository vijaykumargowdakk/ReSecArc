// Prints a standalone HTML document without leaving the app: it is loaded into a hidden frame that
// may not run scripts, and that frame's print dialog is opened. The frame is reused for later prints.
const FRAME_ID = 'report-print-frame';

export function printHtml(html: string): void {
  let frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.title = 'Report for printing';
    // Same origin so the app can open the frame's print dialog; no allow-scripts, so nothing in it runs.
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.append(frame);
  }
  frame.onload = () => frame.contentWindow?.print();
  frame.srcdoc = html;
}
