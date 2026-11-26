import { writeFile } from 'node:fs/promises'

await writeFile(new URL('../dist/esm/package.json', import.meta.url), '{"type":"module"}\n')
