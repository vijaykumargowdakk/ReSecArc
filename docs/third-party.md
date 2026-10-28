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

Build and test tooling is used only in development and is not shipped in the bundle:

| Package | Licence | Used for |
|---------|---------|----------|
| Vite, TypeScript, Vitest, ESLint | MIT / Apache-2.0 | Build, type checking, unit tests, linting |
| @playwright/test | Apache-2.0 | Browser tests |
| @axe-core/playwright (axe-core) | MPL-2.0 | Accessibility scans in browser tests |

## Original assets

- **Device icons** (`src/ui/icons/`, about 70 two-tone silhouettes) and the **favicon** (`public/favicon.svg`) were drawn for this project. They do not reproduce any vendor's logo or product artwork.
- **Screenshots** (`docs/images/`) show the app with the fictional templates below.
- **Templates** (`src/examples/templates/`): the water treatment plant, substation, manufacturing line, office tower and pipeline are fictional. Their devices, names, addresses and rules do not describe any real facility.

## Standards terminology

The editor uses the vocabulary of the Purdue reference model and IEC 62443 (zones, conduits, target security levels). No text from either document is reproduced. The security checks cite IEC 62443 clauses by number only (for example "IEC 62443-3-3 SR 5.2") and describe them in our own words.
