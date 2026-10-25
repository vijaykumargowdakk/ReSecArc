# Third-party components and licences

## Runtime dependencies

| Package | Version | Licence | Used for |
|---------|---------|---------|----------|
| react, react-dom | 18.3 | MIT | UI framework |
| @xyflow/react (React Flow) | 12.x | MIT | Canvas, nodes, edges, zoom and pan |
| zustand | 5.x | MIT | Project state store |
| zod | 3.x | MIT | Project file schema and validation |
| lucide-react | 1.x | ISC | Toolbar and panel icons |
| papaparse | 5.x | MIT | CSV import and export |
| html-to-image | 1.11.11 (pinned) | MIT | Diagram export to SVG and PNG |

Build and test tooling (Vite, TypeScript, Vitest, ESLint) is used only in development and is not shipped in the bundle.

## Original assets

- **Device icons** (`src/ui/icons/`, about 70 two-tone silhouettes) and the **favicon** (`public/favicon.svg`) were drawn for this project. They do not reproduce any vendor's logo or product artwork.
- **Templates** (`src/examples/templates/`): the water treatment plant, substation, manufacturing line, office tower and pipeline are fictional. Their devices, names, addresses and rules do not describe any real facility.

## Standards terminology

The editor uses the vocabulary of the Purdue reference model and IEC 62443 (zones, conduits, target security levels). No text from either document is reproduced.
